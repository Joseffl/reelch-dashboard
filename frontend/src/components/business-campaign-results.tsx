"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, ExternalLink, FileCheck2, LoaderCircle, MousePointerClick, RotateCcw, Sparkles, Users, WalletCards } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast, useErrorToast } from "@/components/toasts";
import { assuranceLabel } from "@/components/ai-review-panel";
import { formatMoney } from "@/lib/money";

export type ResultsData = {
  fundedKobo: number;
  spentKobo: number;
  remainingKobo: number;
  refund: { status: "none" | "pending" | "completed" | "failed"; amountKobo: number; destination: "paypal" | "wallet" | null; reference: string | null; error: string | null };
  slotsTaken: number;
  clicks: number;
  promoters: Array<{ id: string; status: string; targetQuantity: number; verifiedResults: number; joinedAt: string; username: string; displayName: string; clicks: number }>;
  proofs: Array<{ id: string; platform: string; status: string; submittedUrl?: string | null; createdAt: string; username: string; displayName: string; ai: null | { assurance: keyof typeof assuranceLabel; contentMatch: number | null } }>;
};
export type StatusChange = { id: string; toStatus: string; createdAt: string };
type Campaign = { id: string; title: string; description: string; currency: string; unitPriceKobo: number; targetQuantity: number; budgetKobo: number; verifiedQuantity?: number; status: string; targeting: Record<string, unknown> };

const statusNote: Record<string, string> = {
  pending_review: "Reelch is reviewing this campaign. You will be told when it is approved.",
  approved: "Approved. Fund the campaign to take it live.",
  funding_required: "Approved. Fund the campaign to take it live.",
  scheduled: "Funded and scheduled to go live.",
  live: "Live. Promoters can join, and every proof is checked before it is paid.",
  paused: "Paused. Promoters cannot join for now.",
  completed: "This campaign has finished.",
  cancelled: "This campaign was cancelled.",
};
const proofTone: Record<string, string> = { approved: "bg-lime-100 text-green-800", rejected: "bg-red-100 text-red-700", under_review: "bg-amber-100 text-amber-800", submitted: "bg-black/5 text-black/60" };
const label = (value: string) => value.replaceAll("_", " ");

function Stat({ icon, name, value, note }: { icon: React.ReactNode; name: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-bold text-black/45">{icon}{name}</div>
      <p className="mt-2 text-2xl font-black tracking-[-.03em]">{value}</p>
      <p className="mt-1 text-xs text-black/45">{note}</p>
    </div>
  );
}

