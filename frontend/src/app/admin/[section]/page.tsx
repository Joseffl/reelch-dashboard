import { notFound } from "next/navigation";
import { NotificationsPage } from "@/components/notifications-page";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminVerificationQueue } from "@/components/admin-verification-queue";
import { AdminCampaigns } from "@/components/admin-campaigns";
import { ProfilePage } from "@/components/profile-page";
import { AdminProofs } from "@/components/admin-proofs";
import { AdminWaitlist } from "@/components/admin-waitlist";
import { AdminContactEnquiries } from "@/components/admin-contact-enquiries";
import { Administrators } from "@/components/administrators";
import { AdminLedger } from "@/components/admin-ledger";
import { AdminWithdrawals } from "@/components/admin-withdrawals";
import { workspaceCopy } from "@/lib/workspaces";

const sections = new Set(["verifications", "waitlist", "enquiries", "campaigns", "proofs", "withdrawals", "ledger", "notifications", "administrators", "profile"]);
export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  if (section === "verifications") return <DashboardShell {...workspaceCopy.admin} title="Verification queue" description="Review business and promoter identities, inspect private evidence, and record accountable decisions."><AdminVerificationQueue /></DashboardShell>;
  if (section === "waitlist") return <DashboardShell {...workspaceCopy.admin} title="Promoter waitlist"><AdminWaitlist /></DashboardShell>;
  if (section === "enquiries") return <DashboardShell {...workspaceCopy.admin} title="Contact enquiries" description="Review messages submitted through the Reelch contact page and track each response."><AdminContactEnquiries /></DashboardShell>;
  if (section === "campaigns") return <DashboardShell {...workspaceCopy.admin} title="Campaign moderation" description="Review campaign terms, budgets, targeting, images or videos, and business readiness."><AdminCampaigns /></DashboardShell>;
  if (section === "proofs") return <DashboardShell {...workspaceCopy.admin} title="Proof review"><AdminProofs /></DashboardShell>;
  if (section === "withdrawals") return <DashboardShell {...workspaceCopy.admin} title="Withdrawals" description="Every promoter payout, with its PayPal status and any failure reason."><AdminWithdrawals /></DashboardShell>;
  if (section === "ledger") return <DashboardShell {...workspaceCopy.admin} title="Platform ledger" description="Every money movement on Reelch, recorded as balanced double-entry transactions."><AdminLedger /></DashboardShell>;
  if (section === "administrators") return <DashboardShell {...workspaceCopy.admin} title="Administrators" description="Invite administrators and control access to Reelch Admin dashboard."><Administrators /></DashboardShell>;
  if (section === "profile") return <DashboardShell {...workspaceCopy.admin} title="Profile" description="Manage your account profile."><ProfilePage /></DashboardShell>;
  return <DashboardShell {...workspaceCopy.admin} title="Notifications" description="Updates for your administrator account."><NotificationsPage role="admin" /></DashboardShell>;
}
