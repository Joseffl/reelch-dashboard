import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, Lightbulb, Scale, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "About Reelch | People-powered advertising",
  description: "Learn why Reelch is building a clearer advertising marketplace for businesses and everyday promoters.",
};

const values = [
  { icon: Scale, title: "Transparency", text: "Campaign expectations, measurable activity and reward terms should be understandable before anyone participates." },
  { icon: UsersRound, title: "Accessibility", text: "Useful influence is not limited to celebrities. Everyday people and focused communities can create meaningful reach." },
  { icon: Lightbulb, title: "Innovation", text: "We design around how people actually discover, share and act across today’s social platforms." },
  { icon: ShieldCheck, title: "Trust", text: "Businesses and promoters deserve a marketplace built around responsible participation and clear accountability." },
];

export default function AboutPage() {
  return <main className="about-page">
    <MarketingHeader/>
    <section className="about-hero"><div className="wrap"><h1>Advertising works better when <em>people</em> are part of the story.</h1><p>Reelch is building a people-powered advertising platform where businesses can reach relevant audiences and promoters can earn from the distribution they have built.</p></div></section>

    <section className="about-intro"><div className="wrap"><div><h2>Who we are.</h2></div><p>Reelch connects businesses with creators, community leaders and everyday promoters across the social platforms people already use. Campaigns begin with defined goals and upfront terms, giving both sides a more structured way to work together.</p></div></section>

    <section className="about-direction"><div className="wrap"><article><span><Sparkles/></span><h2>Our mission</h2><p>Make digital promotion more accessible, measurable and rewarding by helping businesses work with real people who already have their audience’s attention.</p></article><article><span><Eye/></span><h2>Our vision</h2><p>A world where valuable distribution is open to more people—and where businesses can grow through recommendations that feel relevant, human and accountable.</p></article></div></section>

    <section className="about-why"><div className="wrap"><h2>Why we built Reelch.</h2><div><p>Traditional promotion can leave businesses paying for attention without enough clarity about what happened next.</p><p>At the same time, many people who can genuinely move an audience have no simple way to discover suitable campaigns, understand the terms and track eligible earnings.</p><p>Reelch brings those needs together in one marketplace—without pretending every channel or campaign should be measured in exactly the same way.</p></div></div></section>

    <section className="about-values"><div className="wrap"><h2>What guides us.</h2><div>{values.map(({icon:Icon,title,text})=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

    <section className="about-team"><div className="wrap"><div><h2>The team behind Reelch.</h2><p>We are building Reelch with a practical understanding of African businesses, social communities and the realities of performance advertising. Verified team profiles will be added here as the company prepares for public launch.</p></div><Link href="/register" className="button dark">Build with us <ArrowRight/></Link></div></section>
    <MarketingFooter/><CookieBanner/>
  </main>;
}
