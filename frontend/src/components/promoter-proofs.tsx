"use client";

import { useErrorToast, useSuccessToast } from "@/components/toasts";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileCheck2, Info, LoaderCircle, Send, Upload } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Assignment = { assignment: { id: string; status: string }; campaign: { id: string; title: string; status: string; targeting: Record<string, unknown> }; businessName: string };
type ProofRow = { proof: { id: string; platform: string; submittedUrl?: string; claimedViews?: number; status: string; verificationMethod: string; createdAt: string; reviewReason?: string }; campaignTitle: string; businessName: string; slotStatus: string; resubmitBy: string | null; aiReview: null | { decision: string; assurance: string; contentMatch: number | null; summary?: string; reasons: string[] } };
type Platform = "instagram" | "tiktok" | "x" | "whatsapp";

const platforms: Array<{ id: Platform; label: string }> = [{ id: "tiktok", label: "TikTok" }, { id: "instagram", label: "Instagram" }, { id: "x", label: "X" }, { id: "whatsapp", label: "WhatsApp" }];
const linkPlaceholder: Record<Platform, string> = { tiktok: "https://www.tiktok.com/@you/video/…", instagram: "https://www.instagram.com/p/…", x: "https://x.com/you/status/…", whatsapp: "" };

async function json(response: Response) { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || "Request failed"); return body; }

// How a proof on each platform is checked, so promoters know what to send.
function guidance(platform: Platform, tiktokConnected: boolean) {
  if (platform === "tiktok" && tiktokConnected) return { link: true, screenshot: false, text: "Your TikTok is connected. Paste the video link and Reelch reads the views straight from TikTok. No screenshot needed." };
  if (platform === "tiktok") return { link: true, screenshot: true, text: "Paste the video link and upload a screenshot that shows the views. Connect TikTok in your profile to skip the screenshot.", connect: true };
  if (platform === "whatsapp") return { link: false, screenshot: true, text: "Upload a screenshot of your status that shows how many people viewed it." };
  if (platform === "x") return { link: true, screenshot: true, text: "Paste the X post link and upload a screenshot that shows the views." };
  return { link: true, screenshot: true, text: "Paste the Instagram link. Reelch confirms the post exists with Instagram and reads the views from your screenshot." };
}

const assuranceLabel = (assurance: string) => assurance === "platform_verified" ? "Platform verified" : "Evidence reviewed";

