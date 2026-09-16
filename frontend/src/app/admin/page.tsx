import { DashboardShell } from "@/components/dashboard-shell";
import { AdminOverview } from "@/components/admin-overview";
import { workspaceCopy } from "@/lib/workspaces";

export default function AdminDashboard() {
  return <DashboardShell {...workspaceCopy.admin}>
    <AdminOverview />
  </DashboardShell>;
}
