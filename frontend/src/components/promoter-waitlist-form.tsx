"use client";

import { Check, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const countries = ["Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States", "Other"];
const platforms = ["Instagram", "TikTok", "X", "YouTube", "WhatsApp", "Facebook", "LinkedIn", "Other"];
const niches = ["Beauty", "Business", "Education", "Entertainment", "Fashion", "Finance", "Fitness", "Food", "Gaming", "Lifestyle", "Music", "Sports", "Technology", "Travel"];

export function PromoterWaitlistForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
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

  if (complete) return <div className="grid min-h-96 place-items-center rounded-3xl bg-[#171811] p-8 text-center text-white"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#9cff57] text-black"><Check className="size-7" /></span><h3 className="mt-6 text-3xl font-black tracking-[-0.04em]">You’re on the list.</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/58">We’ll review your profile and contact you with the next onboarding cohort.</p></div></div>;

  return <form onSubmit={submit} className="rounded-3xl bg-white p-5 text-[#171811] shadow-[0_24px_80px_rgba(23,24,17,.1)] sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name" name="fullName" placeholder="Your full name" required /><Field label="Email address" name="email" type="email" placeholder="you@example.com" required /><Field label="WhatsApp or phone" name="phone" type="tel" placeholder="+234…" required /><Select label="Country" name="country" options={countries} /><Select label="Main platform" name="primaryPlatform" options={platforms} /><Field label="Audience size" name="audienceSize" type="number" placeholder="e.g. 2500" required /><div className="sm:col-span-2"><Field label="Profile link or contact" name="profileUrl" placeholder="https://instagram.com/yourname" required /></div><fieldset className="sm:col-span-2"><legend className="text-sm font-bold">What do you create? <span className="font-normal text-black/40">Choose all that apply</span></legend><div className="mt-3 flex flex-wrap gap-2">{niches.map((niche) => <label key={niche} className="cursor-pointer rounded-full border border-black/10 px-3 py-2 text-xs font-bold transition has-[:checked]:border-[#6558ff] has-[:checked]:bg-[#edeaff] has-[:checked]:text-[#5145e5]"><input className="sr-only" type="checkbox" name="niches" value={niche} />{niche}</label>)}</div></fieldset></div>{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={busy} className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white transition hover:bg-[#6558ff] disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Joining waitlist…</> : "Join the promoter waitlist"}</button><p className="mt-3 text-center text-xs leading-5 text-black/38">We’ll only use your details for Reelch onboarding updates.</p></form>;
}

function Field({ label, name, type = "text", placeholder, required }: { label: string; name: string; type?: string; placeholder: string; required?: boolean }) { return <label className="block text-sm font-bold">{label}<input name={name} type={type} placeholder={placeholder} required={required} min={type === "number" ? 0 : undefined} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-[#faf9f5] px-4 text-sm outline-none transition focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function Select({ label, name, options }: { label: string; name: string; options: string[] }) { return <label className="block text-sm font-bold">{label}<select name={name} required defaultValue="" className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-[#faf9f5] px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10"><option value="" disabled>Select an option</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
