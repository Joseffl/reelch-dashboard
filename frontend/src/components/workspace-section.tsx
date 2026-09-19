import { DashboardShell } from "@/components/dashboard-shell";
import { workspaceCopy } from "@/lib/workspaces";

const descriptions: Record<string, { title: string; description: string }> = {
  campaigns: { title: "Campaigns", description: "Create, review, fund, and monitor campaigns through every lifecycle state." },
  promoters: { title: "Promoter network", description: "Find distribution partners using verified performance and audience fit." },
  analytics: { title: "Analytics", description: "Understand spend, verified outcomes, conversion efficiency, and marketplace health." },
  wallet: { title: "Wallet & ledger", description: "Trace available, reserved, consumed, and returned campaign funds." },
  disputes: { title: "Disputes", description: "Raise, evidence, review, and resolve contested results with a complete decision trail." },
  notifications: { title: "Notifications", description: "Keep track of verification, campaign, payment, and dispute decisions." },
  profile: { title: "Profile", description: "Review the identity and workspace information associated with your account." },
  settings: { title: "Settings", description: "Manage workspace preferences, security, and notification choices." },
  discover: { title: "Discover campaigns", description: "Browse live opportunities matched to your channels and performance." },
  proofs: { title: "Proof submissions", description: "Submit or review campaign evidence with an explicit verification state." },
  earnings: { title: "Earnings", description: "See verified earnings and the ledger movements behind the available balance." },
  withdrawals: { title: "Withdrawals", description: "Request, review, and reconcile promoter payouts without double spending." },
  verifications: { title: "Verification queue", description: "Review business and promoter evidence and record accountable decisions." },
  ledger: { title: "Platform ledger", description: "Audit balanced financial transactions and immutable correcting entries." },
};

export function WorkspaceSection({ workspace, section }: { workspace: keyof typeof workspaceCopy; section: string }) {
  const copy = descriptions[section];
  if (!copy) return null;
  return <DashboardShell {...workspaceCopy[workspace]} title={copy.title} description={copy.description}>
    <section className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_45px_rgba(21,23,15,0.05)]">
      <div className="grid min-h-64 place-items-center p-8 text-center"><p className="text-sm font-bold">No records yet</p></div>
    </section>
  </DashboardShell>;
}
