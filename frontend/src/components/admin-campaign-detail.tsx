"use client";

import { useErrorToast, ErrorFallback } from "@/components/toasts";

import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, FileImage, LoaderCircle, Pause, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { formatMoney } from "@/lib/money";

type Detail = {
  campaign: { id: string; title: string; description: string; status: string; conversionType: string; currency: string; unitPriceKobo: number; targetQuantity: number; budgetKobo: number; targeting: Record<string, unknown>; startsAt?: string; endsAt?: string };
  business: { name: string; verificationStatus: string };
  creatives: Array<{ id: string; originalFilename: string; mimeType: string; sizeBytes: number }>;
  history: Array<{ id: string; fromStatus?: string; toStatus: string; reason?: string; createdAt: string }>;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
async function api<T>(path: string, init?: RequestInit) { const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init, headers: { "content-type": "application/json", ...init?.headers } }); const body = await response.json().catch(() => ({})) as T & { message?: string }; if (!response.ok) throw new Error(body.message ?? "Request failed"); return body; }
function date(value?: string) { return value ? new Date(value).toLocaleDateString() : "Not set"; }

export function AdminCampaignDetail({ campaignId }: { campaignId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(""); const [error, setError] = useErrorToast();
  const load = useCallback(() => api<Detail>(`/admin/campaigns/${campaignId}`).then(setDetail).catch(cause => setError(cause.message)), [campaignId, setError]);
  useEffect(() => { void load(); }, [load]);
  async function moderate(decision: "approve" | "reject" | "request_changes") { setBusy(decision); setError(""); try { await api(`/admin/campaigns/${campaignId}/moderate`, { method: "POST", body: JSON.stringify({ decision, reason }) }); await load(); setReason(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Decision failed"); } finally { setBusy(""); } }
  async function pause() { setBusy("pause"); try { await api(`/admin/campaigns/${campaignId}/pause`, { method: "POST", body: JSON.stringify({ reason }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to pause"); } finally { setBusy(""); } }
  async function view(id: string) { setBusy(id); try { const result = await api<{ url: string }>(`/admin/campaigns/${campaignId}/creatives/${id}/url`); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open image or video"); } finally { setBusy(""); } }
  if (!detail) return error ? <ErrorFallback /> : <DashboardSkeleton />;
  const campaign = detail.campaign; const instructions = typeof campaign.targeting.requirements === "string" ? campaign.targeting.requirements.trim() : ""; const destination = typeof campaign.targeting.destinationUrl === "string" ? campaign.targeting.destinationUrl : ""; const category = typeof campaign.targeting.category === "string" ? campaign.targeting.category : "Not set"; const location = typeof campaign.targeting.location === "string" ? campaign.targeting.location : "Anywhere in Nigeria"; const platforms = Array.isArray(campaign.targeting.platforms) ? campaign.targeting.platforms.map(String).join(", ") : "All platforms";
  return <div>
    <Link href="/admin/campaigns" className="inline-flex items-center gap-2 text-sm font-bold text-black/55"><ArrowLeft className="size-4" /> Campaign queue</Link>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#6558ff]">{detail.business.name}</p><h2 className="mt-2 text-3xl font-black">{campaign.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-black/50">{campaign.description}</p></div><span className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold capitalize">{campaign.status.replaceAll("_", " ")}</span></div></section>
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
          <h3 className="text-lg font-black">Campaign details</h3>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Datum label="Goal" value="Visibility" /><Datum label="Category" value={category} /><Datum label="Promoter location" value={location} /><Datum label="Publishing platforms" value={platforms} /><Datum label="Required hashtag" value={String(campaign.targeting.requiredHashtag || "None")} /><Datum label="Minimum views" value={Number(campaign.targeting.minimumViews || 0).toLocaleString()} /><Datum label="Reward per approved post" value={formatMoney(campaign.unitPriceKobo, campaign.currency)} /><Datum label="Number of posts" value={campaign.targetQuantity.toLocaleString()} /><Datum label="Total budget" value={formatMoney(campaign.budgetKobo, campaign.currency)} /><Datum label="Start date" value={date(campaign.startsAt)} /><Datum label="End date" value={date(campaign.endsAt)} />{destination && <Datum label="Campaign link" value={destination} />}</dl>
          {instructions && <div className="mt-5 rounded-xl bg-[#f6f5f0] p-4"><p className="text-xs font-bold uppercase text-black/35">Instructions for promoters</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{instructions}</p></div>}
        </section>
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6"><h3 className="text-lg font-black">Campaign images and videos</h3><div className="mt-5 space-y-3">{detail.creatives.map(item => <div key={item.id} className="flex items-center gap-4 rounded-xl border border-black/10 p-4"><span className="grid size-10 place-items-center rounded-lg bg-[#edeaff]"><FileImage className="size-5 text-[#6558ff]" /></span><div className="min-w-0"><p className="truncate text-sm font-bold">{item.originalFilename}</p><p className="text-xs text-black/40">{item.mimeType} · {(item.sizeBytes / 1024 / 1024).toFixed(2)} MB</p></div><button onClick={() => view(item.id)} disabled={busy === item.id} className="ml-auto inline-flex items-center gap-2 text-xs font-bold">{busy === item.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <>View <ExternalLink className="size-3.5" /></>}</button></div>)}</div></section>
      </div>
      <aside className="space-y-5">
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6 xl:sticky xl:top-6"><h3 className="text-lg font-black">Moderation</h3><p className="mt-2 text-sm text-black/45">Business verification: <strong className="capitalize">{detail.business.verificationStatus}</strong></p><label className="mt-5 block text-sm font-bold">Decision reason<textarea value={reason} onChange={event => setReason(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border border-black/12 p-3 text-sm" placeholder="Required for changes, rejection, or pause" /></label>{campaign.status === "pending_review" && <div className="mt-4 grid gap-2"><button disabled={!!busy} onClick={() => moderate("approve")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171811] text-sm font-bold text-white"><Check className="size-4" /> Approve for funding</button><button disabled={!!busy || !reason.trim()} onClick={() => moderate("request_changes")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-100 text-sm font-bold text-amber-900 disabled:opacity-40"><RotateCcw className="size-4" /> Request changes</button><button disabled={!!busy || !reason.trim()} onClick={() => moderate("reject")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-bold text-red-700 disabled:opacity-40"><X className="size-4" /> Reject campaign</button></div>}{campaign.status === "live" && <button disabled={!!busy || !reason.trim()} onClick={pause} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-100 text-sm font-bold text-amber-900 disabled:opacity-40"><Pause className="size-4" /> Pause campaign</button>}</section>
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6"><h3 className="text-lg font-black">Status history</h3><div className="mt-5 space-y-4">{detail.history.map(item => <div key={item.id} className="border-l-2 border-[#6558ff]/25 pl-4"><p className="text-sm font-bold capitalize">{item.fromStatus?.replaceAll("_", " ") ?? "Created"} → {item.toStatus.replaceAll("_", " ")}</p>{item.reason && <p className="mt-1 text-xs leading-5 text-black/50">{item.reason}</p>}<p className="mt-1 text-[.65rem] text-black/35">{new Date(item.createdAt).toLocaleString()}</p></div>)}</div></section>
      </aside>
    </div>
  </div>;
}
function Datum({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase text-black/35">{label}</dt><dd className="mt-1.5 break-words text-sm font-semibold">{value}</dd></div>; }
