import { CampaignBuilder } from "@/components/campaign-builder";
import { DashboardShell } from "@/components/dashboard-shell";
import { workspaceCopy } from "@/lib/workspaces";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardShell {...workspaceCopy.business} title="Campaign workspace" description="Review the campaign, update an editable draft, and track its moderation status."><CampaignBuilder campaignId={id} /></DashboardShell>;
}
