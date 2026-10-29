"use client";

import { useErrorToast, ErrorFallback } from "@/components/toasts";

import Link from "next/link";
import { ArrowRight, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";

type Campaign = { id: string; title: string; description: string; status: string; budgetKobo: number; verifiedQuantity: number; targetQuantity: number; updatedAt: string };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function BusinessCampaigns() {
  const [error, setError] = useErrorToast();
  const [items, setItems] = useState<Campaign[] | null>(null);
  useEffect(() => { fetch(`${apiUrl}/business/campaigns`, { credentials: "include" }).then((response) => response.ok ? response.json() : Promise.reject()).then(setItems).catch(() => { setError("Unable to load campaigns. Please try again."); setItems([]); }); }, [setError]);
  if (error) return <ErrorFallback />;
  return <section className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_45px_rgba(21,23,15,0.05)]"><div className="flex items-center justify-between border-b border-black/[0.08] p-5 sm:p-6"><div><h2 className="text-lg font-black">Your campaigns</h2><p className="mt-1 text-sm text-black/45">Draft, submit, and monitor every campaign.</p></div><Link href="/business/campaigns/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#171811] px-4 text-sm font-bold text-white"><Plus className="size-4" /> New campaign</Link></div>{!items ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-7 animate-spin text-[#6558ff]" /></div> : !items.length ? <div className="grid min-h-64 place-items-center p-6 text-center"><div><p className="font-bold">No campaigns yet</p><p className="mt-2 text-sm text-black/45">Create your first measurable campaign.</p></div></div> : <div className="divide-y divide-black/[0.07]">{items.map((campaign) => <Link key={campaign.id} href={`/business/campaigns/${campaign.id}`} className="group grid gap-4 p-5 hover:bg-[#f8f7f2] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{campaign.title}</p><span className="rounded-full bg-black/5 px-2.5 py-1 text-[0.65rem] font-bold capitalize">{campaign.status.replaceAll("_", " ")}</span></div><p className="mt-1 line-clamp-1 text-sm text-black/45">{campaign.description}</p></div><div className="flex items-center gap-5"><div className="text-right"><p className="text-sm font-black">₦{(campaign.budgetKobo / 100).toLocaleString()}</p><p className="text-xs text-black/40">{campaign.verifiedQuantity}/{campaign.targetQuantity} results</p></div><ArrowRight className="size-4 text-black/30 transition group-hover:translate-x-1" /></div></Link>)}</div>}</section>;
}
