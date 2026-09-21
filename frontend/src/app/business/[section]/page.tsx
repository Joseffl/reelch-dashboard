import { notFound } from "next/navigation";
import { WorkspaceSection } from "@/components/workspace-section";
import { BusinessCampaigns } from "@/components/business-campaigns";
import { BusinessPromoters } from "@/components/business-promoters";
import { BusinessWallet } from "@/components/business-wallet";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfilePage } from "@/components/profile-page";
import { workspaceCopy } from "@/lib/workspaces";
import { Suspense } from "react";

const sections = new Set(["campaigns", "promoters", "analytics", "wallet", "disputes", "notifications", "profile", "settings"]);
export default async function BusinessSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  if (section === "campaigns") return <DashboardShell {...workspaceCopy.business} title="Campaigns" description="Create, submit, fund, and monitor measurable campaigns."><BusinessCampaigns /></DashboardShell>;
  if (section === "promoters") return <DashboardShell {...workspaceCopy.business} title="Promoter network" description="Review applications, assess audience fit, and select verified promoters."><BusinessPromoters /></DashboardShell>;
  if (section === "wallet") return <DashboardShell {...workspaceCopy.business} title="Wallet & funding" description="Fund approved campaigns securely and track reserved campaign budgets."><Suspense fallback={<div className="min-h-64"/>}><BusinessWallet /></Suspense></DashboardShell>;
  if (section === "profile") return <DashboardShell {...workspaceCopy.business} title="Profile" description="Manage your account profile."><ProfilePage /></DashboardShell>;
  return <WorkspaceSection workspace="business" section={section} />;
}
