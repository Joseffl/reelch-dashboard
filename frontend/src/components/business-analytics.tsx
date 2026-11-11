"use client";

import { ErrorFallback } from "@/components/toasts";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { formatMoney } from "@/lib/money";
import { ArrowUp, Bot, LoaderCircle, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Analytics = {
  currency: string;
  totals: { campaigns: number; liveCampaigns: number; approvedPosts: number; pendingPosts: number; rejectedPosts: number; views: number; spentKobo: number; fundedKobo: number; refundedKobo?: number; escrowKobo?: number; costPerThousandViewsKobo: number | null };
  byPlatform: Array<{ platform: string; label: string; posts: number; views: number; share: number; spentKobo: number; costPerThousandViewsKobo: number | null }>;
  byCampaign: Array<{ id: string; title: string; status: string; posts: number; targetPosts: number; submitted: number; flagged: number; views: number; spentKobo: number; fundedKobo: number; costPerThousandViewsKobo: number | null; platformViews: Record<string, number> }>;
  timeline: Array<{ date: string; views: number; posts: number }>;
  ai: { reviewed: number; autoApproved: number; sentToPerson: number; highRisk: number };
};
type Turn = { role: "user" | "assistant"; text: string; highlights?: Array<{ label: string; value: string }>; followUps?: string[] };

// Categorical slots in fixed order, keyed by platform so a platform keeps its colour everywhere.
// Validated for colour-vision deficiency; the two low-contrast slots always carry visible labels.
const platformColor: Record<string, string> = { tiktok: "#2a78d6", instagram: "#eb6834", x: "#1baf7a", whatsapp: "#eda100" };
const platformOrder = ["tiktok", "instagram", "x", "whatsapp"];
const platformLabel: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", x: "X", whatsapp: "WhatsApp" };
const brand = "#6558ff";
const number = (value: number) => value.toLocaleString("en-US");
const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const starters = ["Which campaign is performing best?", "Which platform brings in the most views?", "What am I paying per 1,000 views?"];

export function BusinessAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`${apiUrl}/business/analytics`, { credentials: "include" })
      .then(async response => { if (!response.ok) throw new Error(); setData(await response.json()); })
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <ErrorFallback />;
  if (!data) return <DashboardSkeleton />;
  const money = (value: number | null) => value == null ? "–" : formatMoney(value, data.currency);
  const empty = data.totals.approvedPosts === 0;

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
    <div className="min-w-0 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Verified views" value={number(data.totals.views)} note={`${data.totals.approvedPosts} verified posts`} />
        <Stat label="Spent on results" value={money(data.totals.spentKobo)} note={`of ${money(data.totals.fundedKobo)} funded`} />
        <Stat label="Cost per 1,000 views" value={money(data.totals.costPerThousandViewsKobo)} note="Verified views only" />
        <Stat label="Auto-approved by AI" value={`${data.ai.autoApproved} of ${data.ai.reviewed}`} note={`${data.ai.highRisk} high-risk ${data.ai.highRisk === 1 ? "proof" : "proofs"} caught`} />
      </div>
      {empty ? <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center text-sm text-black/50">Charts appear once promoters deliver verified posts on your live campaigns.</div> : <>
        <div className="grid gap-6 lg:grid-cols-2">
          <PieCard title="Where your views come from" subtitle="Share of verified views by platform" total={number(data.totals.views)} totalLabel="views"
            slices={platformSlices(data.byPlatform, row => row.views)} format={value => `${number(value)} views`} />
          <PieCard title="Where your money goes" subtitle="Rewards paid, by platform" total={money(data.totals.spentKobo)} totalLabel="paid"
            slices={platformSlices(data.byPlatform, row => row.spentKobo)} format={value => money(value)} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <PieCard title="Your budget" subtitle="Everything you funded with PayPal" total={money(data.totals.fundedKobo)} totalLabel="funded"
            slices={[
              { key: "paid", label: "Paid out", value: data.totals.spentKobo, color: brand },
              { key: "escrow", label: "In escrow", value: data.totals.escrowKobo ?? Math.max(0, data.totals.fundedKobo - data.totals.spentKobo), color: "#a59dff" },
              { key: "refunded", label: "Refunded", value: data.totals.refundedKobo ?? 0, color: "#d6d2fb" },
            ]} format={value => money(value)} />
          <CostBars rows={data.byPlatform} money={money} />
        </div>
        <PlatformTable rows={data.byPlatform} money={money} />
        <CampaignBars rows={data.byCampaign} money={money} />
        <Timeline rows={data.timeline} />
      </>}
    </div>
    <Assistant />
  </div>;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-2xl border border-black/[.08] bg-white p-5">
    <p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">{label}</p>
    <p className="mt-3 text-[28px] font-black leading-none tracking-[-.04em] text-[#171811]">{value}</p>
    <p className="mt-2 text-xs text-black/50">{note}</p>
  </div>;
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-black/[.08] bg-white p-5 sm:p-6">
    <h2 className="text-lg font-black tracking-[-.02em]">{title}</h2>
    <p className="mt-1 text-sm text-black/50">{subtitle}</p>
    <div className="mt-5">{children}</div>
  </section>;
}

