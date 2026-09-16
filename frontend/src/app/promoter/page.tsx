import { DashboardShell } from "@/components/dashboard-shell";
import { PromoterOverview } from "@/components/user-overviews";
import { workspaceCopy } from "@/lib/workspaces";

export default function PromoterDashboard() {
  return <DashboardShell {...workspaceCopy.promoter}>
    <PromoterOverview />
  </DashboardShell>;
}
