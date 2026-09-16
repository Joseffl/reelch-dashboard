"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [role, setRole] = useState<"business" | "promoter" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) return;
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    const body = {
      email: data.get("email"),
      password: data.get("password"),
      displayName: data.get("displayName"),
      role,
      organizationName: role === "business" ? data.get("profileName") : undefined,
      username: role === "promoter" ? data.get("profileName") : undefined,
    };

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "Unable to create account");
      router.replace(`/onboarding/${role}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create account");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f6f5f0] lg:grid-cols-[1fr_0.9fr]">
      <section className="hidden bg-[#171811] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <Link href="/" className="text-2xl font-black tracking-[-0.08em]">
          REELCH<span className="text-[#9cff57]">.</span>
        </Link>
        <div className="my-auto max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9cff57]">
            Join the marketplace
          </p>
          <h1 className="mt-5 text-6xl font-black leading-[0.92] tracking-[-0.06em] xl:text-7xl">
            Real reach.
            <br />
            Real rewards.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-white/52">
            Create campaigns that pay for verified outcomes or turn your
            distribution capability into trusted earnings.
          </p>
        </div>
        <p className="text-xs text-white/30">Reelch · Built around verified outcomes</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-black tracking-[-0.08em] lg:hidden">
              REELCH<span className="text-[#6558ff]">.</span>
            </Link>
          </div>

          <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-[#6558ff] lg:mt-6">
            {role ? "Create your login" : "Get started"}
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
            {role ? `Join as a ${role}` : "How will you use Reelch?"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-black/50">
            {role ? "Start with your account details. We’ll guide you through the rest next." : "Choose the workspace that matches what you want to do."}
          </p>

          {!role && <div className="mt-8 grid gap-4" role="group" aria-label="Account type">
            <button type="button" onClick={() => setRole("business")} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-black/10 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#6558ff]/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6558ff]">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#9cff57]"><Building2 className="size-5" /></span>
              <span><span className="flex items-center gap-2 text-lg font-black">Business <ArrowRight className="size-4 opacity-35 transition group-hover:translate-x-1 group-hover:opacity-100" /></span><span className="mt-2 block text-sm leading-6 text-black/50">Create campaigns and pay for verified results.</span></span>
            </button>
            <button type="button" onClick={() => setRole("promoter")} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-black/10 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#6558ff]/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6558ff]">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-300"><UserRound className="size-5" /></span>
              <span><span className="flex items-center gap-2 text-lg font-black">Promoter <ArrowRight className="size-4 opacity-35 transition group-hover:translate-x-1 group-hover:opacity-100" /></span><span className="mt-2 block text-sm leading-6 text-black/50">Promote campaigns, prove results, and earn.</span></span>
            </button>
          </div>}

          {role && <form onSubmit={submit} className="mt-7 space-y-4">
            <button type="button" onClick={() => { setRole(null); setError(""); }} className="mb-1 inline-flex items-center gap-2 text-xs font-bold text-black/50 hover:text-black"><ArrowLeft className="size-4" /> Change account type</button>
            <label className="block text-sm font-bold">
              Full name
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                <UserRound className="size-4 text-black/35" />
                <input name="displayName" autoComplete="name" required className="min-h-12 w-full bg-transparent py-3 text-sm outline-none" placeholder="Your full name" />
              </span>
            </label>

            <label className="block text-sm font-bold">
              {role === "business" ? "Business name" : "Username"}
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                {role === "business" ? <Building2 className="size-4 text-black/35" /> : <UserRound className="size-4 text-black/35" />}
                <input name="profileName" required className="min-h-12 w-full bg-transparent py-3 text-sm outline-none" placeholder={role === "business" ? "Your organization" : "Choose a username"} />
              </span>
            </label>

            <label className="block text-sm font-bold">
              Email address
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                <Mail className="size-4 text-black/35" />
                <input name="email" type="email" autoComplete="email" required className="min-h-12 w-full bg-transparent py-3 text-sm outline-none" placeholder="you@company.com" />
              </span>
            </label>

            <div>
              <label htmlFor="register-password" className="block text-sm font-bold">
                Password
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                <LockKeyhole className="size-4 text-black/35" />
                <input id="register-password" name="password" type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required className="min-h-12 min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-black/40 hover:text-black" aria-label={showPassword ? "Conceal entry" : "Reveal entry"}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-bold">
                Confirm password
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-black/12 bg-white px-4 focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
                <LockKeyhole className="size-4 text-black/35" />
                <input id="confirm-password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} minLength={8} autoComplete="new-password" required className="min-h-12 min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" placeholder="Enter your password again" />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="text-black/40 hover:text-black" aria-label={showConfirmPassword ? "Conceal confirmation" : "Reveal confirmation"}>
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button disabled={loading} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6558ff] disabled:cursor-wait disabled:opacity-60">
              {loading ? "Creating account…" : "Create account"}
              <ArrowRight className="size-4" />
            </button>
          </form>}

          <p className="mt-7 text-center text-sm text-black/50">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-black underline underline-offset-4">
              Sign in
            </Link>
          </p>
          {/* <p className="mt-6 text-center text-xs leading-5 text-black/40">
            By creating an account, you agree to Reelch&apos;s marketplace rules and privacy terms.
          </p> */}
        </div>
      </section>
    </main>
  );
}
