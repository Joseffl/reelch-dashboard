"use client";

import { AlertTriangle, BadgeCheck, CircleHelp, Sparkles, XCircle } from "lucide-react";

export type AiReview = {
  id: string;
  provider: string;
  model: string;
  status: "completed" | "failed";
  decision: "auto_approve" | "needs_review";
  assurance: "platform_verified" | "evidence_reviewed";
  contentMatch: number | null;
  fraudRisk: "low" | "medium" | "high";
  reasons: string[];
  error?: string | null;
  createdAt: string;
  assessment: null | {
    summary: string;
    requirements: Array<{ label: string; status: "passed" | "failed" | "unverified"; evidence: string }>;
    extracted: { handle?: string; views?: number; hashtags: string[] };
    fraudSignals: Array<{ signal: string; severity: "low" | "medium" | "high"; evidence: string }>;
    recommendation: "approve" | "review" | "reject";
  };
};

export const assuranceLabel = { platform_verified: "Platform verified", evidence_reviewed: "Evidence reviewed" } as const;
const riskStyle = { low: "bg-lime-100 text-green-800", medium: "bg-amber-100 text-amber-800", high: "bg-red-100 text-red-700" } as const;
const statusIcon = {
  passed: <BadgeCheck className="size-4 shrink-0 text-green-700" />,
  failed: <XCircle className="size-4 shrink-0 text-red-600" />,
  unverified: <CircleHelp className="size-4 shrink-0 text-black/35" />,
};

// Content match, fraud risk and assurance stay separate: none of them alone decides a payout.
export function AiReviewPanel({ review }: { review: AiReview | null }) {
  if (!review) {
    return <p className="mt-5 rounded-2xl bg-black/[.03] p-4 text-xs text-black/45">AI verification has not run for this proof yet.</p>;
  }
  const assessment = review.assessment;
  return (
    <section className="mt-5 rounded-2xl border border-[#6558ff]/15 bg-[#f6f5ff] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-[#6558ff]" />
        <p className="text-xs font-black uppercase tracking-[.12em] text-[#5145e5]">AI verification</p>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-[0.68rem] font-black ${review.decision === "auto_approve" ? "bg-lime-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {review.decision === "auto_approve" ? "Auto-approved" : "Needs review"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[0.65rem] font-bold uppercase text-black/40">Content match</p>
          <p className="mt-1 text-xl font-black">{review.contentMatch ?? "—"}{review.contentMatch !== null && <span className="text-xs text-black/40">%</span>}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[0.65rem] font-bold uppercase text-black/40">Fraud risk</p>
          <p className={`mx-auto mt-1.5 w-fit rounded-full px-2.5 py-0.5 text-sm font-black capitalize ${riskStyle[review.fraudRisk]}`}>{review.fraudRisk}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[0.65rem] font-bold uppercase text-black/40">Assurance</p>
          <p className="mt-1.5 text-xs font-black">{assuranceLabel[review.assurance]}</p>
        </div>
      </div>

      {assessment?.summary && <p className="mt-4 text-sm leading-6 text-black/70">{assessment.summary}</p>}
      {review.error && <p className="mt-4 rounded-xl bg-white p-3 text-xs text-black/55">{review.error}</p>}

      {!!assessment?.requirements.length && (
        <ul className="mt-4 space-y-2">
          {assessment.requirements.map((item, index) => (
            <li key={index} className="flex gap-2 text-xs leading-5">
              {statusIcon[item.status]}
              <span><b className="text-black/80">{item.label}</b>{item.evidence && <span className="text-black/50"> · {item.evidence}</span>}</span>
            </li>
          ))}
        </ul>
      )}

      {!!assessment?.fraudSignals.length && (
        <ul className="mt-4 space-y-2 rounded-xl bg-white p-3">
          {assessment.fraudSignals.map((signal, index) => (
            <li key={index} className="flex gap-2 text-xs leading-5">
              <AlertTriangle className={`size-4 shrink-0 ${signal.severity === "high" ? "text-red-600" : signal.severity === "medium" ? "text-amber-600" : "text-black/35"}`} />
              <span><b>{signal.signal}</b>{signal.evidence && <span className="text-black/50"> · {signal.evidence}</span>}</span>
            </li>
          ))}
        </ul>
      )}

      {(assessment?.extracted.handle || assessment?.extracted.views !== undefined) && (
        <p className="mt-4 text-xs text-black/45">
          Read from evidence: {[
            assessment?.extracted.handle && `@${assessment.extracted.handle}`,
            assessment?.extracted.views !== undefined && `${assessment.extracted.views.toLocaleString()} views`,
          ].filter(Boolean).join(" · ")}
        </p>
      )}

      {review.decision === "needs_review" && !!review.reasons.length && (
        <div className="mt-4 border-t border-[#6558ff]/10 pt-3">
          <p className="text-[0.65rem] font-bold uppercase text-black/40">Why a person needs to review this</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-black/60">
            {review.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-4 text-[0.65rem] text-black/35">{review.model} · {new Date(review.createdAt).toLocaleString()}</p>
    </section>
  );
}
