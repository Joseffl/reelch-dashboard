import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, Check, CircleCheck, Eye, Megaphone, MousePointerClick, Send, ShieldCheck, Sparkles, Target, UsersRound } from "lucide-react";
import { FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { AnimatedNumber } from "@/components/animated-number";
import { CampaignCreationDemo } from "@/components/campaign-creation-demo";
import { CookieBanner } from "@/components/cookie-banner";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
// import { PromoterWaitlistForm } from "@/components/promoter-waitlist-form";

const channels=[
 {name:"WhatsApp",icon:FaWhatsapp},
 {name:"Instagram",icon:FaInstagram},
 {name:"TikTok",icon:FaTiktok},
 {name:"X",icon:FaXTwitter},
];
const goals=[
 {icon:Eye,title:"Visibility",text:"Increase awareness of your brand by sharing your message through everyday social media users and creators.",measure:"Reach and engagement where available"},
 {icon:UsersRound,title:"Acquisition",text:"Extend your brand’s reach by getting your products and messages in front of new audiences through social media users and creators.",measure:"Clicks, submissions and qualified actions"},
 {icon:Target,title:"Conversion",text:"Define the campaign activities you want to track and review available results according to the campaign terms and supported platform capabilities.",measure:"Supported conversion events"},
];
const faqs=[
 ["Who can participate in REELCH campaigns?","Creators, community leaders and everyday social media users with an engaged audience can apply to participate in REELCH campaigns. You don’t need celebrity-level follower counts to get involved."],
 ["What does REELCH measure?","Measurement depends on the campaign objective and the capabilities of the selected platform. This may include link clicks, submissions, approved leads or supported conversion events. Each campaign clearly states what will be tracked before a social media user joins."],
 ["How are rewards decided?","Businesses define the reward structure and participation requirements upfront. Social media users can review the terms before deciding whether to participate in a campaign."],
 ["How is proof verified?","Each submission is checked by AI against the campaign brief, alongside platform data where it is available. Fixed rules then decide the outcome: posts that pass every check are approved, and anything uncertain, copied or inflated goes to a person for review."],
 ["How does the money move?","Businesses fund campaigns with PayPal, and the budget is held for verified posts. Approved earnings are paid to the promoter’s PayPal account, and a business can end a campaign to get its unspent budget refunded."],
 ["Which platforms can I use?","Campaigns can run on WhatsApp, Instagram, TikTok and X. Platform availability may vary by campaign and launch phase."],
];

export default function Home(){return <main>
 <MarketingHeader/>

 <section className="hero"><div className="wrap hero-copy"><h1>Real people. Real reach. <em>Real results.</em></h1><p>Turn everyday social media users into promoters for your business. Fund campaigns with PayPal, let AI verify every post, and pay only for the work that checks out.</p><div className="hero-actions"><Link className="button dark" href="/register">Grow your business <ArrowRight/></Link><a className="button light" href="#join">Become a promoter <ArrowRight/></a></div></div><div className="wrap"><HeroProduct/></div></section>

 <section id="channels" className="channels"><div className="wrap"><div><h2>Reach more people through the people they trust.</h2><p>Connect with creators and everyday promoters to share your business across the social platforms your audience uses every day.</p></div><div className="channel-list">{channels.map(({name,icon:Icon})=><span key={name}><b><Icon aria-hidden="true"/></b>{name}</span>)}</div></div></section>

 <section id="goals" className="section goals"><div className="wrap"><SectionHead overline="Campaign outcomes" title="Every campaign starts with a goal." text="Set clear campaign objectives, define rewards, and track activity against the goals that matter to your business."/><div className="goal-grid">{goals.map(({icon:Icon,title,text,measure})=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p><small><CircleCheck/> {measure}</small></article>)}</div></div></section>

 <section id="how" className="section how"><div className="wrap"><SectionHead overline="How REELCH works" title="Create. Promote. Get paid." text="From funding a campaign to paying for verified posts, REELCH connects businesses and everyday social media users through a simple, trackable process."/><div className="step-grid"><Step number="01" title="Create" text="Set your goals, audience and rewards, then fund the campaign with PayPal. The budget is held for verified posts, and what you don’t spend can be refunded."><CampaignCreationDemo/></Step><Step number="02" title="Promote" text="Social media users choose campaigns that interest them, share them with their audiences and submit proof of their posts."><div className="mini-phone"><span>@amara.creates</span><Image src="/images/reelch-hero-collaboration.png" alt="Example social promotion" fill sizes="260px"/><b><Send/> Share campaign</b></div></Step><Step number="03" title="Get paid" text="AI checks each proof against the brief and flags fraud. Posts that pass are paid to the promoter’s PayPal, and anything uncertain goes to a person."><div className="mini-report"><div><small><Sparkles aria-hidden="true"/> AI verification</small><b><AnimatedNumber value={96}/>%</b></div><ul className="mini-checks"><li><BadgeCheck aria-hidden="true"/>Promotes the brief</li><li><BadgeCheck aria-hidden="true"/>Required hashtag found</li><li><BadgeCheck aria-hidden="true"/>Fraud risk low</li></ul><span>$5.00 sent to PayPal</span></div></Step></div></div></section>

 <section className="section product-section"><div className="wrap"><ProductPreview/></div></section>

 <section className="section audience-section"><div className="wrap"><SectionHead overline="Value exchange" title="More visibility for brands. More opportunities for social media users." text="Brands use REELCH to get their products and messages in front of more people. Social media users discover campaigns they can participate in, with rewards and expectations clearly defined upfront."/><div className="audience-grid"><Audience id="businesses" tone="green" icon={BriefcaseBusiness} label="For Brands" title="For Brands" text="Get your products and messages in front of more people through everyday social media users." points={["Launch campaigns based on your goals","Set budgets and reward terms","Track measurable campaign activity"]} href="/register" cta="Launch a Campaign"/><Audience id="promoters" tone="purple" icon={Megaphone} label="For Social Media Users" title="For Social Media Users" text="Find campaigns to participate in, understand the expectations upfront and earn eligible rewards by meeting the stated terms." points={["Find campaigns that fit your audience","See requirements and rewards upfront","Track activity and eligible earnings"]} href="#join" cta="Join REELCH"/></div></div></section>

 <section className="protection"><div className="wrap"><div><h2>Clear terms protect both sides.</h2><p>Before a campaign begins, everyone can see what is expected, which activities qualify and how rewards are determined.</p></div><div className="protection-grid"><span><ShieldCheck/><b>For brands</b><small>Define your campaign requirements, qualifying activities and reward terms upfront.</small></span><span><CircleCheck/><b>For social media users</b><small>Know what is expected, which activities qualify and what rewards are available before you join a campaign.</small></span><span><Sparkles/><b>AI-checked proof</b><small>AI reports what it finds, and fixed rules make the decision. Copied screenshots and inflated claims go to a person.</small></span></div></div></section>

 <section className="section faq"><div className="wrap"><h2>Frequently asked questions.</h2><div className="faq-list">{faqs.map(([q,a],index)=><details key={q} open={index===0}><summary><span className="faq-number">{String(index+1).padStart(2,"0")}</span><strong>{q}</strong><i className="faq-toggle" aria-hidden="true"/></summary><p>{a}</p></details>)}</div></div></section>

 {/* Promoter waitlist: hidden while Reelch runs as the full app. To bring it back for the public launch,
     uncomment this section and the PromoterWaitlistForm import, and point the "/#join" links back to "/#waitlist".
 <section id="waitlist" className="section waitlist"><div className="wrap wait-grid"><div><h2>Bring your audience.<br/><em>Discover new opportunities.</em></h2><p>Explore campaigns that match your interests, understand the requirements upfront and discover opportunities to earn rewards by meeting the stated terms.</p><Link href="/register" className="business-path"><BriefcaseBusiness/><span><b>Launch a Campaign</b>Create your account and campaign workspace.</span><ArrowRight/></Link></div><PromoterWaitlistForm/></div></section>
 */}

 <section id="join" className="section waitlist"><div className="wrap wait-grid"><div><h2>Bring your audience.<br/><em>Discover new opportunities.</em></h2><p>Explore campaigns that match your interests, understand the requirements upfront and earn rewards by meeting the stated terms.</p><Link href="/register" className="business-path"><BriefcaseBusiness/><span><b>Launch a Campaign</b>Create your account and campaign workspace.</span><ArrowRight/></Link></div><PromoterSignup/></div></section>

 <MarketingFooter/><CookieBanner/>
 </main>}

function PromoterSignup(){return <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_24px_70px_#17181118] sm:p-9">
 <div className="border-b border-black/10 pb-6"><p className="text-xs font-black uppercase tracking-[.15em] text-[#6255e7]">For promoters</p><h3 className="mt-2 text-2xl font-black tracking-[-.04em]">Start earning in three steps.</h3></div>
 <ol className="mt-6 grid gap-5">{[
  ["Create your account","Sign up as a promoter with your email and a username."],
  ["Join a campaign","Pick campaigns that fit your audience on TikTok, Instagram, X or WhatsApp."],
  ["Post and get paid","Submit proof of your post. Approved posts are paid to your PayPal."],
 ].map(([title,text],index)=><li key={title} className="flex gap-4"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9e5ff] text-sm font-black text-[#6255e7]">{index+1}</span><span><b className="block font-black">{title}</b><span className="mt-1 block text-sm leading-6 text-black/55">{text}</span></span></li>)}</ol>
 <Link href="/register" className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#171811] px-5 text-sm font-bold text-white transition hover:bg-[#6255e7]">Sign up as a promoter <ArrowRight className="size-4"/></Link>
 <p className="mt-4 text-center text-[.7rem] leading-5 text-black/38">Already have an account? <Link href="/login" className="font-bold underline underline-offset-2">Sign in</Link></p>
</div>}
function SectionHead({title,text}:{overline:string;title:string;text:string}){return <div className="section-head"><div><h2>{title}</h2></div><p>{text}</p></div>}
function HeroProduct(){return <div className="hero-product hero-photo"><Image src="/images/reelch-hero-collaboration.png" alt="A creator and a business owner planning a campaign together" fill priority sizes="(max-width:800px) 94vw, 1240px"/></div>}
function Step({number,title,text,children}:{number:string;title:string;text:string;children:React.ReactNode}){return <article><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p><div className="step-visual">{children}</div></article>}
function ProductPreview(){return <div className="product"><div className="product-copy"><h2>See what you paid for, and why.</h2><p>Follow every proof, what AI found and where the money went, all in one workspace.</p><div><span><ShieldCheck/>Each post is checked against your brief</span><span><MousePointerClick/>Track clicks from every promoter’s link</span><span><BarChart3/>See what is paid, held and refunded</span></div></div><div className="dashboard"><div className="dash-head"><div><small>EXAMPLE CAMPAIGN</small><h3>New savings app launch</h3></div><span>Live</span></div><div className="dash-stats"><span><small>Posts submitted</small><b><AnimatedNumber value={54}/></b></span><span><small>AI verified</small><b><AnimatedNumber value={41}/></b></span><span><small>Sent to a person</small><b><AnimatedNumber value={13}/></b></span></div><div className="dash-bottom"><div className="chart">{[32,48,41,67,55,77,70,92,84].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><div><small>PAID VIA PAYPAL</small><b><AnimatedNumber value={205} prefix="$"/></b><p>41 posts at $5 each</p></div></div></div></div>}
function Audience({id,tone,icon:Icon,label,title,text,points,href,cta}:{id:string;tone:string;icon:typeof Megaphone;label:string;title:string;text:string;points:string[];href:string;cta:string}){return <article id={id} className={`audience ${tone}`}><div className="audience-label"><span><Icon/></span>{label}</div><h3>{title}</h3><p>{text}</p><ul>{points.map(x=><li key={x}><Check/>{x}</li>)}</ul><Link href={href} className="button dark">{cta}<ArrowRight/></Link></article>}