type Slice = { key: string; label: string; value: number; color: string };
const sortPlatforms = <T extends { platform: string }>(rows: T[]) => [...rows].sort((a, b) => platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform));
const platformSlices = (rows: Analytics["byPlatform"], value: (row: Analytics["byPlatform"][number]) => number): Slice[] =>
  sortPlatforms(rows).map(row => ({ key: row.platform, label: row.label, value: value(row), color: platformColor[row.platform] ?? brand }));

// Pie (ring) chart with the total in the middle and a legend that doubles as the data table.
function PieCard({ title, subtitle, slices, total, totalLabel, format }: { title: string; subtitle: string; slices: Slice[]; total: string; totalLabel: string; format: (value: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = slices.filter(slice => slice.value > 0); const sum = shown.reduce((acc, slice) => acc + slice.value, 0);
  const size = 168, center = size / 2, outer = 80, inner = 52;
  const point = (radius: number, turn: number) => [center + radius * Math.sin(turn * 2 * Math.PI), center - radius * Math.cos(turn * 2 * Math.PI)];
  const shares = shown.map(slice => sum ? slice.value / sum : 0);
  const arcs = shown.map((slice, index) => {
    const share = shares[index]; const start = shares.slice(0, index).reduce((acc, value) => acc + value, 0); const end = start + share; const large = share > .5 ? 1 : 0;
    const [x1, y1] = point(outer, start), [x2, y2] = point(outer, end), [x3, y3] = point(inner, end), [x4, y4] = point(inner, start);
    const path = share >= .9999
      ? `M ${center} ${center - outer} A ${outer} ${outer} 0 1 1 ${center - .01} ${center - outer} Z M ${center} ${center - inner} A ${inner} ${inner} 0 1 0 ${center - .01} ${center - inner} Z`
      : `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
    return { ...slice, share, path };
  });
  const active = arcs.find(arc => arc.key === hover);
  return <Card title={title} subtitle={subtitle}>
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${arcs.map(arc => `${arc.label} ${Math.round(arc.share * 100)}%`).join(", ")}`}>
          {!arcs.length && <circle cx={center} cy={center} r={(outer + inner) / 2} fill="none" stroke="#f1efe9" strokeWidth={outer - inner} />}
          {arcs.map(arc => <path key={arc.key} d={arc.path} fill={arc.color} fillRule="evenodd" stroke="#fff" strokeWidth={2} strokeLinejoin="round"
            onMouseEnter={() => setHover(arc.key)} onMouseLeave={() => setHover(null)}
            style={{ opacity: hover && hover !== arc.key ? .4 : 1, transition: "opacity .15s" }}><title>{`${arc.label}: ${format(arc.value)} (${Math.round(arc.share * 100)}%)`}</title></path>)}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="text-lg font-black leading-tight tabular-nums text-[#171811]">{active ? `${Math.round(active.share * 100)}%` : total}</p>
            <p className="mt-0.5 max-w-[92px] text-[11px] leading-tight text-black/45">{active ? active.label : totalLabel}</p></div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {slices.map(slice => { const share = sum ? slice.value / sum : 0; return <li key={slice.key} onMouseEnter={() => setHover(slice.key)} onMouseLeave={() => setHover(null)}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${hover === slice.key ? "bg-[#f6f5f0]" : ""}`}>
          <span className="size-3 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
          <span className="min-w-0 flex-1 truncate font-semibold">{slice.label}</span>
          <span className="shrink-0 tabular-nums text-black/45">{Math.round(share * 100)}%</span>
          <span className="w-[86px] shrink-0 text-right font-bold tabular-nums">{format(slice.value)}</span>
        </li>; })}
      </ul>
    </div>
  </Card>;
}

// Horizontal bars: what each platform costs per 1,000 verified views. Shorter is better value.
function CostBars({ rows, money }: { rows: Analytics["byPlatform"]; money: (value: number | null) => string }) {
  const priced = sortPlatforms(rows).filter(row => row.costPerThousandViewsKobo != null);
  const max = Math.max(1, ...priced.map(row => row.costPerThousandViewsKobo ?? 0));
  const best = priced.reduce<typeof priced[number] | null>((low, row) => !low || (row.costPerThousandViewsKobo ?? 0) < (low.costPerThousandViewsKobo ?? 0) ? row : low, null);
  return <Card title="Cost per 1,000 views" subtitle={best ? `${best.label} gives you the most views for your money` : "By platform"}>
    <div className="space-y-3.5">
      {priced.map(row => <div key={row.platform} className="grid grid-cols-[84px_minmax(0,1fr)_64px] items-center gap-3 text-sm" title={`${row.label}: ${money(row.costPerThousandViewsKobo)} per 1,000 views`}>
        <span className="flex items-center gap-2 font-semibold"><span className="size-3 shrink-0 rounded-[3px]" style={{ background: platformColor[row.platform] ?? brand }} />{row.label}</span>
        <div className="h-3 rounded-r-[4px] bg-[#f1efe9]"><div className="h-3 rounded-r-[4px]" style={{ width: `${((row.costPerThousandViewsKobo ?? 0) / max) * 100}%`, background: platformColor[row.platform] ?? brand }} /></div>
        <span className="text-right font-bold tabular-nums">{money(row.costPerThousandViewsKobo)}</span>
      </div>)}
    </div>
  </Card>;
}

function PlatformTable({ rows, money }: { rows: Analytics["byPlatform"]; money: (value: number | null) => string }) {
  const sorted = sortPlatforms(rows);
  return <Card title="Platform breakdown" subtitle="Verified posts, views and spend on each platform">
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs font-bold uppercase tracking-[.1em] text-black/40"><th className="pb-2 font-bold">Platform</th><th className="pb-2 text-right font-bold">Posts</th><th className="pb-2 text-right font-bold">Views</th><th className="hidden pb-2 text-right font-bold sm:table-cell">Share</th><th className="hidden pb-2 text-right font-bold sm:table-cell">Spent</th><th className="pb-2 text-right font-bold">Cost / 1k views</th></tr></thead>
      <tbody>{sorted.map(row => <tr key={row.platform} className="border-t border-black/[.06] hover:bg-[#f6f5f0]">
        <td className="py-2.5"><span className="flex items-center gap-2 font-bold"><span className="size-3 rounded-[3px]" style={{ background: platformColor[row.platform] ?? brand }} />{row.label}</span></td>
        <td className="py-2.5 text-right tabular-nums">{row.posts}</td><td className="py-2.5 text-right font-bold tabular-nums">{number(row.views)}</td><td className="hidden py-2.5 text-right tabular-nums text-black/55 sm:table-cell">{Math.round(row.share * 100)}%</td><td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{money(row.spentKobo)}</td><td className="py-2.5 text-right tabular-nums">{money(row.costPerThousandViewsKobo)}</td>
      </tr>)}</tbody>
    </table>
  </Card>;
}

function CampaignBars({ rows, money }: { rows: Analytics["byCampaign"]; money: (value: number | null) => string }) {
  const max = Math.max(1, ...rows.map(row => row.views));
  const used = platformOrder.filter(platform => rows.some(row => row.platformViews[platform]));
  return <Card title="Campaign performance" subtitle="Verified views per campaign by platform, with what each 1,000 views cost">
    <div className="-mt-1 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-black/55">{used.map(platform => <span key={platform} className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: platformColor[platform] }} />{platformLabel[platform]}</span>)}</div>
    <div className="space-y-4">
      {rows.map(row => <div key={row.id} className="group">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="min-w-0 truncate font-bold">{row.title} <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold capitalize text-black/50">{row.status}</span></p>
          <p className="shrink-0 tabular-nums"><b>{number(row.views)}</b> <span className="text-black/45">views · {money(row.costPerThousandViewsKobo)} / 1k</span></p>
        </div>
        <div className="mt-2 flex h-3.5 w-full gap-[2px] overflow-hidden rounded-r-[4px] bg-[#f1efe9]">
          {platformOrder.filter(platform => row.platformViews[platform]).map(platform => <div key={platform} className="h-full transition-[width] duration-700 last:rounded-r-[4px] hover:brightness-110"
            title={`${row.title} · ${platformLabel[platform]}: ${number(row.platformViews[platform])} views`}
            style={{ width: `${(row.platformViews[platform] / max) * 100}%`, background: platformColor[platform] }} />)}
        </div>
        <p className="mt-1.5 text-xs text-black/45">{row.posts} of {row.targetPosts} posts verified · {money(row.spentKobo)} spent{row.flagged ? ` · ${row.flagged} flagged` : ""}</p>
      </div>)}
    </div>
  </Card>;
}

function Timeline({ rows }: { rows: Analytics["timeline"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map(row => row.views));
  const ticks = [max, max / 2, 0];
  const label = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return <Card title="Verified views, last 14 days" subtitle="By the day each proof was submitted">
    <div className="relative flex gap-3">
      <div className="flex h-44 flex-col justify-between text-right text-[11px] tabular-nums text-black/40">{ticks.map(tick => <span key={tick}>{compact(tick)}</span>)}</div>
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 h-44">{ticks.map((tick, index) => <div key={tick} className="absolute inset-x-0 border-t border-black/[.06]" style={{ top: `${index * 50}%` }} />)}</div>
        <div className="relative flex h-44 items-end gap-[2px]">
          {rows.map((row, index) => <div key={row.date} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
            <div className="w-full rounded-t-[4px]" style={{ height: `${(row.views / max) * 100}%`, minHeight: row.views ? 3 : 0, background: brand, opacity: hover === null || hover === index ? 1 : .45 }} />
          </div>)}
        </div>
        {hover !== null && <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-[#171811] px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((hover + .5) / rows.length) * 100}%` }}>
          <b>{label(rows[hover].date)}</b><br />{number(rows[hover].views)} views · {rows[hover].posts} posts
        </div>}
        <div className="mt-2 flex justify-between text-[11px] text-black/40"><span>{label(rows[0].date)}</span><span>{label(rows[rows.length - 1].date)}</span></div>
      </div>
    </div>
  </Card>;
}

function Assistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);

  async function ask(text: string) {
    const asked = text.trim(); if (!asked || busy) return;
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns(current => [...current, { role: "user", text: asked }]); setQuestion(""); setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/business/assistant`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: asked, history }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "The assistant could not answer right now.");
      setTurns(current => [...current, { role: "assistant", text: body.answer, highlights: body.highlights, followUps: body.followUps }]);
    } catch (error) {
      setTurns(current => [...current, { role: "assistant", text: error instanceof Error ? error.message : "The assistant could not answer right now." }]);
    } finally { setBusy(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(question); };
  const last = turns.at(-1);

  return <aside className="flex h-[720px] flex-col overflow-hidden rounded-2xl border border-black/[.08] bg-white xl:sticky xl:top-6">
    <div className="flex items-center gap-3 border-b border-black/[.06] bg-[#171811] px-5 py-4 text-white">
      <span className="grid size-9 place-items-center rounded-xl bg-[#6558ff]"><Sparkles className="size-4" /></span>
      <div><p className="font-black">Ask Reelch</p><p className="text-xs text-white/55">Answers from your verified campaign data</p></div>
    </div>
    <div ref={log} className="flex-1 space-y-4 overflow-y-auto p-5">
      {!turns.length && <div>
        <p className="text-sm text-black/55">Ask anything about how your campaigns are performing.</p>
        <div className="mt-4 space-y-2">{starters.map(starter => <button key={starter} onClick={() => ask(starter)} className="block w-full rounded-xl border border-black/10 px-4 py-3 text-left text-sm font-semibold hover:border-[#6558ff] hover:bg-[#f6f5ff]">{starter}</button>)}</div>
      </div>}
      {turns.map((turn, index) => turn.role === "user"
        ? <div key={index} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#6558ff] px-4 py-2.5 text-sm font-semibold text-white">{turn.text}</div>
        : <div key={index} className="flex gap-2.5"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#edeaff] text-[#5145e5]"><Bot className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm leading-6 text-[#171811]">{turn.text}</p>
            {!!turn.highlights?.length && <div className="mt-3 grid grid-cols-2 gap-2">{turn.highlights.map(item => <div key={item.label} className="rounded-xl bg-[#f6f5f0] px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-[.08em] text-black/45">{item.label}</p><p className="mt-0.5 text-sm font-black">{item.value}</p></div>)}</div>}
          </div></div>)}
      {busy && <div className="flex items-center gap-2 text-sm text-black/45"><LoaderCircle className="size-4 animate-spin" /> Reading your campaign data…</div>}
      {!busy && last?.role === "assistant" && !!last.followUps?.length && <div className="flex flex-wrap gap-2">{last.followUps.map(item => <button key={item} onClick={() => ask(item)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold hover:border-[#6558ff] hover:bg-[#f6f5ff]">{item}</button>)}</div>}
    </div>
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-black/[.06] p-3">
      <input value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} placeholder="Ask about your campaigns…" aria-label="Ask about your campaigns" className="min-h-11 flex-1 rounded-xl border border-black/10 px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" />
      <button disabled={busy || !question.trim()} aria-label="Send question" className="grid size-11 place-items-center rounded-xl bg-[#171811] text-white disabled:opacity-35"><ArrowUp className="size-4" /></button>
    </form>
  </aside>;
}
