"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Metric } from "@/components/dashboard-shell";
import { DashboardSkeleton } from "@/components/loading-skeleton";

type Overview = { campaigns: { live: number; verified: number }; risk: { openFlags: number }; verifications: { pending: number; businesses: number; promoters: number } };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { fetch(`${apiUrl}/admin/analytics/overview`, { credentials: "include" }).then((response) => response.ok ? response.json() : Promise.reject()).then(setData).catch(() => setData(null)); }, []);
  if (!data) return <DashboardSkeleton />;
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Pending reviews" value={String(data.verifications.pending)} note={`${data.verifications.businesses} businesses · ${data.verifications.promoters} promoters`} /><Metric label="Live campaigns" value={String(data.campaigns.live)} note="Across businesses" /><Metric label="Fraud alerts" value={String(data.risk.openFlags)} note="Unresolved signals" /><Metric label="Verified outcomes" value={String(data.campaigns.verified)} note="Platform lifetime" /></div>
    <section className="mt-5 flex flex-col gap-5 rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_10px_35px_rgba(21,23,15,0.04)] sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6558ff]">Priority queue</p><h2 className="mt-2 text-xl font-black">{data.verifications.pending ? `${data.verifications.pending} verification${data.verifications.pending === 1 ? "" : "s"} awaiting review` : "Verification queue is clear"}</h2><p className="mt-2 text-sm text-black/48">Review oldest submissions first and keep every decision accountable.</p></div><Link href="/admin/verifications" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#171811] px-5 text-sm font-bold text-white">Open queue <ArrowRight className="size-4" /></Link></section>
  </>;
}
