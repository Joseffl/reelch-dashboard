"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, FileCheck2, LoaderCircle, Megaphone, Upload, UserRound } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";

type Role = "business" | "promoter";
type DocumentRecord = { id: string; kind: string; originalFilename: string; sizeBytes: number };
type Status = { role: Role; profile: Record<string, unknown>; socials?: Array<{ platform: string; handle: string }>; verification: { status: string }; documents: DocumentRecord[] };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const result = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(result.message ?? "Something went wrong");
  return result;
}

function Field({ label, name, defaultValue, required, type = "text", placeholder }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-sm font-bold">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>;
}

function StepCard({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_14px_50px_rgba(20,22,15,0.06)] sm:p-7">{children}</section>;
}

export function OnboardingFlow({ role }: { role: Role }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const steps = role === "business" ? ["Business profile", "Goals", "Verification", "Review"] : ["Creator profile", "Audience", "Verification", "Review"];

  useEffect(() => {
    api<Status>("/onboarding/status").then((data) => {
      if (data.role !== role) return router.replace(`/onboarding/${data.role}`);
      if (data.profile.onboardingCompletedAt && ["pending", "approved"].includes(data.verification.status)) return router.replace(`/${role}`);
      setStatus(data);
    }).catch(() => router.replace(`/login?next=/onboarding/${role}`));
  }, [role, router]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    for (const key of ["campaignGoals", "niches", "languages", "preferredCampaignTypes"]) {
      if (typeof values[key] === "string") values[key] = values[key].split(",").map((item: string) => item.trim()).filter(Boolean) as never;
    }
    try {
      await api(`/onboarding/${role}/profile`, { method: "PATCH", body: JSON.stringify(values) });
      setStatus(await api<Status>("/onboarding/status")); setStep((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save"); }
    finally { setBusy(false); }
  }

  async function saveAudience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const preferences = String(form.get("preferredCampaignTypes") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      if (preferences.length) await api("/onboarding/promoter/profile", { method: "PATCH", body: JSON.stringify({ preferredCampaignTypes: preferences }) });
      await api("/onboarding/promoter/social-accounts", { method: "POST", body: JSON.stringify({ platform: form.get("platform"), handle: form.get("handle"), audienceSize: Number(form.get("audienceSize")) }) });
      setStatus(await api<Status>("/onboarding/status")); setStep(2);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save channel"); }
    finally { setBusy(false); }
  }

  async function uploadDocument(kind: string, file: File) {
    setBusy(true); setError("");
    try {
      const signed = await api<{ key: string; uploadUrl: string; headers: Record<string, string> }>("/onboarding/uploads/presign", { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }) });
      const upload = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: file });
      if (!upload.ok) throw new Error("The document could not be uploaded to storage");
      await api("/onboarding/uploads/complete", { method: "POST", body: JSON.stringify({ key: signed.key, kind, filename: file.name, contentType: file.type, sizeBytes: file.size }) });
      setStatus(await api<Status>("/onboarding/status"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setError("");
    try { await api("/onboarding/submit", { method: "POST", body: "{}" }); router.replace(`/${role}`); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit verification"); setBusy(false); }
  }

  if (!status) return <main className="grid min-h-screen place-items-center bg-[#171811] text-white"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-[#9cff57]" /><p className="mt-4 text-sm text-white/55">Loading your setup…</p></div></main>;
  const profile = status.profile;

  return <main className="min-h-screen bg-[#f6f5f0] text-[#171811]">
    <header className="border-b border-black/10 px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/" className="text-xl font-black tracking-[-0.08em]">REELCH<span className="text-[#6558ff]">.</span></Link><span className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">{role} setup</span></div></header>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[270px_minmax(0,1fr)] lg:py-14">
      <aside><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6558ff]">Your workspace</p><h1 className="mt-3 text-4xl font-black tracking-[-0.055em]">Let’s get you ready.</h1><p className="mt-4 text-sm leading-6 text-black/50">Your progress is saved between steps. Submitted details will be reviewed by Reelch operations.</p>
        <ol className="mt-8 grid grid-cols-4 gap-2 lg:grid-cols-1">{steps.map((label, index) => <li key={label} className={`flex items-center gap-3 rounded-xl p-2 text-xs font-bold sm:text-sm ${index === step ? "bg-white shadow-sm" : "text-black/35"}`}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${index < step ? "bg-[#9cff57] text-black" : index === step ? "bg-[#6558ff] text-white" : "bg-black/5"}`}>{index < step ? <Check className="size-4" /> : index + 1}</span><span className="hidden lg:block">{label}</span></li>)}</ol>
      </aside>
      <div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {step === 0 && <StepCard><div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-xl ${role === "business" ? "bg-[#9cff57]" : "bg-violet-300"}`}>{role === "business" ? <Building2 className="size-5" /> : <UserRound className="size-5" />}</span><div><h2 className="text-xl font-black">{steps[0]}</h2><p className="text-sm text-black/45">Tell us who you are.</p></div></div>
          <form onSubmit={saveProfile} className="mt-7 grid gap-5 sm:grid-cols-2">{role === "business" ? <>
            <Field label="Business name" name="name" defaultValue={String(profile.name ?? "")} required /><Field label="Industry" name="industry" defaultValue={String(profile.industry ?? "")} placeholder="Fintech, retail, education…" required /><Field label="Website" name="website" type="url" defaultValue={String(profile.website ?? "")} placeholder="https://" /><Field label="Phone number" name="phone" type="tel" defaultValue={String(profile.phone ?? "")} required /><Field label="Country" name="country" defaultValue={String(profile.country ?? "NG")} required /><Field label="Company size" name="companySize" defaultValue={String(profile.companySize ?? "")} placeholder="1–10, 11–50…" /><div className="sm:col-span-2"><Field label="Business address" name="address" defaultValue={String(profile.address ?? "")} required /></div><label className="block text-sm font-bold sm:col-span-2">About the business<textarea name="description" defaultValue={String(profile.description ?? "")} className="mt-2 min-h-28 w-full rounded-xl border border-black/12 bg-white p-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>
          </> : <>
            <Field label="Username" name="username" defaultValue={String(profile.username ?? "")} required /><Field label="Phone number" name="phone" type="tel" defaultValue={String(profile.phone ?? "")} required /><Field label="Country" name="country" defaultValue={String(profile.country ?? "NG")} required /><Field label="City" name="city" defaultValue={String(profile.city ?? "")} required /><Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={String(profile.dateOfBirth ?? "")} required /><Field label="Languages" name="languages" defaultValue={Array.isArray(profile.languages) ? profile.languages.join(", ") : ""} placeholder="English, Yoruba" /><div className="sm:col-span-2"><Field label="Content niches" name="niches" defaultValue={Array.isArray(profile.niches) ? profile.niches.join(", ") : ""} placeholder="Fashion, technology, food" required /></div><label className="block text-sm font-bold sm:col-span-2">Bio<textarea name="bio" required defaultValue={String(profile.bio ?? "")} className="mt-2 min-h-28 w-full rounded-xl border border-black/12 bg-white p-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>
          </>}<button disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white sm:col-span-2">Save and continue <ArrowRight className="size-4" /></button></form>
        </StepCard>}

        {step === 1 && role === "business" && <StepCard><Megaphone className="size-7 text-[#6558ff]" /><h2 className="mt-4 text-2xl font-black">What do you want to achieve?</h2><p className="mt-2 text-sm text-black/48">Separate multiple goals with commas. We’ll use them to tailor campaign setup.</p><form onSubmit={saveProfile} className="mt-7"><Field label="Campaign goals" name="campaignGoals" defaultValue={Array.isArray(profile.campaignGoals) ? profile.campaignGoals.join(", ") : ""} placeholder="Generate leads, drive sign-ups, increase visibility" required /><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Registration number" name="registrationNumber" defaultValue={String(profile.registrationNumber ?? "")} required /><Field label="Business address" name="address" defaultValue={String(profile.address ?? "")} required /></div><StepButtons back={() => setStep(0)} busy={busy} /></form></StepCard>}

        {step === 1 && role === "promoter" && <StepCard><h2 className="text-2xl font-black">Add your main channel</h2><p className="mt-2 text-sm text-black/48">Audience information is labelled self-reported until verified.</p>{status.socials?.length ? <div className="mt-5 rounded-xl bg-[#f6f5f0] p-4 text-sm font-bold">Added: {status.socials.map((item) => `${item.platform} · ${item.handle}`).join(", ")}</div> : null}<form onSubmit={saveAudience} className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Platform" name="platform" placeholder="Instagram, TikTok, X…" required /><Field label="Handle or profile URL" name="handle" required /><Field label="Audience size" name="audienceSize" type="number" required /><Field label="Preferred campaigns" name="preferredCampaignTypes" placeholder="Sign-ups, visibility" /><div className="sm:col-span-2"><StepButtons back={() => setStep(0)} busy={busy} /></div></form></StepCard>}

        {step === 2 && <StepCard><FileCheck2 className="size-7 text-[#6558ff]" /><h2 className="mt-4 text-2xl font-black">Verification documents</h2><p className="mt-2 text-sm leading-6 text-black/48">PDF, JPEG, PNG, or WebP. Maximum 10 MB per file. Files remain private.</p><div className="mt-7 space-y-4">{(role === "business" ? [{ kind: "business_registration", label: "Business registration document" }, { kind: "representative_id", label: "Representative’s government ID" }] : [{ kind: "government_id", label: "Government-issued ID" }]).map((document) => { const existing = status.documents.find((item) => item.kind === document.kind); return <label key={document.kind} className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-black/20 p-4 hover:border-[#6558ff]"><span className="grid size-10 place-items-center rounded-lg bg-black/5">{existing ? <Check className="size-5 text-green-700" /> : <Upload className="size-5" />}</span><span className="min-w-0"><span className="block text-sm font-bold">{document.label}</span><span className="block truncate text-xs text-black/42">{existing ? existing.originalFilename : "Choose a document"}</span></span><input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(document.kind, file); }} /></label>; })}</div><StepButtons back={() => setStep(1)} busy={busy} next={() => setStep(3)} nextDisabled={role === "business" ? status.documents.filter((item) => ["business_registration", "representative_id"].includes(item.kind)).length < 2 : !status.documents.some((item) => item.kind === "government_id")} /></StepCard>}

        {step === 3 && <StepCard><span className="grid size-12 place-items-center rounded-xl bg-[#9cff57]"><Check className="size-6" /></span><h2 className="mt-5 text-2xl font-black">Ready for review</h2><p className="mt-2 max-w-xl text-sm leading-6 text-black/48">Submit your details to Reelch operations. You’ll be able to enter your workspace while the review is pending, but restricted actions remain locked until approval.</p><div className="mt-6 rounded-xl bg-[#f6f5f0] p-4 text-sm"><p className="font-bold">{status.documents.length} document{status.documents.length === 1 ? "" : "s"} attached</p><p className="mt-1 text-black/45">Verification status: {status.verification.status.replaceAll("_", " ")}</p></div><div className="mt-7 flex gap-3"><button type="button" onClick={() => setStep(2)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-black/12 font-bold"><ArrowLeft className="size-4" /> Back</button><button type="button" disabled={busy} onClick={submit} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit for review"}<ArrowRight className="size-4" /></button></div></StepCard>}
      </div>
    </div>
  </main>;
}

function StepButtons({ back, busy, next, nextDisabled }: { back: () => void; busy: boolean; next?: () => void; nextDisabled?: boolean }) {
  return <div className="mt-7 flex gap-3"><button type="button" onClick={back} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-black/12 text-sm font-bold"><ArrowLeft className="size-4" /> Back</button><button type={next ? "button" : "submit"} onClick={next} disabled={busy || nextDisabled} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white disabled:opacity-35">Continue <ArrowRight className="size-4" /></button></div>;
}
