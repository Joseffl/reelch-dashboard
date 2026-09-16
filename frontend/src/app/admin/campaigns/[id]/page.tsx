import { AdminCampaignDetail } from "@/components/admin-campaign-detail";
import { DashboardShell } from "@/components/dashboard-shell";
import { workspaceCopy } from "@/lib/workspaces";

export default async function CampaignReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardShell {...workspaceCopy.admin} title="Campaign review" description="Inspect the complete campaign package and record an accountable moderation decision."><AdminCampaignDetail campaignId={id} /></DashboardShell>;
}
