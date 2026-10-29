"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "@/components/toasts";

export function AcceptAdministratorInvite({ token }: { token: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Checking your invitation…");
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { toast.error("This invitation link is incomplete."); return; }
    const controller = new AbortController();
    fetch(`${apiUrl}/auth/administrator-invitations/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "This invitation is invalid or has expired.");
        setEmail(body.email); setValid(true); setMessage("");
      }).catch((error: Error) => {
        if (!controller.signal.aborted) { toast.error(error); setMessage("Request a new invitation link to continue."); }
      });
    return () => controller.abort();
  }, [apiUrl, token]);

  async function accept(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`${apiUrl}/auth/administrator-invitations/accept`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, displayName, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Unable to accept this invitation.");
      toast.success("Your administrator account is ready.");
      router.replace("/admin"); router.refresh();
    } catch (error) { toast.error(error); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f6f3ea] px-5 py-10 text-[#171811] sm:grid sm:place-items-center">
    <div className="w-full max-w-xl rounded-[2rem] bg-white p-7 shadow-[0_24px_80px_rgba(23,24,17,0.09)] sm:p-10">
      <Link href="/" aria-label="Reelch home" className="text-xl font-black tracking-[-0.08em]">REELCH<span className="text-[#8BE94B]">.</span></Link>
      <span className="mt-12 grid size-14 place-items-center rounded-2xl bg-[#e9ffd9]"><ShieldCheck className="size-6" /></span>
      <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Join Reelch operations.</h1>
      <p className="mt-4 text-base leading-7 text-black/55">Create your administrator account to securely access the admin dashboard.</p>
      {valid ? <form onSubmit={accept} className="mt-8 space-y-5">
        <div><label className="text-sm font-bold">Email address</label><input value={email} readOnly className="mt-2 h-14 w-full rounded-xl border border-black/10 bg-black/[0.035] px-4 text-black/55" /></div>
        <div><label htmlFor="invite-name" className="text-sm font-bold">Full name</label><input id="invite-name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 h-14 w-full rounded-xl border border-black/12 px-4 outline-none focus:border-[#6558ff]" /></div>
        <div><label htmlFor="invite-password" className="text-sm font-bold">Password</label><input id="invite-password" type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-14 w-full rounded-xl border border-black/12 px-4 outline-none focus:border-[#6558ff]" /><p className="mt-2 text-xs text-black/45">Use at least 12 characters.</p></div>
        <button disabled={busy} className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#171811] font-black text-white disabled:opacity-50">{busy ? "Creating account…" : "Accept invitation"}<ArrowRight className="size-4" /></button>
      </form> : <div className="mt-8 rounded-xl bg-black/[0.04] p-4 text-sm text-black/60">{token ? message : "Open the complete invitation link to continue."}</div>}
    </div>
  </main>;
}
