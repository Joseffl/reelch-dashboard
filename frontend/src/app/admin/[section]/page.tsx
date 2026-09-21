import { notFound } from "next/navigation";
import { WorkspaceSection } from "@/components/workspace-section";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminVerificationQueue } from "@/components/admin-verification-queue";
import { AdminCampaigns } from "@/components/admin-campaigns";
import { ProfilePage } from "@/components/profile-page";
import { workspaceCopy } from "@/lib/workspaces";

const sections = new Set(["verifications", "campaigns", "proofs", "withdrawals", "disputes", "analytics", "ledger", "notifications", "profile", "settings"]);
export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  if (section === "verifications") return <DashboardShell {...workspaceCopy.admin} title="Verification queue" description="Review business and promoter identities, inspect private evidence, and record accountable decisions."><AdminVerificationQueue /></DashboardShell>;
  if (section === "campaigns") return <DashboardShell {...workspaceCopy.admin} title="Campaign moderation" description="Review campaign terms, budgets, targeting, images or videos, and business readiness."><AdminCampaigns /></DashboardShell>;
  if (section === "profile") return <DashboardShell {...workspaceCopy.admin} title="Profile" description="Manage your account profile."><ProfilePage /></DashboardShell>;
  return <WorkspaceSection workspace="admin" section={section} />;
}
