"use client";

import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const countries = ["Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States", "Other"];
const platforms = ["Instagram", "TikTok", "X", "YouTube", "WhatsApp", "Facebook", "LinkedIn", "Other"];
const niches = ["Beauty", "Business", "Education", "Entertainment", "Fashion", "Finance", "Fitness", "Food", "Gaming", "Lifestyle", "Music", "Sports", "Technology", "Travel"];

export function PromoterWaitlistForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  function continueForm() {
    const form = formRef.current;
    if (!form) return;
    const firstStepFields = Array.from(form.querySelectorAll<HTMLElement>("[data-step='1'] input, [data-step='1'] select"));
    const invalid = firstStepFields.find(field => "reportValidity" in field && !(field as HTMLInputElement).reportValidity());
    if (!invalid) { setError(""); setStep(2); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) { continueForm(); return; }
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = { fullName: form.get("fullName"), email: form.get("email"), phone: form.get("phone"), country: form.get("country"), primaryPlatform: form.get("primaryPlatform"), profileUrl: form.get("profileUrl"), audienceSize: Number(form.get("audienceSize")), niches: form.getAll("niches") };
    try {
      const response = await fetch(`${apiUrl}/waitlist/promoters`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "We could not save your details");
      setComplete(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not save your details"); }
    finally { setBusy(false); }
  }

  if (complete) return <div className="grid min-h-[430px] place-items-center rounded-2xl bg-[#f8f7f2] p-8 text-center text-[#171811]"><div><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#a8e86f]"><Check className="size-7" /></span><h3 className="mt-6 text-3xl font-black tracking-[-.04em]">You’re on the list.</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-black/50">We’ll review your profile and contact you with the next onboarding cohort.</p></div></div>;

  return <form ref={formRef} onSubmit={submit} className="rounded-2xl bg-[#f8f7f2] p-6 text-[#171811] shadow-[0_20px_60px_rgba(0,0,0,.16)] sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-6"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#6255e7]">Join REELCH</p><h3 className="mt-2 text-2xl font-black tracking-[-.04em]">Tell us about your reach.</h3></div><span className="text-xs font-black text-black/35">{step} / 2</span></div>
    <div className="mt-7">
      <div data-step="1" className={step === 1 ? "grid gap-5" : "hidden"}><div className="grid gap-5 sm:grid-cols-2"><Field label="Your name" name="fullName" placeholder="Full name" required /><Field label="Email" name="email" type="email" placeholder="you@example.com" required /></div><PlatformPicker /><Field label="Profile link" name="profileUrl" placeholder="instagram.com/yourname" required /></div>
      <div data-step="2" className={step === 2 ? "grid gap-5" : "hidden"}><div className="grid gap-5 sm:grid-cols-2"><Field label="WhatsApp or phone" name="phone" type="tel" placeholder="+234…" required /><Select label="Country" name="country" options={countries} /></div><Field label="Audience size" name="audienceSize" type="number" placeholder="e.g. 2500" required /><fieldset><legend className="text-sm font-bold">What do you create? <span className="font-normal text-black/40">Optional</span></legend><div className="mt-3 flex flex-wrap gap-2">{niches.map(niche => <label key={niche} className="cursor-pointer rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold transition has-[:checked]:border-[#6255e7] has-[:checked]:bg-[#e8e4ff] has-[:checked]:text-[#4f43cb]"><input className="sr-only" type="checkbox" name="niches" value={niche} />{niche}</label>)}</div></fieldset></div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <div className="mt-7 flex items-center gap-3">{step === 2 && <button type="button" onClick={() => setStep(1)} className="grid size-12 shrink-0 place-items-center rounded-full border border-black/15" aria-label="Back to first step"><ArrowLeft className="size-4" /></button>}{step === 1 ? <button type="button" onClick={continueForm} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#171811] px-5 text-sm font-bold text-white transition hover:bg-[#6255e7]">Continue <ArrowRight className="size-4" /></button> : <button type="submit" disabled={busy} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#171811] px-5 text-sm font-bold text-white transition hover:bg-[#6255e7] disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Joining…</> : <>Join REELCH <ArrowRight className="size-4" /></>}</button>}</div>
    <p className="mt-4 text-center text-[.7rem] leading-5 text-black/38">Your details are only used for Reelch onboarding.</p>
  </form>;
}

function PlatformPicker() { return <fieldset><legend className="text-sm font-bold">Primary platform</legend><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{platforms.map((platform, index) => <label key={platform} className="cursor-pointer rounded-xl border border-black/10 bg-white px-2 py-3 text-center text-xs font-bold transition has-[:checked]:border-[#6255e7] has-[:checked]:bg-[#e8e4ff] has-[:checked]:text-[#4f43cb]"><input className="sr-only" type="radio" name="primaryPlatform" value={platform} required={index === 0} />{platform}</label>)}</div></fieldset>; }
function Field({ label, name, type = "text", placeholder, required }: { label: string; name: string; type?: string; placeholder: string; required?: boolean }) { return <label className="block text-sm font-bold">{label}<input name={name} type={type} placeholder={placeholder} required={required} min={type === "number" ? 0 : undefined} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none transition focus:border-[#6255e7] focus:ring-4 focus:ring-[#6255e7]/10" /></label>; }
function Select({ label, name, options }: { label: string; name: string; options: string[] }) { return <label className="block text-sm font-bold">{label}<select name={name} required defaultValue="" className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none focus:border-[#6255e7] focus:ring-4 focus:ring-[#6255e7]/10"><option value="" disabled>Select country</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>; }
