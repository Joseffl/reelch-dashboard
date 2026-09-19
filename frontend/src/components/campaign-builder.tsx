"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Creative = { id: string; originalFilename: string; sizeBytes: number };
type Campaign = { id: string; title: string; description: string; unitPriceKobo: number; targetQuantity: number; budgetKobo: number; targeting: Record<string, unknown>; status: string; startsAt?: string; endsAt?: string };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
async function api<T>(path: string, init?: RequestInit) { const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init, headers: { "content-type": "application/json", ...init?.headers } }); const body = await response.json().catch(() => ({})) as T & { message?: string }; if (!response.ok) throw new Error(body.message ?? "Request failed"); return body; }

export function CampaignBuilder({ campaignId }: { campaignId?: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => { if (!campaignId) return; api<{ campaign: Campaign; creatives: Creative[] }>(`/business/campaigns/${campaignId}`).then((result) => { setCampaign(result.campaign); setCreatives(result.creatives); }).catch((cause) => setError(cause.message)); }, [campaignId]);

  async function upload(campaignRecord: Campaign, file: File) {
    setStatusText("Uploading creative…");
    const signed = await api<{ key: string; uploadUrl: string; headers: Record<string, string> }>(`/business/campaigns/${campaignRecord.id}/creatives/presign`, { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }) });
    const result = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: file });
    if (!result.ok) throw new Error("The image or video could not be uploaded");
    await api(`/business/campaigns/${campaignRecord.id}/creatives/complete`, { method: "POST", body: JSON.stringify({ key: signed.key, filename: file.name, contentType: file.type, sizeBytes: file.size, altText: campaignRecord.title }) });
    const current = await api<{ creatives: Creative[] }>(`/business/campaigns/${campaignRecord.id}`);
    setCreatives(current.creatives);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile && !creatives.length) { setError("Add an image or video for the campaign"); return; }
    setBusy(true); setError(""); setStatusText("Saving campaign…");
    const form = new FormData(event.currentTarget);
    const body = {
      title: form.get("title"), description: form.get("description"), conversionType: "visibility",
      unitPriceKobo: Math.round(Number(form.get("unitPrice")) * 100), targetQuantity: Number(form.get("targetQuantity")),
      destinationUrl: form.get("destinationUrl"), startsAt: form.get("startsAt") || undefined, endsAt: form.get("endsAt") || undefined,
      targeting: { country: "Nigeria", objective: "visibility", requirements: form.get("requirements") },
    };
    try {
      const saved = campaign ? await api<Campaign>(`/business/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(body) }) : await api<Campaign>("/business/campaigns", { method: "POST", body: JSON.stringify(body) });
      setCampaign(saved);
      if (selectedFile) await upload(saved, selectedFile);
      setSelectedFile(null);
      setReviewing(true);
      if (!campaignId) window.history.replaceState(null, "", `/business/campaigns/${saved.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save campaign"); }
    finally { setBusy(false); setStatusText(""); }
  }

  async function submit() {
    if (!campaign) return;
    setBusy(true); setError("");
    try { await api(`/business/campaigns/${campaign.id}/submit`, { method: "POST", body: "{}" }); router.replace("/business/campaigns"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit campaign"); setBusy(false); }
  }

  const targeting = campaign?.targeting ?? {};
  return <div className="mx-auto max-w-4xl"><Link href="/business/campaigns" className="inline-flex items-center gap-2 text-sm font-bold text-black/55"><ArrowLeft className="size-4" /> Campaigns</Link>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
    {!reviewing ? <form onSubmit={save} className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_12px_45px_rgba(21,23,15,.04)] sm:p-8"><div className="flex flex-col gap-3 border-b border-black/[.08] pb-6 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-black tracking-[-.035em]">Campaign details</h2><p className="mt-2 text-sm text-black/48">Create a visibility campaign for audiences in Nigeria.</p></div><span className="w-fit rounded-full bg-[#d8ffbd] px-3 py-1.5 text-xs font-bold">Goal: Visibility</span></div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Input label="Campaign title" name="title" defaultValue={campaign?.title} placeholder="e.g. Introduce our new savings app" required /></div><div className="sm:col-span-2"><TextArea label="Campaign description" name="description" defaultValue={campaign?.description} placeholder="Tell promoters what the campaign is about and what makes it worth sharing." required /></div><div className="sm:col-span-2"><Input label="Campaign link" name="destinationUrl" type="url" defaultValue={String(targeting.destinationUrl ?? "")} placeholder="https://yourwebsite.com/campaign" required /></div><Input label="Reward per verified result (₦)" name="unitPrice" type="number" min="1" defaultValue={campaign ? String(campaign.unitPriceKobo / 100) : undefined} placeholder="1500" required /><Input label="Number of results" name="targetQuantity" type="number" min="1" defaultValue={campaign ? String(campaign.targetQuantity) : undefined} placeholder="100" required /><Input label="Start date" name="startsAt" type="date" defaultValue={campaign?.startsAt?.slice(0, 10)} /><Input label="End date" name="endsAt" type="date" defaultValue={campaign?.endsAt?.slice(0, 10)} /><div className="sm:col-span-2"><TextArea label="Instructions for promoters" name="requirements" defaultValue={String(targeting.requirements ?? "")} placeholder="Optional: key message, hashtags, talking points, or anything promoters should include." /></div>
        <div className="sm:col-span-2"><p className="text-sm font-bold">Campaign image or video <Required /></p><label className={`mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition ${selectedFile || creatives.length ? "border-green-200 bg-green-50" : "border-black/20 hover:border-[#6558ff] hover:bg-[#faf9ff]"}`}>{busy && statusText.includes("Uploading") ? <LoaderCircle className="size-7 animate-spin text-[#6558ff]" /> : selectedFile || creatives.length ? <Check className="size-7 text-green-700" /> : <Upload className="size-7 text-[#6558ff]" />}<span className="mt-3 text-sm font-black">{selectedFile?.name ?? creatives.at(-1)?.originalFilename ?? "Choose an image or video"}</span><span className="mt-1 text-xs text-black/42">JPEG, PNG, WebP, or MP4 · maximum 25 MB</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={busy} onChange={(event) => { const file = event.target.files?.[0] ?? null; setSelectedFile(file); setError(""); }} /></label></div>
      </div><button disabled={busy} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] text-sm font-bold text-white disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> {statusText}</> : <>Review campaign <ArrowRight className="size-4" /></>}</button><p className="mt-3 text-center text-xs text-black/38"><Required /> Required fields</p>
    </form> : campaign && <section className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_12px_45px_rgba(21,23,15,.04)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6558ff]">Ready to submit</p><h2 className="mt-3 text-3xl font-black">{campaign.title}</h2><p className="mt-3 text-sm leading-6 text-black/50">{campaign.description}</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><Summary label="Reward" value={`₦${(campaign.unitPriceKobo / 100).toLocaleString()}`} /><Summary label="Target" value={`${campaign.targetQuantity} results`} /><Summary label="Budget" value={`₦${(campaign.budgetKobo / 100).toLocaleString()}`} /></div><div className="mt-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4"><ImagePlus className="size-5 text-green-700" /><div className="min-w-0"><p className="truncate text-sm font-bold">{creatives.at(-1)?.originalFilename}</p><p className="text-xs text-black/45">Creative ready</p></div></div><p className="mt-6 rounded-xl bg-[#f6f5f0] p-4 text-sm leading-6 text-black/55">We’ll review the creative, campaign details, and budget before it can go live.</p><div className="mt-7 flex gap-3"><button type="button" disabled={busy} onClick={() => setReviewing(false)} className="min-h-12 flex-1 rounded-xl border border-black/10 font-bold">Edit</button><button type="button" onClick={submit} disabled={busy} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#171811] font-bold text-white disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Submitting…</> : "Submit for review"}</button></div></section>}
  </div>;
}

function Required() { return <span className="text-red-600" aria-hidden="true">*</span>; }
function Input({ label, required, ...input }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; min?: string; placeholder?: string }) { return <label className="block text-sm font-bold">{label}{required && <> <Required /></>}<input {...input} required={required} aria-label={label} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function TextArea({ label, name, defaultValue, required, placeholder }: { label: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string }) { return <label className="block text-sm font-bold">{label}{required && <> <Required /></>}<textarea name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} className="mt-2 min-h-28 w-full rounded-xl border border-black/12 p-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f6f5f0] p-4"><p className="text-xs font-bold uppercase text-black/35">{label}</p><p className="mt-2 font-black">{value}</p></div>; }
