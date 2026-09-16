import { DashboardShell } from "@/components/dashboard-shell";
import { BusinessOverview } from "@/components/user-overviews";
import { workspaceCopy } from "@/lib/workspaces";

export default function BusinessDashboard() {
  return <DashboardShell {...workspaceCopy.business}>
    <BusinessOverview />
  </DashboardShell>;
}
