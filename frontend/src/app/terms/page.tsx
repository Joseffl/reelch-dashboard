import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileText, HandCoins, ShieldCheck } from "lucide-react";
import { CookieBanner } from "@/components/cookie-banner";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = { title: "Terms of Service | Reelch", description: "The rules for businesses and promoters using Reelch." };

const principles = [
  { icon: BadgeCheck, title: "Pay for verified work", text: "Businesses fund campaigns up front and pay only for posts that pass verification." },
  { icon: ShieldCheck, title: "Post honestly", text: "Promoters share genuine posts, disclose that they are promotional and never fake results." },
  { icon: HandCoins, title: "Money stays accountable", text: "Funds are held for each campaign, paid for approved work and unspent budget is returned." },
];

const sections = [
  ["01", "Accepting these terms", "By creating an account or using Reelch you agree to these terms and to our privacy policy. If you use Reelch on behalf of a business, you confirm that you are authorised to bind that business. You must be at least 18 years old and able to enter into a binding agreement."],
  ["02", "Your account", "You must give accurate information, keep your login details secure and tell us promptly about any unauthorised use. Reelch may ask you to verify your identity or your business before you can run or join campaigns, and may refuse, suspend or close an account that breaks these terms or puts other users at risk."],
  ["03", "Campaigns and funding", "Businesses create campaigns that set the brief, required hashtags, eligible platforms, locations, the reward for each verified post and the number of posts wanted. Reelch reviews campaigns before they go live. A campaign is funded in full through a supported payment provider such as PayPal, and the funds are held for that campaign until they are used for verified posts or returned."],
  ["04", "Posting as a promoter", "Promoters may join campaigns they qualify for and must follow the brief. Every post must be your own, published on an account you control, and clearly identified as a paid promotion where the law or the platform requires it, for example with #ad. You must not use bots, bought engagement, misleading claims, other people's content or edited evidence."],
  ["05", "Proof and verification", "Promoters submit proof of each post, such as a public link, a screenshot or both. Reelch checks proofs with automated tools, including AI review and data from the social platform where it is available, and with human review where needed. Reelch decides whether a proof is approved. A rejected proof may be resubmitted within the time shown in your account, after which the slot may be released to another promoter."],
  ["06", "Connected social accounts", "You may choose to connect a social account, such as TikTok, so Reelch can read basic profile information and the public videos and view counts needed to verify your submissions. Reelch only requests read access, does not post on your behalf and uses this data only to verify campaign work. You can disconnect at any time from your profile or from the platform's own settings."],
  ["07", "Payouts", "When a proof is approved, the campaign reward is credited to the promoter and paid to the payout account they provided, such as a PayPal account. Payouts depend on the payment provider accepting the transfer, including any country or account restrictions it applies. If a payout fails, the amount returns to the promoter's Reelch balance. Promoters are responsible for any taxes on their earnings."],
  ["08", "Ending campaigns and refunds", "A business may end a live campaign once no proofs are awaiting review. Any budget not used for approved posts is refunded to the original payment method. Amounts already paid for approved posts are not refundable, except where Reelch reverses a payment because of fraud or error."],
  ["09", "Fraud and enforcement", "Reelch may hold, reject or reverse rewards, remove a promoter from a campaign or close an account where we reasonably suspect fraud, duplicated or edited evidence, inflated results or a breach of these terms. We keep records of reviews and payments and may share them with payment providers or authorities where required."],
  ["10", "Content and intellectual property", "Businesses confirm they have the rights to the campaign materials they upload and allow promoters to use them for the campaign. Promoters keep ownership of their posts and allow the business and Reelch to display them in campaign results and reports. Reelch owns the Reelch service, brand and software."],
  ["11", "Third-party platforms", "Campaigns run on services that Reelch does not control, such as TikTok, Instagram, X, WhatsApp and PayPal. You must follow their rules as well as these terms. Reelch is not responsible for changes, outages or decisions made by those services."],
  ["12", "Liability", "Reelch is provided as it is and as available. To the extent the law allows, Reelch is not liable for indirect or consequential losses, and our total liability for any claim is limited to the fees you paid Reelch in the three months before the claim. Nothing in these terms limits liability that cannot be limited by law."],
  ["13", "Changes to these terms", "We may update these terms as Reelch evolves. Material changes will be announced through the service or by another appropriate method before they take effect. Continuing to use Reelch after that means you accept the updated terms."],
  ["14", "Contact us", "For questions about these terms, contact the Reelch team through our contact page."],
];

export default function TermsPage() {
  return <main className="privacy-page">
    <MarketingHeader/>
    <section className="privacy-hero"><div className="wrap"><span><FileText/></span><h1>Fair rules for <em>verified work.</em></h1><p>These terms explain how businesses and promoters use Reelch, how proofs are checked and how money moves, in language designed to be read.</p><small>Last updated: 10 November 2026</small></div></section>
    <section className="privacy-principles"><div className="wrap">{principles.map(({icon:Icon,title,text})=><article key={title}><span><Icon/></span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div></section>
    <section className="privacy-content"><div className="wrap"><aside><p>Terms of service</p><h2>The agreement, without the legal maze.</h2><span>These terms cover the Reelch website and service for businesses and promoters.</span><Link href="/privacy">Read our privacy policy <ArrowRight/></Link></aside><div className="privacy-sections">{sections.map(([number,title,text])=><article key={number}><span>{number}</span><div><h2>{title}</h2><p>{text}</p>{number==="14"&&<Link href="/contact">Contact Reelch <ArrowRight/></Link>}</div></article>)}</div></div></section>
    <MarketingFooter/><CookieBanner/>
  </main>;
}
