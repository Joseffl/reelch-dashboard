export function DashboardSkeleton({ dark = false }: { dark?: boolean }) {
  const block = dark ? "bg-white/10" : "bg-black/[0.07]";
  const card = dark ? "border-white/10 bg-white/[0.05]" : "border-black/[0.07] bg-white";
  return <div className={`w-full animate-pulse ${dark ? "bg-[#171811]" : ""}`} aria-label="Loading content" role="status">
    <span className="sr-only">Loading content</span>
    <div className="mx-auto w-full max-w-6xl space-y-6 p-5 sm:p-8">
      <div className={`h-4 w-28 rounded-full ${block}`} />
      <div className={`h-9 w-64 max-w-[75%] rounded-xl ${block}`} />
      <div className={`h-4 w-full max-w-md rounded-full ${block}`} />
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className={`h-28 rounded-2xl border ${card}`}><div className={`m-5 h-4 w-20 rounded-full ${block}`} /><div className={`mx-5 mt-5 h-7 w-24 rounded-lg ${block}`} /></div>)}</div>
      <div className={`rounded-2xl border p-5 ${card}`}>{[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 border-b border-black/[0.05] py-4 last:border-0"><div className={`size-11 shrink-0 rounded-xl ${block}`} /><div className="flex-1 space-y-2"><div className={`h-4 w-2/5 rounded-full ${block}`} /><div className={`h-3 w-3/5 rounded-full ${block}`} /></div></div>)}</div>
    </div>
  </div>;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="animate-pulse rounded-2xl border border-black/[0.07] bg-white p-5" aria-label="Loading content" role="status"><span className="sr-only">Loading content</span>{Array.from({ length: rows }, (_, item) => <div key={item} className="flex items-center gap-4 border-b border-black/[0.06] py-4 last:border-0"><div className="size-11 shrink-0 rounded-xl bg-black/[0.07]" /><div className="flex-1 space-y-2"><div className="h-4 w-2/5 rounded-full bg-black/[0.07]" /><div className="h-3 w-3/5 rounded-full bg-black/[0.06]" /></div><div className="hidden h-8 w-20 rounded-full bg-black/[0.06] sm:block" /></div>)}</div>;
}
