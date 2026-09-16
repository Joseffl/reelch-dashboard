import { AdminVerificationDetail } from "@/components/admin-verification-detail";
import { DashboardShell } from "@/components/dashboard-shell";
import { workspaceCopy } from "@/lib/workspaces";

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardShell {...workspaceCopy.admin} title="Verification review" description="Inspect the submitted profile and private evidence before recording a decision."><AdminVerificationDetail requestId={id} /></DashboardShell>;
}
