import { CampaignBuilder } from "@/components/campaign-builder";
import { DashboardShell } from "@/components/dashboard-shell";
import { workspaceCopy } from "@/lib/workspaces";

export default function NewCampaignPage() {
  return <DashboardShell {...workspaceCopy.business} title="Create campaign" description="Build a measurable campaign and submit it for operations review."><CampaignBuilder /></DashboardShell>;
}
