"use client";

import { useErrorToast, ErrorFallback, toast } from "@/components/toasts";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle, Upload } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol, formatMoney } from "@/lib/money";
import { usePlatformConfig } from "@/lib/platform-config";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { CampaignResults, type ResultsData, type StatusChange } from "@/components/business-campaign-results";

type Creative = { id: string; originalFilename: string; sizeBytes: number };
type Campaign = { id: string; title: string; description: string; currency: string; unitPriceKobo: number; targetQuantity: number; budgetKobo: number; targeting: Record<string, unknown>; status: string; startsAt?: string; endsAt?: string };
const categories = ["Beauty", "Business", "Education", "Entertainment", "Fashion", "Finance", "Fitness", "Food", "Gaming", "Lifestyle", "Music", "Sports", "Technology", "Travel"];
const locations = ["Anywhere in Nigeria", "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
async function api<T>(path: string, init?: RequestInit) { const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init, headers: { "content-type": "application/json", ...init?.headers } }); const body = await response.json().catch(() => ({})) as T & { message?: string }; if (!response.ok) throw new Error(body.message ?? "Request failed"); return body; }

export function CampaignBuilder({ campaignId }: { campaignId?: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const platform = usePlatformConfig();
  const currency = campaign?.currency ?? platform?.currency ?? "USD";
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [results, setResults] = useState<{ results: ResultsData; history: StatusChange[] } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useErrorToast();
  const router = useRouter();

  useEffect(() => { if (!campaignId) return; api<{ campaign: Campaign; creatives: Creative[]; results: ResultsData; history: StatusChange[] }>(`/business/campaigns/${campaignId}`).then((result) => { setCampaign(result.campaign); setCreatives(result.creatives); setResults({ results: result.results, history: result.history }); }).catch((cause) => setError(cause.message)); }, [campaignId, setError, reloadKey]);

  async function upload(campaignRecord: Campaign, file: File) {
    setStatusText("Uploading file…");
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
      targeting: { country: "Nigeria", objective: "visibility", category: form.get("category"), location: form.get("location"), platforms: form.getAll("platforms"), minimumViews: Number(form.get("minimumViews") || 0), requiredHashtag: form.get("requiredHashtag"), minimumLiveHours: 24, requirements: form.get("requirements") },
    };
    try {
      const saved = campaign ? await api<Campaign>(`/business/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(body) }) : await api<Campaign>("/business/campaigns", { method: "POST", body: JSON.stringify(body) });
      setCampaign(saved);
      if (selectedFile) await upload(saved, selectedFile);
      setSelectedFile(null);
      setReviewing(true); toast.success("Campaign saved. Review the details before submitting.");
      if (!campaignId) window.history.replaceState(null, "", `/business/campaigns/${saved.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save campaign"); }
    finally { setBusy(false); setStatusText(""); }
  }

  async function submit() {
    if (!campaign) return;
    setBusy(true); setError("");
    try { await api(`/business/campaigns/${campaign.id}/submit`, { method: "POST", body: "{}" }); toast.success("Campaign submitted for review."); router.replace("/business/campaigns"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit campaign"); setBusy(false); }
  }

  const targeting = campaign?.targeting ?? {};
  if (campaignId && !campaign && error) return <ErrorFallback />;
  // Waiting for the campaign means select fields get their saved values, and locked campaigns never flash the form.
  if (campaignId && !campaign) return <DashboardSkeleton />;
  if (campaign && results && !["draft", "rejected"].includes(campaign.status)) return <CampaignResults campaign={campaign} results={results.results} history={results.history} onChanged={() => setReloadKey((key) => key + 1)} />;
  return <div className="mx-auto max-w-4xl"><Link href="/business/campaigns" className="inline-flex items-center gap-2 text-sm font-bold text-black/55"><ArrowLeft className="size-4" /> Campaigns</Link>
    {!reviewing ? <form onSubmit={save} className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_12px_45px_rgba(21,23,15,.04)] sm:p-8"><div className="flex flex-col gap-3 border-b border-black/[.08] pb-6 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-black tracking-[-.035em]">Campaign details</h2><p className="mt-2 text-sm text-black/48">Create a visibility campaign for audiences in Nigeria.</p></div><span className="w-fit rounded-full bg-[#d8ffbd] px-3 py-1.5 text-xs font-bold">Goal: Visibility</span></div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Input label="Campaign title" name="title" defaultValue={campaign?.title} placeholder="e.g. Introduce our new savings app" required /></div><div className="sm:col-span-2"><TextArea label="Campaign description" name="description" defaultValue={campaign?.description} placeholder="Tell promoters what the campaign is about and what makes it worth sharing." required /></div><Select label="Campaign category" name="category" options={categories} defaultValue={String(targeting.category ?? "")} required /><Select label="Promoter location" name="location" options={locations} defaultValue={String(targeting.location ?? "Anywhere in Nigeria")} required /><div className="sm:col-span-2"><p className="-mt-2 text-xs leading-5 text-black/42">Choose a specific location only when the campaign needs local promoters. Otherwise, leave it open across Nigeria.</p></div><fieldset className="sm:col-span-2"><legend className="text-sm font-bold">Where promoters can publish <Required /></legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{["Instagram","TikTok","X","WhatsApp"].map(platform=><label key={platform} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-black/10 px-3 text-sm font-semibold has-[:checked]:border-[#6558ff] has-[:checked]:bg-[#edeaff]"><input type="checkbox" name="platforms" value={platform.toLowerCase()} defaultChecked={!Array.isArray(targeting.platforms)||targeting.platforms.map(String).includes(platform.toLowerCase())} className="accent-[#6558ff]"/>{platform}</label>)}</div></fieldset><Input label="Required hashtag" name="requiredHashtag" defaultValue={String(targeting.requiredHashtag ?? "")} placeholder="#YourCampaign" /><Input label="Minimum views before approval" name="minimumViews" type="number" min="0" defaultValue={String(targeting.minimumViews ?? 0)} placeholder="0" /><div className="sm:col-span-2"><Input label="Campaign link" name="destinationUrl" type="url" defaultValue={String(targeting.destinationUrl ?? "")} placeholder="https://yourwebsite.com/campaign" required /></div><Input label={`Reward per approved post (${currencySymbol(currency)})`} name="unitPrice" type="number" min="1" defaultValue={campaign ? String(campaign.unitPriceKobo / 100) : undefined} placeholder={currency === "NGN" ? "1500" : "5"} required /><Input label="Number of posts needed" name="targetQuantity" type="number" min="1" defaultValue={campaign ? String(campaign.targetQuantity) : undefined} placeholder="100" required /><Input label="Start date" name="startsAt" type="date" defaultValue={campaign?.startsAt?.slice(0, 10)} /><Input label="End date" name="endsAt" type="date" defaultValue={campaign?.endsAt?.slice(0, 10)} /><div className="sm:col-span-2"><TextArea label="Instructions for promoters" name="requirements" defaultValue={String(targeting.requirements ?? "")} placeholder="Optional: key message, hashtags, talking points, or anything promoters should include." /></div>
        <div className="sm:col-span-2"><p className="text-sm font-bold">Campaign image or video <Required /></p><label className={`mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition ${selectedFile || creatives.length ? "border-green-200 bg-green-50" : "border-black/20 hover:border-[#6558ff] hover:bg-[#faf9ff]"}`}>{busy && statusText.includes("Uploading") ? <LoaderCircle className="size-7 animate-spin text-[#6558ff]" /> : selectedFile || creatives.length ? <Check className="size-7 text-green-700" /> : <Upload className="size-7 text-[#6558ff]" />}<span className="mt-3 text-sm font-black">{selectedFile?.name ?? creatives.at(-1)?.originalFilename ?? "Choose an image or video"}</span><span className="mt-1 text-xs text-black/42">JPEG, PNG, WebP, or MP4 · maximum 25 MB</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" disabled={busy} onChange={(event) => { const file = event.target.files?.[0] ?? null; setSelectedFile(file); setError(""); }} /></label></div>
      </div><button disabled={busy} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] text-sm font-bold text-white disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> {statusText}</> : <>Review campaign <ArrowRight className="size-4" /></>}</button><p className="mt-3 text-center text-xs text-black/38"><Required /> Required fields</p>
    </form> : campaign && <section className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_12px_45px_rgba(21,23,15,.04)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6558ff]">Ready to submit</p><h2 className="mt-3 text-3xl font-black">{campaign.title}</h2><p className="mt-3 text-sm leading-6 text-black/50">{campaign.description}</p><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Summary label="Category" value={String(campaign.targeting.category)} /><Summary label="Location" value={String(campaign.targeting.location)} /><Summary label="Reward" value={formatMoney(campaign.unitPriceKobo, campaign.currency)} /><Summary label="Target" value={`${campaign.targetQuantity} results`} /><Summary label="Budget" value={formatMoney(campaign.budgetKobo, campaign.currency)} /></div><div className="mt-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4"><ImagePlus className="size-5 text-green-700" /><div className="min-w-0"><p className="truncate text-sm font-bold">{creatives.at(-1)?.originalFilename}</p><p className="text-xs text-black/45">Image or video ready</p></div></div><p className="mt-6 rounded-xl bg-[#f6f5f0] p-4 text-sm leading-6 text-black/55">We’ll review the image or video, campaign details, and budget before it can go live.</p><div className="mt-7 flex gap-3"><button type="button" disabled={busy} onClick={() => setReviewing(false)} className="min-h-12 flex-1 rounded-xl border border-black/10 font-bold">Edit</button><button type="button" onClick={submit} disabled={busy} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#171811] font-bold text-white disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Submitting…</> : "Submit for review"}</button></div></section>}
  </div>;
}

function Required() { return <span className="text-red-600" aria-hidden="true">*</span>; }
function Input({ label, required, ...input }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; min?: string; placeholder?: string }) { return <label className="block text-sm font-bold">{label}{required && <> <Required /></>}<input {...input} required={required} aria-label={label} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function Select({ label, name, options, defaultValue, required }: { label: string; name: string; options: string[]; defaultValue?: string; required?: boolean }) { return <label className="block text-sm font-bold">{label}{required && <> <Required /></>}<select name={name} defaultValue={defaultValue} required={required} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10"><option value="" disabled>Select an option</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>; }
function TextArea({ label, name, defaultValue, required, placeholder }: { label: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string }) { return <label className="block text-sm font-bold">{label}{required && <> <Required /></>}<textarea name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} className="mt-2 min-h-28 w-full rounded-xl border border-black/12 p-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f6f5f0] p-4"><p className="text-xs font-bold uppercase text-black/35">{label}</p><p className="mt-2 font-black">{value}</p></div>; }
