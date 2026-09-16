"use client";

import Link from "next/link";
import { ArrowRight, Building2, LoaderCircle, Search, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Item = { id: string; kind: "business" | "promoter"; status: string; submittedAt: string; userId: string; email: string; displayName: string; isActive: boolean };
type Result = { items: Item[]; pagination: { page: number; pages: number; total: number } };
const statuses = ["pending", "more_information_required", "approved", "rejected", "draft"];
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AdminVerificationQueue() {
  const [status, setStatus] = useState("pending"); const [query, setQuery] = useState(""); const [search, setSearch] = useState("");
  const [result, setResult] = useState<Result | null>(null); const [page, setPage] = useState(1); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/admin/verifications?status=${encodeURIComponent(status)}&query=${encodeURIComponent(search)}&page=${page}`, { credentials: "include" })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load verification queue"); return response.json() as Promise<Result>; })
      .then((data) => { if (active) { setResult(data); setError(""); } })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [page, search, status]);
  function submitSearch(event: FormEvent) { event.preventDefault(); setPage(1); setSearch(query.trim()); }

  return <section className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_45px_rgba(21,23,15,0.05)]">
    <div className="border-b border-black/[0.08] p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-lg font-black">Verification requests</h2><p className="mt-1 text-sm text-black/45">Oldest pending submissions appear first.</p></div><form onSubmit={submitSearch} className="flex min-w-0 gap-2 sm:min-w-80"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 px-3"><Search className="size-4 text-black/35" /><input aria-label="Search verifications" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Name or email" /></label><button className="rounded-xl bg-[#171811] px-4 text-sm font-bold text-white">Search</button></form></div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{statuses.map((value) => <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold capitalize ${status === value ? "bg-[#171811] text-white" : "bg-black/5 text-black/50"}`}>{value.replaceAll("_", " ")}</button>)}</div>
    </div>
    {error ? <p role="alert" className="p-6 text-sm font-bold text-red-700">{error}</p> : !result ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-7 animate-spin text-[#6558ff]" /></div> : result.items.length === 0 ? <div className="grid min-h-64 place-items-center p-6 text-center"><div><p className="font-bold">No {status.replaceAll("_", " ")} requests</p><p className="mt-2 text-sm text-black/45">New matching submissions will appear here.</p></div></div> : <div className="divide-y divide-black/[0.07]">{result.items.map((item) => { const Icon = item.kind === "business" ? Building2 : UserRound; return <Link key={item.id} href={`/admin/verifications/${item.id}`} className="group grid gap-4 p-5 transition hover:bg-[#f8f7f2] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"><div className="flex min-w-0 items-center gap-4"><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.kind === "business" ? "bg-[#9cff57]" : "bg-violet-300"}`}><Icon className="size-5" /></span><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-black">{item.displayName}</p>{!item.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-bold text-red-700">Suspended</span>}</div><p className="truncate text-sm text-black/45">{item.email}</p></div></div><div className="flex items-center justify-between gap-5 pl-15 sm:pl-0"><div className="text-left sm:text-right"><p className="text-xs font-bold capitalize">{item.kind}</p><p className="mt-1 text-xs text-black/40">{new Date(item.submittedAt).toLocaleDateString()}</p></div><ArrowRight className="size-4 text-black/25 transition group-hover:translate-x-1 group-hover:text-black" /></div></Link>; })}</div>}
    {result && result.pagination.pages > 1 && <div className="flex items-center justify-between border-t border-black/[0.08] p-5 text-sm"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="font-bold disabled:opacity-30">Previous</button><span className="text-black/45">Page {page} of {result.pagination.pages} · {result.pagination.total} requests</span><button disabled={page >= result.pagination.pages} onClick={() => setPage((value) => value + 1)} className="font-bold disabled:opacity-30">Next</button></div>}
  </section>;
}
