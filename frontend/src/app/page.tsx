import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, BadgeCheck, Banknote, BarChart3,
  BriefcaseBusiness, Check, CircleCheck, Eye, Megaphone,
  MousePointerClick, MoveUpRight, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import { PromoterWaitlistForm } from "@/components/promoter-waitlist-form";

const steps = [
  { icon: BriefcaseBusiness, number: "01", title: "Set the outcome", text: "Choose the goal, audience, reward and rules before the campaign goes live." },
  { icon: Megaphone, number: "02", title: "Share with intent", text: "Matched promoters share a unique link with the people most likely to care." },
  { icon: BadgeCheck, number: "03", title: "Reward real results", text: "Reelch verifies each action, shows what worked and keeps payouts transparent." },
];

const ticker = ["VERIFIED RESULTS", "REAL REACH", "CLEAR REWARDS", "BETTER CAMPAIGNS"];

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#f4f1e9] text-[#171811]">
      <header className="absolute inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-24 max-w-[1380px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Reelch home" className="text-[1.65rem] font-black tracking-[-.09em]">REELCH<span className="text-[#6255e7]">.</span></Link>
          <nav className="hidden items-center gap-8 text-xs font-black uppercase tracking-[.08em] md:flex"><a href="#how">How it works</a><a href="#businesses">Businesses</a><a href="#promoters">Promoters</a></nav>
          <div className="flex items-center gap-2"><Link href="/login" className="hidden px-3 py-2 text-sm font-bold sm:block">Sign in</Link><a href="#waitlist" className="button-pop inline-flex min-h-11 items-center gap-2 rounded-full bg-[#171811] px-5 text-sm font-bold text-white">Get early access <ArrowRight className="size-4" /></a></div>
        </div>
      </header>

      <section className="relative border-b-2 border-[#171811] pt-24">
        <div className="hero-grid absolute inset-0 opacity-35" />
        <div className="relative mx-auto grid min-h-[760px] max-w-[1380px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.16fr_.84fr] lg:px-12">
          <div className="relative z-10">
            <div className="mb-7 inline-flex rotate-[-1deg] items-center gap-2 border-2 border-[#171811] bg-[#a8e86f] px-4 py-2 text-xs font-black uppercase tracking-[.12em] shadow-[3px_3px_0_#171811]"><Sparkles className="size-4" /> Performance, made human</div>
            <h1 className="max-w-[900px] text-[clamp(4.25rem,9.4vw,9.4rem)] font-black uppercase leading-[.77] tracking-[-.09em]">Reach that<br /><span className="text-[#6255e7]">really</span> works.</h1>
            <div className="mt-10 flex max-w-3xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-xl text-lg font-medium leading-8 text-black/62 sm:text-xl">Reelch connects businesses with trusted promoters—and turns influence into outcomes everyone can see.</p>
              <a href="#how" className="group grid size-16 shrink-0 place-items-center rounded-full border-2 border-[#171811] bg-white transition hover:-rotate-6 hover:bg-[#a8e86f]" aria-label="See how Reelch works"><ArrowDownRight className="size-7 transition group-hover:translate-x-1 group-hover:translate-y-1" /></a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="absolute -left-8 -top-10 size-24 rounded-full bg-[#a8e86f]" />
            <CampaignCard floating />
          </div>
        </div>
      </section>

      <div className="border-b-2 border-[#171811] bg-[#a8e86f] py-3.5"><div className="ticker-content flex min-w-max items-center gap-10">{[...ticker, ...ticker].map((item, index) => <span key={`${item}-${index}`} className="flex items-center gap-10 text-xs font-black uppercase tracking-[.16em]"><span>{item}</span><span className="text-lg">✦</span></span>)}</div></div>

      <section id="how" className="py-24 sm:py-32">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><p className="section-kicker text-[#6255e7]">How Reelch works</p><h2 className="mt-4 text-[clamp(3rem,5vw,4.75rem)] font-black leading-[.94] tracking-[-.065em]">One campaign.<br />One source of truth.</h2></div>
            <p className="max-w-xl text-lg leading-8 text-black/55 lg:justify-self-end">From brief to payout, Reelch keeps the campaign clear. No scattered screenshots, vague terms or awkward follow-ups.</p>
          </div>

          <div className="mt-16 grid gap-8 rounded-[2rem] bg-[#171811] p-5 text-white sm:p-8 lg:grid-cols-[1.08fr_.92fr] lg:p-10">
            <div className="rounded-2xl bg-[#f8f7f2] p-5 text-[#171811] sm:p-7">
              <div className="flex items-center justify-between border-b border-black/10 pb-5"><div><p className="text-[.65rem] font-black uppercase tracking-[.16em] text-black/38">Campaign overview</p><h3 className="mt-2 text-xl font-black">New customer referrals</h3></div><span className="rounded-full bg-[#e5f5d6] px-3 py-1.5 text-xs font-black text-[#315d13]">Live</span></div>
              <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-3"><ProductStat label="Verified results" value="184" trend="+18%" /><ProductStat label="Conversion rate" value="12.4%" trend="+2.1%" /><ProductStat label="Reward paid" value="₦276k" trend="On track" /></div>
              <div className="rounded-xl border border-black/10 bg-white p-4"><div className="flex h-28 items-end gap-2">{[28, 45, 38, 62, 52, 76, 68, 88, 74, 96, 84, 100].map((height, index) => <span key={index} className="flex-1 rounded-t-sm bg-[#6255e7]/20" style={{ height: `${height}%` }}><span className="block h-[35%] rounded-t-sm bg-[#6255e7]" /></span>)}</div><div className="mt-3 flex justify-between text-[.6rem] font-bold uppercase tracking-wider text-black/35"><span>Campaign start</span><span>Today</span></div></div>
            </div>
            <div className="flex flex-col justify-between p-2 sm:p-4"><div><span className="grid size-12 place-items-center rounded-full bg-[#a8e86f] text-black"><Eye className="size-5" /></span><h3 className="mt-6 text-3xl font-black tracking-[-.04em]">Clarity at every step.</h3><p className="mt-4 max-w-md leading-7 text-white/55">Businesses know where their budget goes. Promoters know exactly what counts. Both sides see progress as it happens.</p></div><div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10"><MiniStat icon={MousePointerClick} label="Attribution" value="Unique referral links" /><MiniStat icon={ShieldCheck} label="Verification" value="Valid results only" /><MiniStat icon={Banknote} label="Rewards" value="Clear before sharing" /><MiniStat icon={BarChart3} label="Reporting" value="Live campaign data" /></div></div>
          </div>

          <div className="mt-20 grid border-t border-black/15 lg:grid-cols-3">{steps.map((step) => <article key={step.title} className="border-b border-black/15 py-8 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0"><div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-full bg-[#e8e4ff] text-[#6255e7]"><step.icon className="size-5" /></span><span className="text-sm font-black text-black/20">{step.number}</span></div><h3 className="mt-8 text-2xl font-black tracking-[-.04em]">{step.title}</h3><p className="mt-3 max-w-sm leading-7 text-black/50">{step.text}</p></article>)}</div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="section-kicker text-[#6255e7]">Built for both sides</p><h2 className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-5xl">Different goals. Shared clarity.</h2></div><p className="max-w-sm leading-7 text-black/50">A better campaign experience for the people funding the work and the people moving the audience.</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2"><AudienceCard id="businesses" type="For ambitious businesses" title={<>Pay for proof.<br />Not promises.</>} description="Define a real outcome, choose the right promoters and follow every conversion from click to payout." items={["Measurable acquisition campaigns", "Promoters matched to your audience", "Verified results and clear reporting"]} icon="business" href="/register" cta="Start a campaign" color="bg-[#b5ea83]" /><AudienceCard id="promoters" type="For trusted promoters" title={<>Make your reach<br />count.</>} description="Choose work that suits your audience and earn when your recommendation produces a verified result." items={["Rewards and requirements upfront", "A unique link for every campaign", "Results and earnings in one place"]} icon="promoter" href="#waitlist" cta="Join the waitlist" color="bg-[#c8c2f2]" /></div>
        </div>
      </section>

      <section className="bg-[#eb91c4] px-5 py-20 text-center sm:px-8 sm:py-24"><p className="mx-auto max-w-4xl text-[clamp(2.6rem,5.5vw,5.5rem)] font-black uppercase leading-[.9] tracking-[-.07em]">Good influence should feel good for <span className="rounded-full bg-[#f4f1e9] px-4 italic">everyone.</span></p></section>

      <section id="waitlist" className="bg-[#171811] py-24 text-white sm:py-28">
        <div className="mx-auto grid max-w-[1160px] gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_.82fr] lg:items-start">
          <div><p className="section-kicker text-[#a8e86f]">Early access</p><h2 className="mt-5 max-w-2xl text-[clamp(3rem,5.5vw,5.25rem)] font-black leading-[.91] tracking-[-.065em]">Bring your audience.<br />We’ll bring the opportunities.</h2><p className="mt-7 max-w-lg text-lg leading-8 text-white/50">Join the first group of promoters shaping a clearer, fairer way to work with businesses.</p><div className="mt-9 space-y-4 text-sm text-white/65"><Note text="No fee to join" /><Note text="Useful campaigns, matched to your audience" /><Note text="Clear terms before you share anything" /></div></div>
          <PromoterWaitlistForm />
        </div>
      </section>

      <footer className="px-5 pb-10 pt-20 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1380px]"><div className="flex flex-col justify-between gap-8 border-b-2 border-[#171811] pb-12 md:flex-row md:items-end"><p className="text-[clamp(4.5rem,14vw,11rem)] font-black leading-[.7] tracking-[-.1em]">REELCH<span className="text-[#6255e7]">.</span></p><a href="#" className="grid size-14 place-items-center rounded-full border-2 border-[#171811]" aria-label="Back to top">↑</a></div><div className="flex flex-col gap-4 pt-7 text-xs font-bold uppercase tracking-[.08em] text-black/50 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 Reelch. Reach that really works.</p><div className="flex gap-6"><Link href="/privacy">Privacy</Link><Link href="/login">Sign in</Link></div></div></div></footer>
      <CookieBanner />
    </main>
  );
}

function CampaignCard({ floating = false }: { floating?: boolean }) { return <div className={`${floating ? "campaign-card" : ""} relative border-2 border-[#171811] bg-[#171811] p-5 text-white shadow-[10px_10px_0_#6255e7] sm:p-7`}><div className="flex items-start justify-between gap-3 border-b border-white/15 pb-5"><div><p className="text-[.65rem] font-black uppercase tracking-[.18em] text-white/40">Live opportunity</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Launch week referrals</h2></div><span className="rounded-full bg-[#a8e86f] px-3 py-2 text-xs font-black text-black">₦1,500 / result</span></div><div className="mt-5 grid grid-cols-2 gap-3"><MiniStat icon={MousePointerClick} label="Goal" value="Qualified sign-ups" /><MiniStat icon={Banknote} label="Reward" value="Per verified result" /><MiniStat icon={ShieldCheck} label="Tracking" value="Unique referral link" /><MiniStat icon={BarChart3} label="Status" value="Visible in real time" /></div><div className="mt-5 flex items-center gap-3 border border-white/15 bg-white/[.06] p-4"><span className="grid size-11 place-items-center rounded-full bg-[#c8c2f2] text-black"><UserRound className="size-5" /></span><div><p className="text-sm font-black">A match for your audience</p><p className="mt-1 text-xs text-white/45">Clear terms. No awkward follow-up.</p></div><CircleCheck className="ml-auto size-5 text-[#a8e86f]" /></div></div>; }
function ProductStat({ label, value, trend }: { label: string; value: string; trend: string }) { return <div className="rounded-xl border border-black/10 bg-white p-4"><p className="text-[.6rem] font-black uppercase tracking-[.12em] text-black/35">{label}</p><p className="mt-3 text-2xl font-black tracking-[-.04em]">{value}</p><p className="mt-1 text-xs font-bold text-[#467d22]">{trend}</p></div>; }
function MiniStat({ icon: Icon, label, value }: { icon: typeof MousePointerClick; label: string; value: string }) { return <div className="bg-white/[.06] p-4"><Icon className="size-4 text-[#a8e86f]" /><p className="mt-5 text-[.6rem] font-black uppercase tracking-[.15em] text-white/35">{label}</p><p className="mt-1 text-xs font-bold leading-5">{value}</p></div>; }
function Benefit({ text }: { text: string }) { return <li className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-white/75"><Check className="size-4" /></span>{text}</li>; }
function Note({ text }: { text: string }) { return <p className="flex items-center gap-3"><Check className="size-4 shrink-0 text-[#a8e86f]" />{text}</p>; }
function AudienceCard({ id, type, title, description, items, icon, href, cta, color }: { id: string; type: string; title: React.ReactNode; description: string; items: string[]; icon: "business" | "promoter"; href: string; cta: string; color: string }) { const Icon = icon === "business" ? BriefcaseBusiness : Megaphone; return <article id={id} className={`group relative min-h-[560px] overflow-hidden border-2 border-[#171811] p-7 sm:p-10 lg:pb-28 ${color}`}><span className="absolute right-8 top-8 grid size-12 place-items-center rounded-full border-2 border-[#171811] bg-[#f4f1e9]"><Icon className="size-5" /></span><p className="text-xs font-black uppercase tracking-[.15em]">{type}</p><h3 className="mt-10 max-w-lg text-5xl font-black uppercase leading-[.91] tracking-[-.065em] sm:text-6xl">{title}</h3><p className="mt-7 max-w-lg leading-7 text-black/58">{description}</p><ul className="mt-8 space-y-3 text-sm font-black">{items.map(item => <Benefit key={item} text={item} />)}</ul><Link href={href} className="button-pop mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#171811] px-5 text-sm font-bold text-white lg:absolute lg:bottom-10 lg:left-10 lg:mt-0">{cta} <MoveUpRight className="size-4" /></Link></article>; }
