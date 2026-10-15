import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, BriefcaseBusiness, Check, CircleCheck, Eye, Megaphone, MousePointerClick, Send, ShieldCheck, Target, UsersRound } from "lucide-react";
import { FaInstagram, FaTelegram, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { AnimatedNumber } from "@/components/animated-number";
import { CampaignCreationDemo } from "@/components/campaign-creation-demo";
import { CookieBanner } from "@/components/cookie-banner";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { PromoterWaitlistForm } from "@/components/promoter-waitlist-form";

const channels=[
 {name:"WhatsApp",icon:FaWhatsapp},
 {name:"Instagram",icon:FaInstagram},
 {name:"TikTok",icon:FaTiktok},
 {name:"X",icon:FaXTwitter},
 {name:"Telegram",icon:FaTelegram},
 {name:"YouTube",icon:FaYoutube},
];
const goals=[
 {icon:Eye,title:"Visibility",text:"Put your brand, product or message in front of relevant audiences.",measure:"Reach and engagement where available"},
 {icon:UsersRound,title:"Acquisition",text:"Encourage useful actions such as sign-ups, enquiries and lead submissions.",measure:"Clicks, submissions and qualified actions"},
 {icon:Target,title:"Conversion",text:"Drive defined outcomes such as purchases when reliable tracking is supported.",measure:"Supported conversion events"},
];
const faqs=[
 ["Who can become a promoter?","Creators, community leaders and everyday people with a genuine audience can apply. You do not need celebrity-level follower counts."],
 ["What does Reelch measure?","Measurement depends on the campaign objective and channel. This may include link clicks, submissions, approved leads or supported conversion events. Every campaign states what is tracked before a promoter joins."],
 ["How are rewards decided?","Businesses set the reward model and requirements upfront. Promoters see the terms before choosing to participate."],
 ["Which platforms can I use?","Campaigns can be designed for channels such as WhatsApp, Instagram, TikTok, X, Telegram and YouTube. Availability may vary by campaign and launch phase."],
];

export default function Home(){return <main>
 <MarketingHeader/>

 <section className="hero"><div className="wrap hero-copy"><h1>Real people. Real reach. <em>Real results.</em></h1><p>Connect with everyday promoters who share your business across social platforms. Track available campaign activity, set transparent rewards and turn trusted recommendations into measurable growth.</p><div className="hero-actions"><Link className="button dark" href="/register">Grow your business <ArrowRight/></Link><a className="button light" href="#waitlist">Become a promoter <ArrowRight/></a></div></div><div className="wrap"><HeroProduct/></div></section>

 <section id="channels" className="channels"><div className="wrap"><div><h2>Your customers are everywhere. <em>Be where they are.</em></h2><p>Run campaigns through relevant creators and everyday promoters across the social channels your audience already uses.</p></div><div className="channel-list">{channels.map(({name,icon:Icon})=><span key={name}><b><Icon aria-hidden="true"/></b>{name}</span>)}</div></div></section>

 <section id="goals" className="section goals"><div className="wrap"><SectionHead overline="One platform, different growth goals" title="Choose the outcome that matters." text="Reelch supports campaigns across the customer journey. Tracking and reward rules are matched to each campaign objective—not treated as one-size-fits-all."/><div className="goal-grid">{goals.map(({icon:Icon,title,text,measure})=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p><small><CircleCheck/> {measure}</small></article>)}</div></div></section>

 <section id="how" className="section how"><div className="wrap"><SectionHead overline="How Reelch works" title="From campaign idea to measurable activity." text="A product-led workflow for businesses and a straightforward earning journey for promoters."/><div className="step-grid"><Step number="01" title="Create" text="Choose your objective, audience, budget and reward terms."><CampaignCreationDemo/></Step><Step number="02" title="Promote" text="Matched promoters choose the campaign and share it with their audience."><div className="mini-phone"><span>@amara.creates</span><Image src="/images/reelch-hero-collaboration.png" alt="Example social promotion" fill sizes="260px"/><b><Send/> Share campaign</b></div></Step><Step number="03" title="Measure" text="Follow available activity, review outcomes and manage eligible rewards."><div className="mini-report"><div><small>Tracked activity</small><b><AnimatedNumber value={184}/></b></div><div className="mini-bars">{[35,58,48,76,64,91].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><span>Rewards pending review</span></div></Step></div></div></section>

 <section className="section product-section"><div className="wrap"><ProductPreview/></div></section>

 <section className="section audience-section"><div className="wrap"><SectionHead overline="Made for both sides" title="A better exchange for everyone." text="Businesses get structured distribution. Promoters get campaigns with upfront expectations and reward terms."/><div className="audience-grid"><Audience id="businesses" tone="green" icon={BriefcaseBusiness} label="For businesses" title="Your next customers are already in someone’s audience." text="Launch campaigns around a specific growth goal and work with promoters who can reach relevant communities." points={["Launch campaigns based on your goals","Set budgets and reward terms","Track measurable campaign activity"]} href="/register" cta="Create a business account"/><Audience id="promoters" tone="purple" icon={Megaphone} label="For promoters" title="Your audience has value. Make it count." text="Discover campaigns that fit your audience and know what is required before you choose to promote." points={["Find campaigns that fit your audience","See requirements and rewards upfront","Track activity and eligible earnings"]} href="#waitlist" cta="Join the promoter waitlist"/></div></div></section>

 <section className="protection"><div className="wrap"><div><h2>Clear terms protect both sides.</h2><p>Every campaign defines its objective, eligible activity, evidence requirements and reward terms before promotion begins.</p></div><div className="protection-grid"><span><ShieldCheck/><b>For businesses</b><small>Campaign requirements and review rules are set upfront.</small></span><span><CircleCheck/><b>For promoters</b><small>Reward terms are visible before you decide to participate.</small></span><span><BarChart3/><b>For every campaign</b><small>Reporting reflects the metrics supported by its channel and objective.</small></span></div></div></section>

 <section className="section faq"><div className="wrap"><h2>Questions people ask.</h2><div className="faq-list">{faqs.map(([q,a],index)=><details key={q} open={index===0}><summary><span className="faq-number">{String(index+1).padStart(2,"0")}</span><strong>{q}</strong><i className="faq-toggle" aria-hidden="true"/></summary><p>{a}</p></details>)}</div></div></section>

 <section id="waitlist" className="section waitlist"><div className="wrap wait-grid"><div><h2>Bring your audience.<br/><em>We’ll bring the opportunities.</em></h2><p>Join the first promoter cohort. If you are a business ready to launch campaigns, create a business account instead.</p><Link href="/register" className="business-path"><BriefcaseBusiness/><span><b>I’m a business</b>Create your account and campaign workspace.</span><ArrowRight/></Link></div><PromoterWaitlistForm/></div></section>

 <MarketingFooter/><CookieBanner/>
 </main>}

function SectionHead({title,text}:{overline:string;title:string;text:string}){return <div className="section-head"><div><h2>{title}</h2></div><p>{text}</p></div>}
function HeroProduct(){return <div className="hero-product hero-photo"><Image src="/images/reelch-hero-collaboration.png" alt="A creator and a business owner planning a campaign together" fill priority sizes="(max-width:800px) 94vw, 1240px"/></div>}
function Step({number,title,text,children}:{number:string;title:string;text:string;children:React.ReactNode}){return <article><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p><div className="step-visual">{children}</div></article>}
function ProductPreview(){return <div className="product"><div className="product-copy"><h2>Know what is happening, as it happens.</h2><p>Follow the activity that can be measured for each campaign. Review submissions, supported conversion events and reward status in one workspace.</p><div><span><MousePointerClick/>Objective-specific metrics</span><span><ShieldCheck/>Evidence and review workflows</span><span><BarChart3/>Pending and paid rewards</span></div></div><div className="dashboard"><div className="dash-head"><div><small>ACQUISITION CAMPAIGN</small><h3>New customer referrals</h3></div><span>Live</span></div><div className="dash-stats"><span><small>Link clicks</small><b><AnimatedNumber value={428}/></b></span><span><small>Submitted leads</small><b><AnimatedNumber value={54}/></b></span><span><small>Approved actions</small><b><AnimatedNumber value={41}/></b></span></div><div className="dash-bottom"><div className="chart">{[32,48,41,67,55,77,70,92,84].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><div><small>REWARD STATUS</small><b><AnimatedNumber value={42000} prefix="₦"/></b><p>Pending review</p></div></div></div></div>}
function Audience({id,tone,icon:Icon,label,title,text,points,href,cta}:{id:string;tone:string;icon:typeof Megaphone;label:string;title:string;text:string;points:string[];href:string;cta:string}){return <article id={id} className={`audience ${tone}`}><div className="audience-label"><span><Icon/></span>{label}</div><h3>{title}</h3><p>{text}</p><ul>{points.map(x=><li key={x}><Check/>{x}</li>)}</ul><Link href={href} className="button dark">{cta}<ArrowRight/></Link></article>}
