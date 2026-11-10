"use client";

import { useErrorToast, ErrorFallback, useSuccessToast } from "@/components/toasts";
import { ArrowUpRight, CheckCircle2, Clock3, LoaderCircle, Mail, Send, WalletCards, XCircle } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { formatMoney } from "@/lib/money";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Earnings = {
  availableKobo: number;
  currency: string;
  paymentProvider: "paypal" | "paystack";
  minimumWithdrawalKobo: number;
  payoutAccount: null | { id: string; provider: string; email: string };
  entries: Array<{ direction: "credit" | "debit"; amountKobo: number; createdAt: string; type: string; reference: string }>;
  withdrawals: Array<{ id: string; amountKobo: number; currency: string; status: string; idempotencyKey: string; failureReason?: string | null; createdAt: string }>;
};

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message[0] : body.message || "Request failed");
  return body;
}

const statusView: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  paid: { label: "Paid", icon: <CheckCircle2 className="size-4" />, tone: "bg-lime-100 text-green-800" },
  processing: { label: "Sending to PayPal", icon: <Clock3 className="size-4" />, tone: "bg-amber-100 text-amber-800" },
  requested: { label: "Requested", icon: <Clock3 className="size-4" />, tone: "bg-black/5 text-black/60" },
  reviewing: { label: "Under review", icon: <Clock3 className="size-4" />, tone: "bg-black/5 text-black/60" },
  failed: { label: "Failed · returned to balance", icon: <XCircle className="size-4" />, tone: "bg-red-100 text-red-700" },
};

export function PromoterEarnings() {
  const [data, setData] = useState<Earnings | null>(null);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useErrorToast();
  const setNotice = useSuccessToast();

  const load = useCallback(() => fetch(`${apiUrl}/promoter/earnings`, { credentials: "include" }).then(json).then(setData)
    .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load earnings")), [setError]);
  useEffect(() => { void load(); }, [load]);

  async function linkPaypal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setBusy("account");
    try {
      await fetch(`${apiUrl}/promoter/payout-accounts/paypal`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).then(json);
      setEditing(false);
      setNotice("PayPal account saved. Verified earnings will be paid there automatically.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your PayPal email");
    } finally {
      setBusy("");
    }
  }

  async function withdraw() {
    if (!data?.payoutAccount) return;
    setBusy("withdraw");
    try {
      await fetch(`${apiUrl}/promoter/withdrawals`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ payoutAccountId: data.payoutAccount.id, amountKobo: data.availableKobo }),
      }).then(json);
      setNotice("Withdrawal sent to PayPal.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Withdrawal failed");
      await load();
    } finally {
      setBusy("");
    }
  }

  if (!data) return error ? <ErrorFallback /> : <DashboardSkeleton />;
  const money = (value: number, currency = data.currency) => formatMoney(value, currency);
  const canWithdraw = Boolean(data.payoutAccount) && data.availableKobo >= data.minimumWithdrawalKobo;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="overflow-hidden rounded-[1.6rem] bg-[#171811] p-5 text-white sm:p-7 lg:flex lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[0.67rem] font-bold uppercase tracking-[.16em] text-white/45"><WalletCards className="size-4 text-[#9cff57]" /> Available earnings</div>
          <p className="mt-3 text-[2rem] font-black leading-none tracking-[-.045em] sm:text-[2.65rem]">{money(data.availableKobo)}</p>
          <p className="mt-3 max-w-md text-xs leading-5 text-white/45">Every approved proof is checked by Reelch AI verification. Low-risk passes are paid to your PayPal straight away.</p>
        </div>
        {data.paymentProvider === "paypal" && (
          <button onClick={withdraw} disabled={!canWithdraw || Boolean(busy)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ffc439] px-5 text-sm font-black text-[#111] disabled:opacity-40 lg:mt-0">
            {busy === "withdraw" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Withdraw to PayPal
          </button>
        )}
      </section>

      {data.paymentProvider === "paypal" && (
        <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#6558ff]"><Mail className="size-4" /> PayPal payouts</div>
          {data.payoutAccount && !editing ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black">{data.payoutAccount.email}</p>
                <p className="mt-1 text-xs text-black/45">Verified earnings are sent to this PayPal account automatically.</p>
              </div>
              <button onClick={() => setEditing(true)} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-bold">Change</button>
            </div>
          ) : (
            <form onSubmit={linkPaypal} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input name="email" type="email" required defaultValue={data.payoutAccount?.email} placeholder="you@example.com" className="h-12 min-w-0 flex-1 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-[#6558ff]" />
              <button disabled={busy === "account"} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white disabled:opacity-50">
                {busy === "account" && <LoaderCircle className="size-4 animate-spin" />} Save PayPal email
              </button>
            </form>
          )}
          {!data.payoutAccount && <p className="mt-3 text-xs text-black/45">Add the email address of your PayPal account to receive automatic payouts.</p>}
        </section>
      )}

      <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-black">Payouts</h2>
        <div className="mt-4 divide-y divide-black/[.07]">
          {data.withdrawals.map((withdrawal) => {
            const view = statusView[withdrawal.status] ?? statusView.requested;
            return (
              <div key={withdrawal.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/[.045] text-black/55"><ArrowUpRight className="size-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-black">{withdrawal.idempotencyKey.startsWith("auto-proof:") ? "Automatic payout for verified proof" : "Withdrawal"}</p>
                  <p className="mt-0.5 text-xs text-black/40">{new Date(withdrawal.createdAt).toLocaleString()}</p>
                  {withdrawal.failureReason && withdrawal.status !== "paid" && <p className="mt-1 text-xs text-red-700">{withdrawal.failureReason}</p>}
                </div>
                <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${view.tone}`}>{view.icon}{view.label}</span>
                <p className="w-24 text-right text-sm font-black">{money(withdrawal.amountKobo, withdrawal.currency)}</p>
              </div>
            );
          })}
          {!data.withdrawals.length && <p className="py-9 text-center text-sm text-black/40">No payouts yet.</p>}
        </div>
      </section>
    </div>
  );
}
