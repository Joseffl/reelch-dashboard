"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ACTIONS_COLUMN, DataGrid, dateColumn, moneyColumn } from "@/components/data-grid";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { ErrorFallback, toast, useErrorToast } from "@/components/toasts";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Withdrawal = { id: string; amountKobo: number; netAmountKobo: number; currency: string; status: string; idempotencyKey: string; providerReference: string | null; failureReason: string | null; createdAt: string; processedAt: string | null; provider: string; destination: string; username: string; displayName: string };

const tone: Record<string, string> = { paid: "bg-lime-100 text-green-800", failed: "bg-red-100 text-red-700", processing: "bg-amber-100 text-amber-800", reviewing: "bg-amber-100 text-amber-800", requested: "bg-black/5 text-black/60", cancelled: "bg-black/5 text-black/60" };

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message[0] : body.message || "Request failed");
  return body;
}

export function AdminWithdrawals() {
  const [rows, setRows] = useState<Withdrawal[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useErrorToast();

  const load = useCallback(() => fetch(`${apiUrl}/admin/withdrawals`, { credentials: "include" }).then(json).then(setRows)
    .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load withdrawals")), [setError]);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (row: Withdrawal, action: "paypal-payout" | "sync") => {
    if (action === "paypal-payout" && !window.confirm(`Send this payout to ${row.destination} via PayPal?`)) return;
    setBusy(row.id);
    try {
      await fetch(`${apiUrl}/admin/withdrawals/${row.id}/${action}`, { method: "POST", credentials: "include" }).then(json);
      toast.success(action === "sync" ? "Status updated from PayPal." : "Payout sent to PayPal.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PayPal request failed");
    } finally {
      await load();
      setBusy("");
    }
  }, [load, setError]);

  const columns = useMemo<ColDef<Withdrawal>[]>(() => [
    { ...dateColumn<Withdrawal>("Requested", (row) => row.createdAt), sort: "desc" },
    { headerName: "Promoter", width: 190, valueGetter: ({ data }) => (data ? `${data.displayName} (@${data.username})` : "") },
    moneyColumn<Withdrawal>("Amount", (row) => ({ minor: row.amountKobo, currency: row.currency })),
    {
      headerName: "Status", field: "status", width: 130,
      cellRenderer: ({ value }: ICellRendererParams<Withdrawal, string>) => <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone[value ?? ""] ?? tone.requested}`}>{value}</span>,
    },
    { headerName: "Source", width: 130, valueGetter: ({ data }) => (data?.idempotencyKey.startsWith("auto-proof:") ? "AI auto-payout" : "Withdrawal") },
    { headerName: "Paid to", field: "destination", width: 240 },
    { headerName: "Provider reference", field: "providerReference", width: 190 },
    { headerName: "Failure reason", field: "failureReason", width: 280, tooltipField: "failureReason" },
    {
      // On phones a pinned column would take half the screen, so the action scrolls with the row.
      colId: ACTIONS_COLUMN, headerName: "Action", width: 160, pinned: typeof window !== "undefined" && window.innerWidth >= 640 ? "right" : undefined, sortable: false, filter: false,
      cellRenderer: ({ data }: ICellRendererParams<Withdrawal>) => {
        if (!data || data.provider !== "paypal") return null;
        const action = ["requested", "reviewing"].includes(data.status) ? "paypal-payout" : data.status === "processing" && data.providerReference ? "sync" : null;
        if (!action) return null;
        return (
          <button onClick={() => act(data, action)} disabled={Boolean(busy)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#171811] px-3 text-xs font-bold text-white disabled:opacity-50">
            {busy === data.id && <LoaderCircle className="size-3 animate-spin" />}
            {action === "sync" ? "Check status" : "Send via PayPal"}
          </button>
        );
      },
    },
  ], [act, busy]);

  if (!rows) return error ? <ErrorFallback /> : <DashboardSkeleton />;
  const count = (...statuses: string[]) => rows.filter((row) => statuses.includes(row.status)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Paid", count("paid")], ["With PayPal", count("processing")], ["Needs action", count("requested", "reviewing")], ["Failed", count("failed")]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-black/[.08] bg-white p-4 sm:p-5">
            <p className="text-xs font-bold text-black/45">{label}</p>
            <p className="mt-2 text-2xl font-black tracking-[-.03em]">{value}</p>
          </div>
        ))}
      </div>
      <DataGrid rows={rows} columns={columns} fileName="reelch-withdrawals.csv" searchLabel="Search withdrawals" />
    </div>
  );
}
