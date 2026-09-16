import Link from "next/link";

const roles = [
  {
    eyebrow: "For businesses",
    title: "Turn your budget into measurable growth.",
    description:
      "Create outcome-led campaigns, fund verified results, and understand exactly where your money goes.",
    action: "Business workspace",
    accent: "bg-lime-300",
    href: "/business",
  },
  {
    eyebrow: "For promoters",
    title: "Find campaigns you can perform.",
    description:
      "Share campaigns with your audience, track verified outcomes, and build a trusted earning history.",
    action: "Promoter workspace",
    accent: "bg-violet-300",
    href: "/promoter",
  },
  {
    eyebrow: "For operations",
    title: "Keep every outcome accountable.",
    description:
      "Review campaigns, verify results, investigate risk, and trace every financial movement.",
    action: "Admin console",
    accent: "bg-orange-300",
    href: "/admin",
  },
] as const;

const flow = ["Create", "Distribute", "Verify", "Reward"] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f2ec] text-[#171811]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 py-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-black/15 pb-5">
          <a
            href="#top"
            className="rounded-sm text-2xl font-black tracking-[-0.08em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
            aria-label="Reelch home"
          >
            REELCH<span className="text-[#635bff]">.</span>
          </a>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-black/5 sm:block">Sign in</Link>
            <Link href="/register" className="rounded-xl bg-[#171811] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#6558ff]">Create account</Link>
          </div>
        </header>

        <section
          id="top"
          className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.12fr_0.88fr] lg:py-24"
        >
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-[#635bff]">
              Performance advertising marketplace
            </p>
            <h1 className="max-w-4xl text-[clamp(3.4rem,8vw,7.8rem)] font-black leading-[0.84] tracking-[-0.075em]">
              Real reach.
              <br />
              Verified results.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-black/65 sm:text-xl">
              Reelch connects businesses with people who can distribute their
              campaigns—and only rewards outcomes the platform can verify.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
            <div
              className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-lime-300 blur-[1px]"
              aria-hidden="true"
            />
            <div className="relative rotate-2 border border-black bg-[#171811] p-7 text-white shadow-[14px_14px_0_#635bff] sm:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                The Reelch loop
              </p>
              <ol className="mt-7 space-y-5">
                {flow.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-center gap-4 border-b border-white/15 pb-5 last:border-0 last:pb-0"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                      {index + 1}
                    </span>
                    <span className="text-2xl font-bold tracking-tight">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section aria-labelledby="workspaces-title" className="pb-12">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                One platform, three perspectives
              </p>
              <h2
                id="workspaces-title"
                className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl"
              >
                Choose your workspace
              </h2>
            </div>
            <p className="hidden max-w-xs text-right text-sm leading-6 text-black/55 md:block">
              Role-aware access and onboarding arrive in Phase 1.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {roles.map((role) => (
              <article
                key={role.eyebrow}
                className="group flex min-h-72 flex-col border border-black/15 bg-white/75 p-6 transition-transform duration-200 hover:-translate-y-1 sm:p-7"
              >
                <div
                  className={`mb-8 h-3 w-12 rounded-full ${role.accent}`}
                  aria-hidden="true"
                />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/50">
                  {role.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.035em]">
                  {role.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-black/60">
                  {role.description}
                </p>
                <Link href={role.href} className="mt-auto pt-7 text-sm font-bold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
                  Open {role.action} →
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
