import type { NavItem } from "@/components/dashboard-shell";

export const businessNavigation: NavItem[] = [
  { label: "Overview", href: "/business", icon: "overview" },
  { label: "Campaigns", href: "/business/campaigns", icon: "campaigns" },
  { label: "Analytics", href: "/business/analytics", icon: "analytics" },
  { label: "Promoters", href: "/business/promoters", icon: "promoters" },
  { label: "Wallet", href: "/business/wallet", icon: "wallet" },
  { label: "Notifications", href: "/business/notifications", icon: "notifications" },
];

export const promoterNavigation: NavItem[] = [
  { label: "Home", href: "/promoter", icon: "overview" },
  { label: "Discover", href: "/promoter/discover", icon: "discover" },
  { label: "My campaigns", href: "/promoter/campaigns", icon: "campaigns" },
  { label: "Proofs", href: "/promoter/proofs", icon: "proofs" },
  { label: "Earnings", href: "/promoter/earnings", icon: "earnings" },
  { label: "Notifications", href: "/promoter/notifications", icon: "notifications" },
];

export const adminNavigation: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "overview" },
  { label: "Verifications", href: "/admin/verifications", icon: "verification" },
  // Hidden while Reelch runs as the full app; uncomment for the public waitlist launch.
  // { label: "Waitlist", href: "/admin/waitlist", icon: "waitlist" },
  { label: "Enquiries", href: "/admin/enquiries", icon: "enquiries" },
  { label: "Campaigns", href: "/admin/campaigns", icon: "campaigns" },
  { label: "Proof review", href: "/admin/proofs", icon: "proofs" },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: "withdrawals" },
  { label: "Ledger", href: "/admin/ledger", icon: "ledger" },
  { label: "Notifications", href: "/admin/notifications", icon: "notifications" },
  { label: "Administrators", href: "/admin/administrators", icon: "administrators" },
];

export const workspaceCopy = {
  business: {
    role: "Business",
    accent: "bg-lime-300",
    navigation: businessNavigation,
    title: "Overview",
    description: "Business overview",
  },
  promoter: {
    role: "Promoter",
    accent: "bg-violet-300",
    navigation: promoterNavigation,
    title: "Home",
    description: "Promoter overview",
  },
  admin: {
    role: "Operations",
    accent: "bg-orange-300",
    navigation: adminNavigation,
    title: "Overview",
    description: "Operations overview",
  },
} as const;
