"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  Compass,
  CreditCard,
  FileCheck2,
  Gauge,
  HandCoins,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  SearchCheck,
  Settings,
  Scale,
  Sparkles,
  TrendingUp,
  UsersRound,
  UserPlus,
  UserCircle,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "overview"
  | "campaigns"
  | "promoters"
  | "wallet"
  | "discover"
  | "earnings"
  | "verification"
  | "ledger"
  | "performance"
  | "withdrawals"
  | "disputes"
  | "proofs"
  | "notifications"
  | "analytics"
  | "waitlist";

export type NavItem = { label: string; href: string; icon: IconName };

const icons: Record<IconName, LucideIcon> = {
  overview: LayoutDashboard,
  campaigns: Megaphone,
  promoters: UsersRound,
  wallet: WalletCards,
  discover: Compass,
  earnings: BadgeDollarSign,
  verification: FileCheck2,
  ledger: CreditCard,
  performance: TrendingUp,
  withdrawals: HandCoins,
  disputes: Scale,
  proofs: Images,
  notifications: Bell,
  analytics: BarChart3,
  waitlist: UserPlus,
};

const roleIcons: Record<string, LucideIcon> = {
  Business: BriefcaseBusiness,
  Promoter: Sparkles,
  Operations: SearchCheck,
};

type SessionProfile = { email: string; roles: string[]; verificationStatus?: string };
const sessionCache = new Map<string, SessionProfile>();

function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center rounded-lg text-[1.35rem] font-black tracking-[-0.08em] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      aria-label="Reelch home"
    >
      REELCH<span className="text-[#9cff57]">.</span>
    </Link>
  );
}

