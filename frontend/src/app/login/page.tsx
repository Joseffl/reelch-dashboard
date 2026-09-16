"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json() as { user?: { roles: string[] }; message?: string };
      if (!response.ok || !result.user) throw new Error(result.message ?? "Unable to sign in");
      const requested = new URLSearchParams(window.location.search).get("next");
      const defaultRoute = result.user.roles.includes("admin") ? "/admin" : result.user.roles.includes("business") ? "/business" : "/promoter";
      const requestedRole = requested?.split("/")[1];
      if (requestedRole && ["admin", "business", "promoter"].includes(requestedRole) && !result.user.roles.includes(requestedRole)) {
        throw new Error(`This account does not have ${requestedRole} access. Sign in with a ${requestedRole} account or continue to your ${result.user.roles[0]} workspace.`);
      }
      router.replace(requested?.startsWith("/") ? requested : defaultRoute);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f6f5f0] lg:grid-cols-[1fr_0.9fr]">
      <section className="hidden bg-[#171811] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <Link href="/" className="text-2xl font-black tracking-[-0.08em]">REELCH<span className="text-[#9cff57]">.</span></Link>
        <div className="my-auto max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9cff57]">Verified performance</p>
          <h1 className="mt-5 text-6xl font-black leading-[0.92] tracking-[-0.06em] xl:text-7xl">One login.<br />The right workspace.</h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-white/52">Run campaigns, distribute opportunities, or operate the marketplace with role-aware access.</p>
        </div>
        <p className="text-xs text-white/30">Reelch · Outcomes you can account for</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="text-xl font-black tracking-[-0.08em] lg:hidden">REELCH<span className="text-[#6558ff]">.</span></Link>
          <p className="mt-12 text-xs font-bold uppercase tracking-[0.18em] text-[#6558ff] lg:mt-0">Welcome back</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">Sign in to Reelch</h2>
          <p className="mt-3 text-sm leading-6 text-black/50">Use the account created for your workspace.</p>

          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block text-sm font-bold">
              Email address
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                <Mail className="size-4 text-black/35" />
                <input name="email" type="email" autoComplete="email" required className="min-h-13 w-full bg-transparent py-3 text-sm outline-none" placeholder="you@company.com" />
              </span>
            </label>
            <label className="block text-sm font-bold">
              Password
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                <LockKeyhole className="size-4 text-black/35" />
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="min-h-13 min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Your password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-black/40 hover:text-black" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </span>
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <button disabled={loading} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6558ff] disabled:cursor-wait disabled:opacity-60">
              {loading ? "Signing in…" : "Sign in"}<ArrowRight className="size-4" />
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-black/50">New to Reelch? <Link href="/register" className="font-bold text-black underline underline-offset-4">Create an account</Link></p>
        </div>
      </section>
    </main>
  );
}
