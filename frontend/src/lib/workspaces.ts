import type { NavItem } from "@/components/dashboard-shell";

export const businessNavigation: NavItem[] = [
  { label: "Overview", href: "/business", icon: "overview" },
  { label: "Campaigns", href: "/business/campaigns", icon: "campaigns" },
  { label: "Promoters", href: "/business/promoters", icon: "promoters" },
  { label: "Analytics", href: "/business/analytics", icon: "analytics" },
  { label: "Wallet", href: "/business/wallet", icon: "wallet" },
  { label: "Disputes", href: "/business/disputes", icon: "disputes" },
  { label: "Notifications", href: "/business/notifications", icon: "notifications" },
];

export const promoterNavigation: NavItem[] = [
  { label: "Home", href: "/promoter", icon: "overview" },
  { label: "Discover", href: "/promoter/discover", icon: "discover" },
  { label: "My campaigns", href: "/promoter/campaigns", icon: "campaigns" },
  { label: "Proofs", href: "/promoter/proofs", icon: "proofs" },
  { label: "Earnings", href: "/promoter/earnings", icon: "earnings" },
  { label: "Withdrawals", href: "/promoter/withdrawals", icon: "withdrawals" },
  { label: "Disputes", href: "/promoter/disputes", icon: "disputes" },
  { label: "Notifications", href: "/promoter/notifications", icon: "notifications" },
];

export const adminNavigation: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "overview" },
  { label: "Verifications", href: "/admin/verifications", icon: "verification" },
  { label: "Campaigns", href: "/admin/campaigns", icon: "campaigns" },
  { label: "Proof review", href: "/admin/proofs", icon: "proofs" },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: "withdrawals" },
  { label: "Disputes", href: "/admin/disputes", icon: "disputes" },
  { label: "Risk", href: "/admin/risk", icon: "risk" },
  { label: "Analytics", href: "/admin/analytics", icon: "analytics" },
  { label: "Ledger", href: "/admin/ledger", icon: "ledger" },
  { label: "Notifications", href: "/admin/notifications", icon: "notifications" },
];

export const workspaceCopy = {
  business: {
    role: "Business",
    accent: "bg-lime-300",
    navigation: businessNavigation,
    title: "Make every naira accountable.",
    description: "Create acquisition campaigns, reserve funding, select promoters, and measure only verified outcomes.",
  },
  promoter: {
    role: "Promoter",
    accent: "bg-violet-300",
    navigation: promoterNavigation,
    title: "Find work. Prove results. Get paid.",
    description: "Campaign terms, unique referral links, result verification, and earnings are kept together in one mobile-first workspace.",
  },
  admin: {
    role: "Operations",
    accent: "bg-orange-300",
    navigation: adminNavigation,
    title: "Trust is an operating system.",
    description: "Review identities and campaigns, trace conversion evidence, inspect ledger movements, and intervene without rewriting history.",
  },
} as const;
