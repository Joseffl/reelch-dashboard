"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/loading-skeleton";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Campaign = {
  id: string;
  title: string;
  status: string;
  budgetKobo: number;
  currency: string;
};

type Wallet = {
  balanceKobo: number;
  currency: string;
  account: null | {
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankSlug: string;
    currency: string;
    isActive: boolean;
  };
  entries: Array<{
    id: string;
    direction: "credit" | "debit";
    amountKobo: number;
    createdAt: string;
    type: string;
    reference: string;
    title: string;
    description?: string;
    source: string;
  }>;
};

function money(value: number) {
  return `₦${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(Array.isArray(body.message) ? body.message[0] : body.message || "Something went wrong");
  }
  return body;
}

export function BusinessWallet() {
  const params = useSearchParams();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [campaigns, walletData] = await Promise.all([
        fetch(`${apiUrl}/business/campaigns`, { credentials: "include" }).then(responseJson),
        fetch(`${apiUrl}/business/wallet`, { credentials: "include" }).then(responseJson),
      ]);
      setItems(campaigns);
      setWallet(walletData);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Could not load your wallet");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A Paystack redirect is an external event; verify it once when the callback lands.
  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref");
    const campaignId = params.get("campaignId");
    if (!reference || !campaignId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(campaignId);
    fetch(`${apiUrl}/business/campaigns/${campaignId}/funding/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    })
      .then(responseJson)
      .then(async () => {
        setNotice("Payment verified. Your campaign is now live.");
        await load();
        history.replaceState({}, "", "/business/wallet");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Payment could not be verified"))
      .finally(() => setBusy(""));
  }, [params, load]);

  async function createAccount() {
    setBusy("account");
    setError("");
    try {
      await fetch(`${apiUrl}/business/wallet/virtual-account`, {
        method: "POST",
        credentials: "include",
      }).then(responseJson);
      await load();
      setNotice("Your account number is ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your account number");
    } finally {
      setBusy("");
    }
  }

  async function pay(campaign: Campaign) {
    setBusy(campaign.id);
    setError("");
    try {
      const body = await fetch(`${apiUrl}/business/campaigns/${campaign.id}/funding/initialize`, {
        method: "POST",
        credentials: "include",
      }).then(responseJson);
      window.location.assign(body.authorizationUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start payment");
      setBusy("");
    }
  }

  async function fundWithBalance(campaign: Campaign) {
    setBusy(`wallet-${campaign.id}`);
    setError("");
    try {
      await fetch(`${apiUrl}/business/campaigns/${campaign.id}/funding/wallet`, {
        method: "POST",
        credentials: "include",
      }).then(responseJson);
      setNotice(`${campaign.title} is now funded and live.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fund this campaign");
    } finally {
      setBusy("");
    }
  }

  async function copyNumber() {
    if (!wallet?.account) return;
    await navigator.clipboard.writeText(wallet.account.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (!items || !wallet) {
    return <DashboardSkeleton />;
  }

  const payable = items.filter((item) => item.status === "funding_required");
  const funded = items.filter((item) => ["live", "paused", "completed"].includes(item.status));

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {notice && (
        <div className="flex items-start gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-bold text-lime-900 sm:items-center">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 sm:mt-0" />
          {notice}
        </div>
      )}
      {error && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-[1.6rem] bg-[#171811] text-white shadow-[0_18px_50px_rgba(23,24,17,.12)]">
        <div className="p-5 sm:p-7 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <div className="flex items-center gap-2 text-[0.67rem] font-bold uppercase tracking-[.16em] text-white/45">
              <WalletCards className="size-4 text-[#9cff57]" /> Available balance
            </div>
            <p className="mt-3 text-[2rem] font-black leading-none tracking-[-.045em] sm:text-[2.65rem]">
              {money(wallet.balanceKobo)}
            </p>
          </div>
          <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-white/45 lg:mt-0 lg:max-w-xs lg:border-l lg:border-t-0 lg:py-2 lg:pl-6">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#9cff57]" />
            Payments are verified before funds become available.
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)] lg:items-start">
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 shadow-[0_10px_35px_rgba(21,23,15,.035)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#6558ff]">Campaign funding</p>
                <h2 className="mt-2 text-xl font-black tracking-[-.025em]">Ready to fund</h2>
              </div>
              <span className="grid min-w-9 place-items-center rounded-full bg-[#edeaff] px-3 py-2 text-xs font-black text-[#5145e5]">
                {payable.length}
              </span>
            </div>

            <div className="mt-5 divide-y divide-black/[.07]">
              {payable.map((campaign) => {
                const hasBalance = wallet.balanceKobo >= campaign.budgetKobo;
                return (
                  <article key={campaign.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-black">{campaign.title}</h3>
                        <p className="mt-1 text-xs text-black/42">Approved campaign</p>
                      </div>
                      <p className="shrink-0 text-lg font-black tracking-[-.025em]">{money(campaign.budgetKobo)}</p>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => pay(campaign)}
                        disabled={Boolean(busy)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#171811] px-4 text-sm font-bold text-white transition hover:bg-[#6558ff] disabled:opacity-50"
                      >
                        {busy === campaign.id ? <LoaderCircle className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                        Pay with Paystack
                      </button>
                      <button
                        onClick={() => fundWithBalance(campaign)}
                        disabled={Boolean(busy) || !hasBalance}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-bold transition hover:bg-black/[.03] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {busy === `wallet-${campaign.id}` && <LoaderCircle className="size-4 animate-spin" />}
                        Use wallet balance
                      </button>
                    </div>
                    {!hasBalance && <p className="mt-2 text-xs text-black/38">Your wallet balance is below this campaign budget.</p>}
                  </article>
                );
              })}
              {!payable.length && (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto size-7 text-black/20" />
                  <p className="mt-3 text-sm font-bold">Nothing waiting for funding</p>
                  <p className="mt-1 text-xs text-black/40">Approved campaigns will appear here.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 shadow-[0_10px_35px_rgba(21,23,15,.035)] sm:p-6">
            <h2 className="text-lg font-black">Recent activity</h2>
            <div className="mt-4 divide-y divide-black/[.07]">
              {wallet.entries.slice(0, 8).map((entry) => {
                const incoming = entry.direction === "credit";
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${incoming ? "bg-lime-100 text-green-800" : "bg-black/[.045] text-black/55"}`}>
                      {incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{entry.title}</p>
                      {entry.description && <p className="mt-0.5 truncate text-xs text-black/50">{entry.description}</p>}
                      <p className="mt-1 truncate text-[0.7rem] text-black/38">
                        {entry.source} · {new Date(entry.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <p className={`ml-auto shrink-0 text-sm font-black ${incoming ? "text-green-700" : "text-black"}`}>
                      {incoming ? "+" : "−"}{money(entry.amountKobo)}
                    </p>
                  </div>
                );
              })}
              {!wallet.entries.length && <p className="py-9 text-center text-sm text-black/40">No transactions yet.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-8">
          <section className="rounded-[1.6rem] border border-black/[.08] bg-white p-5 shadow-[0_10px_35px_rgba(21,23,15,.035)] sm:p-6">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#6558ff]">
              <Building2 className="size-4" /> Bank transfer
            </div>
            {wallet.account ? (
              <>
                <p className="mt-5 text-xs font-bold text-black/42">{wallet.account.bankName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 break-all text-2xl font-black tracking-[.035em] sm:text-3xl">{wallet.account.accountNumber}</p>
                  <button
                    onClick={copyNumber}
                    aria-label="Copy account number"
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/[.045] transition hover:bg-black/[.08]"
                  >
                    {copied ? <Check className="size-4 text-green-700" /> : <Copy className="size-4" />}
                  </button>
                </div>
                <p className="mt-2 text-sm text-black/50">{wallet.account.accountName}</p>
                <p className="mt-5 border-t border-black/[.07] pt-4 text-xs leading-5 text-black/42">
                  Transfer to this account to add money to your wallet.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-xl font-black">Get an account number</h2>
                <p className="mt-2 text-sm leading-6 text-black/48">Generate a unique Paystack account for bank transfers.</p>
                <button
                  onClick={createAccount}
                  disabled={Boolean(busy)}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy === "account" ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  Generate account number
                </button>
              </>
            )}
          </section>

          {!!funded.length && (
            <details className="group rounded-[1.6rem] border border-black/[.08] bg-white shadow-[0_10px_35px_rgba(21,23,15,.035)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-black sm:p-6">
                <span>Funded campaigns <span className="ml-1 text-black/35">{funded.length}</span></span>
                <ChevronDown className="size-4 text-black/40 transition group-open:rotate-180" />
              </summary>
              <div className="divide-y divide-black/[.07] border-t border-black/[.07] px-5 sm:px-6">
                {funded.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{campaign.title}</p>
                      <p className="mt-1 text-xs capitalize text-black/38">{campaign.status}</p>
                    </div>
                    <p className="shrink-0 text-sm font-black">{money(campaign.budgetKobo)}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
