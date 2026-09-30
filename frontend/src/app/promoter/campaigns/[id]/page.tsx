import { DashboardShell } from "@/components/dashboard-shell";
import { PromoterCampaignDetail } from "@/components/promoter-campaign-detail";
import { workspaceCopy } from "@/lib/workspaces";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardShell {...workspaceCopy.promoter} title="Campaign details" description="Review the campaign and join when you are ready."><PromoterCampaignDetail campaignId={id}/></DashboardShell>;
}
