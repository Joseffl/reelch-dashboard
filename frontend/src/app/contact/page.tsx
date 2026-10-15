import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import { ContactForm } from "@/components/contact-form";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "Contact Reelch",
  description: "Contact Reelch about campaigns, promoting, account support or general questions.",
};

export default function ContactPage() {
  return <main className="contact-page">
    <MarketingHeader/>
    <section className="contact-hero"><div className="wrap"><h1>Let’s talk about what you want to <em>achieve.</em></h1><p>Whether you want to launch a campaign, become a promoter or need help with Reelch, start here.</p><a className="button dark" href="mailto:hello@reelch.com">Email us <ArrowRight/></a></div></section>
    <section className="contact-options"><div className="wrap contact-form-layout"><div className="contact-form-copy"><h2>Tell us how we can help.</h2><p>Choose the most relevant enquiry type and share the details. Your message will go directly into Reelch’s support queue for review.</p><div><b>Business enquiries</b><span>Campaigns, objectives, budgets and onboarding.</span></div><div><b>Promoter enquiries</b><span>Eligibility, campaigns, activity and rewards.</span></div><div><b>Account support</b><span>Access issues or something that is not working.</span></div></div><ContactForm/></div></section>
    <section className="contact-direct"><div className="wrap"><span><Mail/></span><div><h2>Something else?</h2><p>Send a general enquiry and include any useful account or campaign details. Please do not include passwords or payment credentials.</p></div><a href="mailto:hello@reelch.com">hello@reelch.com</a></div></section>
    <section className="contact-next"><div className="wrap"><h2>Ready to get moving?</h2><div><Link className="button dark" href="/register">Create a business account <ArrowRight/></Link><Link className="button light" href="/#waitlist">Join as a promoter</Link></div></div></section>
    <MarketingFooter/><CookieBanner/>
  </main>;
}
