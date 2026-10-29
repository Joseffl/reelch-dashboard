"use client";

import { useErrorToast, ErrorFallback } from "@/components/toasts";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyPanel, Metric } from "@/components/dashboard-shell";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function BusinessOverview() {
  const [error, setError] = useErrorToast();
  const [items,setItems]=useState<Array<{id:string;title:string;status:string;budgetKobo:number;verifiedQuantity:number;targetQuantity:number}>|null>(null);
  useEffect(()=>{fetch(`${apiUrl}/business/campaigns`,{credentials:"include"}).then(r=>r.ok?r.json():Promise.reject()).then(setItems).catch(()=>{setError("Unable to load campaigns. Please try again.");setItems([])});},[setError]);
  if(error)return <ErrorFallback/>;
  if(!items)return <DashboardSkeleton/>;
  const funded=items.filter(x=>["live","paused","completed"].includes(x.status)); const reserved=funded.reduce((s,x)=>s+x.budgetKobo,0); const verified=items.reduce((s,x)=>s+x.verifiedQuantity,0);
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Reserved" value={`₦${(reserved/100).toLocaleString()}`} note="Across funded campaigns"/><Metric label="Verified results" value={String(verified)} note="Payable outcomes"/><Metric label="Campaigns" value={String(items.length)} note="Across all states"/><Metric label="Live campaigns" value={String(items.filter(x=>x.status==="live").length)} note="Accepting promoters"/></div>{items.length?<div className="mt-6 overflow-hidden rounded-2xl border border-black/[.08] bg-white"><div className="flex items-center justify-between border-b border-black/[.07] p-5"><h2 className="font-black">Recent campaigns</h2><Link className="flex items-center gap-1 text-sm font-bold" href="/business/campaigns">View all <ArrowRight className="size-4"/></Link></div>{items.slice(0,4).map(x=><Link key={x.id} href={`/business/campaigns/${x.id}`} className="flex items-center justify-between border-b border-black/[.06] p-5 last:border-0 hover:bg-black/[.02]"><div><p className="font-bold">{x.title}</p><p className="mt-1 text-xs capitalize text-black/45">{x.status.replaceAll("_"," ")}</p></div><p className="text-sm font-black">{x.verifiedQuantity}/{x.targetQuantity}</p></Link>)}</div>:<EmptyPanel title="Build your first acquisition campaign" text="Choose a signup target and reward. Reelch calculates the budget before review and funding." action="Create campaign" href="/business/campaigns/new"/>}</>;
}

export function PromoterOverview() {
  const [error, setError] = useErrorToast();
  const [data,setData]=useState<{assignments:Array<{assignment:{status:string}}>;applications:Array<{application:{status:string}}>;earnings:{availableKobo:number}}|null>(null);
  useEffect(()=>{fetch(`${apiUrl}/promoter/workspace`,{credentials:"include"}).then(r=>r.ok?r.json():Promise.reject()).then(setData).catch(()=>{setError("Unable to load your workspace. Please try again.");setData({assignments:[],applications:[],earnings:{availableKobo:0}})});},[setError]);
  if(error)return <ErrorFallback/>;
  if(!data)return <DashboardSkeleton/>;
  return <><div className="grid gap-4 sm:grid-cols-3"><Metric label="Available" value={`₦${(data.earnings.availableKobo/100).toLocaleString()}`} note="Verified earnings"/><Metric label="Applications" value={String(data.applications.filter(x=>x.application.status==="applied").length)} note="Awaiting decisions"/><Metric label="Active campaigns" value={String(data.assignments.filter(x=>["accepted","active"].includes(x.assignment.status)).length)} note="Selected opportunities"/></div><EmptyPanel title={data.assignments.length?"Keep growing your campaign results":"Discover verified opportunities"} text="Browse approved campaigns, apply with your audience fit, and get a unique referral link when selected." action="View campaigns" href="/promoter/discover"/></>;
}
