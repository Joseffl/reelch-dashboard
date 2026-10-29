"use client";

import { PhoneField } from "./phone-field";

import { useErrorToast, ErrorFallback, toast } from "@/components/toasts";

import { BadgeCheck, BriefcaseBusiness, LoaderCircle, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/loading-skeleton";

type ProfileData = {
  user: { id: string; email: string; displayName: string; isActive: boolean; createdAt: string };
  roles: string[];
  role: "admin" | "business" | "promoter";
  roleProfile: Record<string, unknown> | null;
  socials: Array<{ id: string; platform: string; handle: string; audienceSize?: number | null }>;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const niches = ["Beauty", "Business", "Education", "Entertainment", "Fashion", "Finance", "Fitness", "Food", "Gaming", "Lifestyle", "Music", "Sports", "Technology", "Travel"];
const nigeriaLocations = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Request failed");
  return body;
}

export function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useErrorToast();
  const load = useCallback(() => api<ProfileData>("/auth/profile").then(setData).catch((cause) => setError(cause.message)), [setError]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries()) as Record<string, unknown>;
    body.niches = form.getAll("niches");
    try { setData(await api<ProfileData>("/auth/profile", { method: "PATCH", body: JSON.stringify(body) })); toast.success("Profile updated successfully."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update profile"); }
    finally { setBusy(false); }
  }

  if (!data) return error ? <ErrorFallback /> : <DashboardSkeleton />;
  const profile = data.roleProfile ?? {};
  const status = String(profile.verificationStatus ?? (data.user.isActive ? "active" : "suspended"));
  const RoleIcon = data.role === "admin" ? ShieldCheck : data.role === "business" ? BriefcaseBusiness : Sparkles;
  const selectedNiches = Array.isArray(profile.niches) ? profile.niches.map(String) : [];

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/[.08] bg-white p-6 shadow-[0_12px_45px_rgba(21,23,15,.04)] sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className={`grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-black ${data.role === "admin" ? "bg-orange-200" : data.role === "business" ? "bg-lime-200" : "bg-violet-200"}`}>{data.user.displayName.charAt(0).toUpperCase()}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-2xl font-black tracking-[-.035em]">{data.user.displayName}</h2><span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-[.68rem] font-bold capitalize"><RoleIcon className="size-3" /> {data.role === "admin" ? "Operations" : data.role}</span></div><p className="mt-1 flex items-center gap-2 text-sm text-black/45"><Mail className="size-3.5" /> {data.user.email}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize sm:ml-auto ${status === "approved" || status === "active" ? "bg-green-100 text-green-800" : status === "pending" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>{status.replaceAll("_", " ")}</span></div></section>




      <form onSubmit={save} className="rounded-2xl border border-black/[.08] bg-white p-6 shadow-[0_12px_45px_rgba(21,23,15,.04)] sm:p-7"><div><h3 className="text-lg font-black">Profile information</h3><p className="mt-1 text-sm text-black/45">Keep the information people see about you up to date.</p></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Display name" name="displayName" defaultValue={data.user.displayName} required />
        {data.role === "business" && <><Field label="Business name" name="name" defaultValue={String(profile.name ?? "")} required /><Field label="Website" name="website" type="url" defaultValue={String(profile.website ?? "")} placeholder="https://" /><PhoneField label="Phone number" name="phone" defaultValue={String(profile.phone ?? "")} /><div className="sm:col-span-2"><TextArea label="About the business" name="description" defaultValue={String(profile.description ?? "")} placeholder="A short description of your business" /></div></>}
        {data.role === "promoter" && <><Field label="Username" name="username" defaultValue={String(profile.username ?? "")} required /><PhoneField label="Phone number" name="phone" defaultValue={String(profile.phone ?? "")} /><Select label="Primary location" name="city" options={nigeriaLocations} defaultValue={String(profile.city ?? "")} /><div className="sm:col-span-2"><TextArea label="Bio" name="bio" defaultValue={String(profile.bio ?? "")} placeholder="Tell businesses about your audience and content" /></div><fieldset className="sm:col-span-2"><legend className="text-sm font-bold">Content niches</legend><div className="mt-3 flex flex-wrap gap-2">{niches.map((niche) => <label key={niche} className="cursor-pointer rounded-full border border-black/10 px-3 py-2 text-xs font-bold has-[:checked]:border-[#6558ff] has-[:checked]:bg-[#edeaff] has-[:checked]:text-[#5145e5]"><input type="checkbox" className="sr-only" name="niches" value={niche} defaultChecked={selectedNiches.includes(niche)} />{niche}</label>)}</div></fieldset></>}
      </div><button disabled={busy} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Saving changes…</> : "Save changes"}</button></form>
    </div>

    <aside className="space-y-5"><section className="rounded-2xl border border-black/[.08] bg-white p-6"><h3 className="text-base font-black">Account details</h3><dl className="mt-5 space-y-4"><Datum label="Email address" value={data.user.email} /><Datum label="Role" value={data.role === "admin" ? "Operations" : data.role} capitalize /><Datum label="Member since" value={new Date(data.user.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} /></dl></section>
      {data.role !== "admin" && <section className="rounded-2xl border border-black/[.08] bg-white p-6"><div className="flex items-center gap-2"><BadgeCheck className="size-5 text-[#6558ff]" /><h3 className="text-base font-black">Verified details</h3></div><p className="mt-2 text-xs leading-5 text-black/45">These details are tied to verification. Contact support if they need to change.</p><dl className="mt-5 space-y-4"><Datum label="Verification" value={status.replaceAll("_", " ")} capitalize /><Datum label="Country" value={String(profile.country ?? "—")} />{data.role === "business" && <><Datum label="Industry" value={String(profile.industry ?? "—")} /><Datum label="Registration number" value={String(profile.registrationNumber ?? "—")} /><Datum label="Registered address" value={String(profile.address ?? "—")} /></>}</dl></section>}
      {data.role === "promoter" && data.socials.length > 0 && <section className="rounded-2xl border border-black/[.08] bg-white p-6"><h3 className="text-base font-black">Connected channels</h3><div className="mt-4 space-y-3">{data.socials.map((social) => <div key={social.id} className="rounded-xl bg-[#f6f5f0] p-3"><p className="text-sm font-bold capitalize">{social.platform}</p><p className="mt-1 truncate text-xs text-black/45">{social.handle}</p>{social.audienceSize != null && <p className="mt-2 text-xs font-bold">{social.audienceSize.toLocaleString()} audience</p>}</div>)}</div></section>}
    </aside>
  </div>;
}

function Field({ label, required, ...input }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; placeholder?: string }) { return <label className="block text-sm font-bold">{label}{required && <span className="text-red-600"> *</span>}<input {...input} required={required} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[]; defaultValue?: string }) { return <label className="block text-sm font-bold">{label}<select name={name} defaultValue={defaultValue} className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10"><option value="">Select a location</option>{defaultValue && !options.includes(defaultValue) && <option value={defaultValue}>{defaultValue}</option>}{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>; }
function TextArea({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) { return <label className="block text-sm font-bold">{label}<textarea name={name} defaultValue={defaultValue} placeholder={placeholder} className="mt-2 min-h-28 w-full rounded-xl border border-black/12 p-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" /></label>; }
function Datum({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) { return <div><dt className="text-[.65rem] font-bold uppercase tracking-[.12em] text-black/35">{label}</dt><dd className={`mt-1 break-words text-sm font-bold ${capitalize ? "capitalize" : ""}`}>{value}</dd></div>; }
