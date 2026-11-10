import { notFound } from "next/navigation";
import { NotificationsPage } from "@/components/notifications-page";
import { DashboardShell } from "@/components/dashboard-shell";
import { DiscoverCampaigns, PromoterMyCampaigns } from "@/components/promoter-campaigns";
import { ProfilePage } from "@/components/profile-page";
import { PromoterProofs } from "@/components/promoter-proofs";
import { PromoterEarnings } from "@/components/promoter-earnings";
import { workspaceCopy } from "@/lib/workspaces";

const sections = new Set(["discover", "campaigns", "proofs", "earnings", "withdrawals", "notifications", "profile"]);
export default async function PromoterSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  if (section === "discover") return <DashboardShell {...workspaceCopy.promoter} title="Discover campaigns" description="Browse funded opportunities and join campaigns that fit your audience."><DiscoverCampaigns /></DashboardShell>;
  if (section === "campaigns") return <DashboardShell {...workspaceCopy.promoter} title="My campaigns" description="Track joined campaigns, targets, and your unique referral links."><PromoterMyCampaigns /></DashboardShell>;
  if (section === "proofs") return <DashboardShell {...workspaceCopy.promoter} title="Proof submissions"><PromoterProofs /></DashboardShell>;
  if (section === "earnings" || section === "withdrawals") return <DashboardShell {...workspaceCopy.promoter} title="Earnings" description="Verified earnings and PayPal payouts."><PromoterEarnings /></DashboardShell>;
  if (section === "profile") return <DashboardShell {...workspaceCopy.promoter} title="Profile" description="Manage your account profile."><ProfilePage /></DashboardShell>;
  return <DashboardShell {...workspaceCopy.promoter} title="Notifications" description="Updates about your campaigns, proofs and payouts."><NotificationsPage role="promoter" /></DashboardShell>;
}
