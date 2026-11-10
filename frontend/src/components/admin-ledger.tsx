"use client";

import type { ColDef } from "ag-grid-community";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataGrid, dateColumn, moneyColumn } from "@/components/data-grid";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { ErrorFallback, useErrorToast } from "@/components/toasts";
import { formatMoney } from "@/lib/money";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Transaction = { id: string; createdAt: string; type: string; reference: string; status: string; currency: string; amountKobo: number; from: string[]; to: string[]; balanced: boolean };
type Ledger = { accounts: Array<{ ownerType: string; currency: string; netKobo: number }>; unbalancedTransactions: number; transactions: Transaction[] };

const accountName: Record<string, string> = {
  campaign_reserve: "Campaign escrow",
  payment_clearing: "Payments received",
  payout_clearing: "Paid out",
  promoter: "Promoter balances",
  business: "Business wallets",
};
const nameOf = (account: string) => accountName[account] ?? account.replaceAll("_", " ");
const names = (accounts: string[]) => accounts.map(nameOf).join(", ");

export function AdminLedger() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useErrorToast();

  useEffect(() => {
    fetch(`${apiUrl}/admin/ledger`, { credentials: "include" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "Could not load the ledger");
        setLedger(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the ledger"));
  }, [setError]);

  const columns = useMemo<ColDef<Transaction>[]>(() => [
    { ...dateColumn<Transaction>("Date", (row) => row.createdAt), sort: "desc" },
    { headerName: "Type", field: "type", width: 150, valueFormatter: ({ value }) => String(value ?? "").replaceAll("_", " ") },
    { headerName: "From", width: 165, valueGetter: ({ data }) => (data ? names(data.from) : "") },
    { headerName: "To", width: 165, valueGetter: ({ data }) => (data ? names(data.to) : "") },
    moneyColumn<Transaction>("Amount", (row) => ({ minor: row.amountKobo, currency: row.currency })),
    { headerName: "Balanced", width: 110, valueGetter: ({ data }) => (data?.balanced ? "Yes" : "No") },
    { headerName: "Reference", field: "reference", flex: 1, minWidth: 220 },
  ], []);

  if (!ledger) return error ? <ErrorFallback /> : <DashboardSkeleton />;
  const balanced = ledger.unbalancedTransactions === 0;
  const cards = [...ledger.accounts].sort((a, b) => nameOf(a.ownerType).localeCompare(nameOf(b.ownerType)));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className={`flex items-center gap-2 rounded-2xl p-4 text-sm font-bold ${balanced ? "bg-lime-100 text-green-800" : "bg-red-100 text-red-700"}`}>
        {balanced ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
        {balanced ? "Every transaction balances: debits equal credits." : `${ledger.unbalancedTransactions} transactions do not balance. Investigate before paying out.`}
      </div>
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((account) => (
            <div key={`${account.ownerType}-${account.currency}`} className="rounded-2xl border border-black/[.08] bg-white p-4 sm:p-5">
              <p className="text-xs font-bold text-black/45">{nameOf(account.ownerType)}</p>
              <p className="mt-2 text-2xl font-black tracking-[-.03em]">{formatMoney(account.ownerType === "payment_clearing" ? -account.netKobo : account.netKobo, account.currency)}</p>
            </div>
          ))}
        </div>
      )}
      <DataGrid rows={ledger.transactions} columns={columns} fileName="reelch-ledger.csv" searchLabel="Search transactions" />
    </div>
  );
}