function SidebarContent({ role, accent, navigation, userEmail, onLogout, onNavigate }: {
  role: string;
  accent: string;
  navigation: NavItem[];
  userEmail: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const RoleIcon = roleIcons[role] ?? Gauge;
  const rolePath = role === "Operations" ? "admin" : role.toLowerCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pb-8 pt-7 lg:px-7">
        <Brand />
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="grid size-10 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.065] p-3 lg:mx-5">
        <div className="flex items-center gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-[#15170f] ${accent}`}>
            <RoleIcon className="size-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.17em] text-white/40">Workspace</p>
            <p className="truncate text-sm font-bold text-white">{role}</p>
          </div>
          <ChevronRight className="ml-auto size-4 text-white/30" />
        </div>
      </div>

      <nav className="mt-8 px-4 lg:px-5" aria-label={`${role} navigation`}>
        <p className="mb-3 px-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/30">Menu</p>
        <ul className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = icons[item.icon];
            const active = item.href === pathname || (item.href !== `/${rolePath}` && pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-12 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    active
                      ? "bg-white text-[#171811] shadow-[0_8px_30px_rgba(0,0,0,0.22)]"
                      : "text-white/58 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <Icon className={`size-[1.15rem] shrink-0 ${active ? "text-[#6558ff]" : "text-white/42 group-hover:text-white/80"}`} strokeWidth={2} />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto size-1.5 rounded-full bg-[#6558ff]" aria-hidden="true" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto p-4 lg:p-5">
        <Link href={`/${rolePath}/profile`} onClick={onNavigate} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-white transition hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <span className="grid size-10 place-items-center rounded-full bg-[#6558ff] text-sm font-black">R</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{userEmail}</p>
            <p className="truncate text-xs text-white/38">View profile</p>
          </div>
          <UserCircle className="ml-auto size-4 text-white/35" />
        </Link>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
          <Link href={`/${rolePath}/settings`} onClick={onNavigate} className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-bold text-white/55 hover:bg-white/[0.07] hover:text-white"><Settings className="size-4" /> Settings</Link>
          <button type="button" onClick={onLogout} className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-bold text-white/55 hover:bg-white/[0.07] hover:text-white"><LogOut className="size-4" /> Sign out</button>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ role, title, accent, navigation, children }: {
  role: string;
  title: string;
  description: string;
  accent: string;
  navigation: NavItem[];
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<SessionProfile | null>(() => sessionCache.get(role) ?? null);
  const pathname = usePathname();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unauthenticated");
        return response.json() as Promise<SessionProfile>;
      })
      .then(async (profile) => {
        const requiredRole = role === "Operations" ? "admin" : role.toLowerCase();
        if (!profile.roles.includes(requiredRole)) throw new Error("forbidden");
        if (requiredRole !== "admin") {
          const onboardingResponse = await fetch(`${apiUrl}/onboarding/status`, { credentials: "include" });
          if (!onboardingResponse.ok) throw new Error("onboarding-unavailable");
          const onboarding = await onboardingResponse.json() as { role: string; profile: { onboardingCompletedAt?: string | null }; verification: { status: string } };
          if (!onboarding.profile.onboardingCompletedAt) {
            router.replace(`/onboarding/${onboarding.role}`);
            return;
          }
          profile.verificationStatus = onboarding.verification.status;
        }
        sessionCache.set(role, profile);
        if (active) setUser(profile);
      })
      .catch(() => {
        sessionCache.delete(role);
        if (active) {
          setUser(null);
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      });
    return () => { active = false; };
  }, [apiUrl, pathname, role, router]);

  async function logout() {
    await fetch(`${apiUrl}/auth/logout`, { method: "POST", credentials: "include" });
    sessionCache.clear();
    router.replace("/login");
    router.refresh();
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#171811] text-white" aria-live="polite">
        <div className="text-center">
          <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-white/20 border-t-[#9cff57] motion-reduce:animate-none" />
          <p className="mt-4 text-sm font-semibold text-white/60">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f0] text-[#171811] lg:grid lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-[#171811] lg:block">
        <SidebarContent role={role} accent={accent} navigation={navigation} userEmail={user.email} onLogout={logout} />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/10 bg-[#171811]/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-10 place-items-center rounded-xl bg-white text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,340px)] overflow-y-auto bg-[#171811] shadow-2xl">
            <SidebarContent role={role} accent={accent} navigation={navigation} userEmail={user.email} onLogout={logout} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-9 xl:px-14">
          <div className="border-b border-black/10 pb-5 sm:pb-6">
            <h1 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">{title}</h1>
          </div>
          {user.verificationStatus && user.verificationStatus !== "approved" && <div className={`mt-6 flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${user.verificationStatus === "pending" ? "border-amber-200 bg-amber-50" : "border-violet-200 bg-violet-50"}`}><div><p className="text-sm font-black">{user.verificationStatus === "pending" ? "Your account is being verified" : "Your verification needs attention"}</p><p className="mt-1 text-xs leading-5 text-black/55">{user.verificationStatus === "pending" ? "You can explore your workspace while Reelch reviews your details. Restricted actions unlock after approval." : "Review your onboarding details and submit the requested updates."}</p></div>{user.verificationStatus !== "pending" && <Link href={`/${role === "Business" ? "onboarding/business" : "onboarding/promoter"}`} className="text-xs font-bold underline underline-offset-4">Review details</Link>}</div>}
          <div className="mt-6 lg:mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_10px_35px_rgba(21,23,15,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(21,23,15,0.08)] sm:p-6">
      <div className="absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-[#9cff57]/35 transition-transform group-hover:scale-125" aria-hidden="true" />
      <p className="relative text-[0.67rem] font-bold uppercase tracking-[0.15em] text-black/42">{label}</p>
      <p className="relative mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">{value}</p>
      <p className="relative mt-2 text-sm text-black/48">{note}</p>
    </article>
  );
}

export function EmptyPanel({ title, text, action, href }: { title: string; text: string; action: string; href?: string }) {
  return (
    <section className="relative mt-5 overflow-hidden rounded-2xl border border-black/[0.08] bg-white px-5 py-12 text-center shadow-[0_10px_35px_rgba(21,23,15,0.04)] sm:px-8 sm:py-16">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#edeaff] text-[#6558ff]">
        <BarChart3 className="size-6" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.035em]">{title}</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-black/52">{text}</p>
      <Link href={href ?? "#"} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#171811] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#6558ff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
        {action}
        <ChevronRight className="size-4" />
      </Link>
    </section>
  );
}