export function PromoterProofs() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [, setError] = useErrorToast();
  const setNotice = useSuccessToast();

  const load = useCallback(() => Promise.all([
    fetch(`${apiUrl}/promoter/workspace`, { credentials: "include" }).then(json),
    fetch(`${apiUrl}/promoter/proofs`, { credentials: "include" }).then(json),
    fetch(`${apiUrl}/promoter/social/connections`, { credentials: "include" }).then(json).catch(() => ({ connections: [] })),
  ]).then(([workspace, rows, social]) => {
    setAssignments(workspace.assignments); setProofs(rows);
    setTiktokConnected((social.connections ?? []).some((connection: { provider: string }) => connection.provider === "tiktok"));
  }).catch(error => setError(error.message)), [setError]);
  useEffect(() => { void load(); }, [load]);

  const open = assignments.filter(item => ["accepted", "active"].includes(item.assignment.status) && !["completed", "cancelled"].includes(item.campaign.status));
  const selected = open.find(item => item.assignment.id === assignmentId);
  const allowed = Array.isArray(selected?.campaign.targeting.platforms) ? (selected.campaign.targeting.platforms as string[]).map(value => value.toLowerCase()) : platforms.map(item => item.id);
  const options = platforms.filter(item => allowed.includes(item.id));
  const current: Platform = options.some(item => item.id === platform) ? platform : (options[0]?.id ?? "tiktok");
  const rules = guidance(current, tiktokConnected);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget; const form = new FormData(formElement); const file = form.get("evidence") as File;
    try {
      let upload: Record<string, unknown> = {};
      if (file?.size) {
        const signed = await fetch(`${apiUrl}/promoter/assignments/${assignmentId}/proofs/presign`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }) }).then(json);
        const sent = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: file });
        if (!sent.ok) throw new Error("Evidence upload failed");
        upload = { storageKey: signed.key, filename: file.name, contentType: file.type, sizeBytes: file.size };
      }
      await fetch(`${apiUrl}/promoter/assignments/${assignmentId}/proofs`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform: current, submittedUrl: String(form.get("submittedUrl") || "") || undefined, claimedViews: Number(form.get("claimedViews") || 0), ...upload }) }).then(json);
      formElement.reset(); setFileName(""); setNotice("Proof submitted for verification."); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not submit proof"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form onSubmit={submit} className="rounded-3xl border border-black/[.08] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-black">Submit campaign proof</h2>
      <p className="mt-2 text-sm text-black/45">One approved submission earns one campaign reward.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold">Campaign
          <select name="assignmentId" required value={assignmentId} onChange={event => setAssignmentId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-3">
            <option value="">Select campaign</option>
            {open.map(item => <option key={item.assignment.id} value={item.assignment.id}>{item.campaign.title}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Platform
          <select name="platform" required value={current} onChange={event => setPlatform(event.target.value as Platform)} className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-3">
            {options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="flex gap-2.5 rounded-xl bg-[#f6f5ff] p-3.5 text-xs leading-5 text-[#3f36b8] sm:col-span-2">
          {current === "tiktok" && tiktokConnected ? <BadgeCheck className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
          <p>{rules.text}{rules.connect && <> <Link href="/promoter/profile" className="font-bold underline underline-offset-2">Connect TikTok</Link></>}</p>
        </div>
        {rules.link && <label className="text-sm font-bold sm:col-span-2">Public post link
          <input name="submittedUrl" type="url" required placeholder={linkPlaceholder[current]} className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 font-normal" />
        </label>}
        <label className="text-sm font-bold">Views you are claiming
          <input name="claimedViews" type="number" min="0" inputMode="numeric" placeholder="e.g. 1840" className="mt-2 h-12 w-full rounded-xl border border-black/10 px-4 font-normal" />
        </label>
        <label className="text-sm font-bold">Screenshot of your views {!rules.screenshot && <span className="font-normal text-black/40">Optional</span>}
          <span className="mt-2 flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 px-4 text-sm font-medium">
            <Upload className="size-4 shrink-0" /><span className="min-w-0 truncate">{fileName || "Choose file"}</span>
            <input name="evidence" type="file" required={rules.screenshot} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFileName(event.target.files?.[0]?.name ?? "")} className="sr-only" />
          </span>
        </label>
      </div>
      <button disabled={busy || !open.length} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Submit proof</button>
    </form>

    <section>
      <h2 className="text-xl font-black">Your submissions</h2>
      <div className="mt-4 space-y-3">
        {proofs.map(row => <article key={row.proof.id} className="rounded-2xl border border-black/[.08] bg-white p-5">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-1 size-5 text-[#6558ff]" />
            <div><p className="font-black">{row.campaignTitle}</p><p className="mt-1 text-xs text-black/45">{platforms.find(item => item.id === row.proof.platform)?.label ?? row.proof.platform}{row.aiReview && ` · ${assuranceLabel(row.aiReview.assurance)}`}</p></div>
            <span className="ml-auto rounded-full bg-black/5 px-3 py-1 text-xs font-bold capitalize">{row.proof.status.replaceAll("_", " ")}</span>
          </div>
          {row.proof.submittedUrl && <a href={row.proof.submittedUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#6558ff]">Open post <ExternalLink className="size-3" /></a>}
          {row.aiReview && <div className="mt-3 rounded-xl bg-[#f6f5ff] p-3 text-xs leading-5 text-black/65">
            <p className="font-black text-[#5145e5]">AI verification · {row.aiReview.decision === "auto_approve" ? "passed" : "sent to a reviewer"}{row.aiReview.contentMatch !== null && ` · ${row.aiReview.contentMatch}% match`}</p>
            {row.aiReview.summary && <p className="mt-1">{row.aiReview.summary}</p>}
            {row.aiReview.decision !== "auto_approve" && row.proof.status !== "approved" && !!row.aiReview.reasons.length && <p className="mt-1 text-black/50">{row.aiReview.reasons[0]}</p>}
          </div>}
          {row.proof.reviewReason && <p className={`mt-3 rounded-xl p-3 text-xs ${row.proof.status === "approved" ? "bg-lime-50 text-green-800" : "bg-red-50 text-red-700"}`}>{row.proof.reviewReason}</p>}
          {row.resubmitBy && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">Submit a new proof by {new Date(row.resubmitBy).toLocaleString()} to keep your slot.</p>}
          {row.proof.status === "rejected" && row.slotStatus === "removed" && <p className="mt-3 rounded-xl bg-black/5 p-3 text-xs font-bold text-black/60">Your 24 hours to resubmit ended, so this slot was released.</p>}
        </article>)}
        {!proofs.length && <p className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/45">No proof submissions yet.</p>}
      </div>
    </section>
  </div>;
}
