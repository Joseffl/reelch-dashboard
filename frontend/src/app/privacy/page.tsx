import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cookie, Database, LockKeyhole, UserRoundCheck } from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = { title: "Privacy Policy | Reelch", description: "How Reelch collects, uses and protects your information." };

const principles = [
  { icon: Database, title: "Collect thoughtfully", text: "We collect information needed to operate, secure and improve Reelch." },
  { icon: LockKeyhole, title: "Protect responsibly", text: "We use reasonable safeguards and limit how long information is retained." },
  { icon: UserRoundCheck, title: "Respect your choices", text: "You can ask about your information and exercise applicable privacy rights." },
];

const sections = [
  ["01", "Information we collect", "We collect information you provide directly, including your name, email address, phone number, country, social profile, audience information and campaign or account details. We also collect basic technical information such as device type, browser, IP address and how you use Reelch."],
  ["02", "How we use your information", "We use your information to provide and improve Reelch, match businesses and promoters, administer campaigns, verify results, process support requests, prevent fraud and send relevant service or onboarding updates."],
  ["03", "Cookies and analytics", "Essential cookies keep the site secure and remember choices such as your cookie preference. With your permission, optional analytics may help us understand which pages are useful and improve the experience. You can choose essential cookies only from our cookie notice."],
  ["04", "When we share information", "We may share information with service providers that help us operate the platform, with campaign participants where necessary to deliver an agreed service, or where required by law. We do not sell your personal information."],
  ["05", "Data retention and security", "We keep personal information only for as long as it is needed for the purposes described here, including legal, accounting and fraud-prevention requirements. We use reasonable technical and organisational safeguards, but no online service can guarantee absolute security."],
  ["06", "Your choices and rights", "Depending on where you live, you may ask to access, correct, delete or restrict the use of your personal information. You may also withdraw consent or object to certain uses. We may need to verify your identity before completing a request."],
  ["07", "Changes to this policy", "We may update this policy as Reelch evolves. Material changes will be communicated through the service or by another appropriate method. The latest version will always appear on this page."],
  ["08", "Contact us", "For privacy questions or requests, contact the Reelch team through our contact page or the official support channel listed in your account."],
];

export default function PrivacyPage() {
  return <main className="privacy-page">
    <MarketingHeader/>
    <section className="privacy-hero"><div className="wrap"><span><Cookie/></span><h1>Your information deserves <em>clear terms.</em></h1><p>This policy explains what Reelch collects, why we use it and the choices available to you—in language designed to be read.</p><small>Last updated: 30 September 2026</small></div></section>
    <section className="privacy-principles"><div className="wrap">{principles.map(({icon:Icon,title,text})=><article key={title}><span><Icon/></span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div></section>
    <section className="privacy-content"><div className="wrap"><aside><p>Privacy policy</p><h2>The details, without the legal maze.</h2><span>This notice covers the Reelch website and current early-access service.</span><Link href="/contact">Ask a privacy question <ArrowRight/></Link></aside><div className="privacy-sections">{sections.map(([number,title,text])=><article key={number}><span>{number}</span><div><h2>{title}</h2><p>{text}</p>{number==="08"&&<Link href="/contact">Contact Reelch <ArrowRight/></Link>}</div></article>)}</div></div></section>
    <MarketingFooter/><CookieBanner/>
  </main>;
}