export function CampaignResults({ campaign, results, history, onChanged }: { campaign: Campaign; results: ResultsData; history: StatusChange[]; onChanged: () => void }) {
  const [closing, setClosing] = useState(false);
  const [, setError] = useErrorToast();

  async function close(confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setClosing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/business/campaigns/${campaign.id}/close`, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Could not end the campaign");
      if (confirmation) toast.success("Campaign ended.");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not end the campaign");
    } finally {
      setClosing(false);
    }
  }

  const money = (value: number) => formatMoney(value, campaign.currency);
  const verified = results.promoters.reduce((total, promoter) => total + promoter.verifiedResults, 0);
  const progress = campaign.targetQuantity ? Math.min(100, Math.round((verified / campaign.targetQuantity) * 100)) : 0;
  const needsFunding = ["approved", "funding_required"].includes(campaign.status);
  const targeting = campaign.targeting;
  const platforms = Array.isArray(targeting.platforms) ? targeting.platforms.map(String) : [];
  const pendingProofs = results.proofs.filter((proof) => ["submitted", "under_review"].includes(proof.status)).length;
  const { refund } = results;
  const refundTo = refund.destination === "paypal" ? "PayPal" : "your Reelch wallet";
  const retryable = refund.destination === "paypal" && ["pending", "failed"].includes(refund.status);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/business/campaigns" className="inline-flex items-center gap-2 text-sm font-bold text-black/55"><ArrowLeft className="size-4" /> Campaigns</Link>

      <section className="rounded-[1.6rem] bg-[#171811] p-5 text-white sm:p-7">
        <span className="rounded-full bg-[#9cff57] px-3 py-1 text-xs font-black capitalize text-black">{label(campaign.status)}</span>
        <h2 className="mt-4 text-2xl font-black tracking-[-.035em] sm:text-3xl">{campaign.title}</h2>
        <p className="mt-2 text-sm text-white/55">{statusNote[campaign.status]}</p>
        <div className="mt-6 flex items-end justify-between gap-3">
          <p className="text-3xl font-black tracking-[-.04em]">{verified}<span className="text-base font-bold tracking-normal text-white/45"> of {campaign.targetQuantity} posts verified</span></p>
          <p className="text-sm font-black text-[#9cff57]">{progress}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#9cff57]" style={{ width: `${progress}%` }} /></div>
        {campaign.status === "live" && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <button onClick={() => close(`End this campaign? Promoters will stop submitting proof, and ${money(results.remainingKobo)} of unspent budget goes back to how you paid. This cannot be undone.`)} disabled={closing || pendingProofs > 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-bold text-white disabled:opacity-40">
              {closing ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} End campaign and refund {money(results.remainingKobo)}
            </button>
            {pendingProofs > 0 && <p className="mt-2 text-xs text-white/50">{pendingProofs} submitted proof{pendingProofs === 1 ? " is" : "s are"} still being reviewed. You can end the campaign once {pendingProofs === 1 ? "it is" : "they are"} decided.</p>}
          </div>
        )}
        {refund.status !== "none" && (
          <div className={`mt-5 rounded-xl p-3 text-sm font-bold ${refund.status === "completed" ? "bg-[#9cff57] text-black" : refund.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-900"}`}>
            {refund.status === "completed" && <p>{money(refund.amountKobo)} refunded to {refundTo}.</p>}
            {refund.status === "pending" && <p>{money(refund.amountKobo)} refund is on its way to {refundTo}.</p>}
            {refund.status === "failed" && <p>{money(refund.amountKobo)} refund did not go through. {refund.error}</p>}
            {refund.reference && <p className="mt-1 break-all text-xs font-medium opacity-70">Reference {refund.reference}</p>}
            {retryable && <button onClick={() => close()} disabled={closing} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#171811] px-3 text-xs font-bold text-white disabled:opacity-50">{closing && <LoaderCircle className="size-3 animate-spin" />}{refund.status === "failed" ? "Try again" : "Check refund"}</button>}
          </div>
        )}
        {needsFunding && <Link href="/business/wallet" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ffc439] px-5 text-sm font-black text-[#111]">Fund campaign <ArrowRight className="size-4" /></Link>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<WalletCards className="size-4" />} name="Paid for results" value={money(results.spentKobo)} note={`of ${money(campaign.budgetKobo)} budget`} />
        <Stat icon={<WalletCards className="size-4" />} name="Held in escrow" value={money(results.remainingKobo)} note={refund.status === "none" ? "Only released for verified posts" : `${money(refund.amountKobo)} refunded`} />
        <Stat icon={<Users className="size-4" />} name="Promoter slots" value={`${results.slotsTaken} of ${campaign.targetQuantity}`} note={campaign.status === "live" ? "Unused slots reopen automatically" : "Taken while the campaign ran"} />
        <Stat icon={<MousePointerClick className="size-4" />} name="Link clicks" value={results.clicks.toLocaleString()} note="From promoter referral links" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-black">Submitted proof</h3>
            <div className="mt-4 divide-y divide-black/[.07]">
              {results.proofs.map((proof) => (
                <article key={proof.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileCheck2 className="size-4 shrink-0 text-[#6558ff]" />
                    <p className="min-w-0 text-sm font-black">{proof.displayName} <span className="font-medium text-black/45">@{proof.username}</span></p>
                    <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-bold capitalize ${proofTone[proof.status] ?? proofTone.submitted}`}>{label(proof.status)}</span>
                  </div>
                  <p className="mt-1 text-xs capitalize text-black/45">{proof.platform} · {new Date(proof.createdAt).toLocaleString()}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {proof.ai && <span className="inline-flex items-center gap-1 font-bold text-[#5145e5]"><Sparkles className="size-3" />{assuranceLabel[proof.ai.assurance]}{proof.ai.contentMatch !== null && ` · ${proof.ai.contentMatch}% match`}</span>}
                    {proof.submittedUrl && <a href={proof.submittedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#6558ff]">Open post <ExternalLink className="size-3" /></a>}
                  </div>
                </article>
              ))}
              {!results.proofs.length && <p className="py-8 text-center text-sm text-black/40">No proof has been submitted yet.</p>}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-black">Promoters</h3>
            <div className="mt-4 divide-y divide-black/[.07]">
              {results.promoters.map((promoter) => (
                <div key={promoter.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <p className="min-w-0 flex-1 basis-40 text-sm font-black">{promoter.displayName} <span className="font-medium text-black/45">@{promoter.username}</span></p>
                  <p className="text-xs text-black/50">{promoter.clicks.toLocaleString()} clicks</p>
                  <p className="inline-flex items-center gap-1 text-xs font-bold text-black/70">{promoter.verifiedResults > 0 && <BadgeCheck className="size-3.5 text-green-700" />}{promoter.verifiedResults} of {promoter.targetQuantity} verified</p>
                </div>
              ))}
              {!results.promoters.length && <p className="py-8 text-center text-sm text-black/40">No promoters have joined yet.</p>}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-black">Campaign brief</h3>
            <p className="mt-3 text-sm leading-6 text-black/60">{campaign.description}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-black/45">Reward per post</dt><dd className="font-black">{money(campaign.unitPriceKobo)}</dd></div>
              {Boolean(targeting.requiredHashtag) && <div className="flex justify-between gap-3"><dt className="text-black/45">Hashtag</dt><dd className="min-w-0 break-words font-black">{String(targeting.requiredHashtag)}</dd></div>}
              {Number(targeting.minimumViews) > 0 && <div className="flex justify-between gap-3"><dt className="text-black/45">Minimum views</dt><dd className="font-black">{Number(targeting.minimumViews).toLocaleString()}</dd></div>}
              {platforms.length > 0 && <div className="flex justify-between gap-3"><dt className="text-black/45">Platforms</dt><dd className="text-right font-black capitalize">{platforms.join(", ")}</dd></div>}
            </dl>
          </section>

          {history.length > 0 && (
            <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 sm:p-6">
              <h3 className="text-lg font-black">Status history</h3>
              <ol className="mt-4 space-y-3">
                {history.map((change) => (
                  <li key={change.id} className="flex justify-between gap-3 text-xs">
                    <span className="font-bold capitalize">{label(change.toStatus)}</span>
                    <span className="text-right text-black/45">{new Date(change.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
