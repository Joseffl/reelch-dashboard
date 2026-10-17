import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, BriefcaseBusiness, Check, CircleCheck, Eye, Megaphone, MousePointerClick, Send, ShieldCheck, Target, UsersRound } from "lucide-react";
import { FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";
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
 {name:"YouTube",icon:FaYoutube},
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
 ["Which platforms can I use?","Campaigns can be designed for platforms such as WhatsApp, Instagram, TikTok, X and YouTube. Platform availability may vary by campaign and launch phase."],
];

export default function Home(){return <main>
 <MarketingHeader/>

 <section className="hero"><div className="wrap hero-copy"><h1>Real people. Real reach. <em>Real results.</em></h1><p>Turn everyday social media users into promoters for your business. Launch campaigns, set clear rewards, track activity, and grow your reach through trusted recommendations.</p><div className="hero-actions"><Link className="button dark" href="/register">Grow your business <ArrowRight/></Link><a className="button light" href="#waitlist">Become a promoter <ArrowRight/></a></div></div><div className="wrap"><HeroProduct/></div></section>

 <section id="channels" className="channels"><div className="wrap"><div><h2>Reach more people through the people they trust.</h2><p>Connect with creators and everyday promoters to share your business across the social platforms your audience uses every day.</p></div><div className="channel-list">{channels.map(({name,icon:Icon})=><span key={name}><b><Icon aria-hidden="true"/></b>{name}</span>)}</div></div></section>

 <section id="goals" className="section goals"><div className="wrap"><SectionHead overline="Campaign outcomes" title="Every campaign starts with a goal." text="Set clear campaign objectives, define rewards, and track activity against the goals that matter to your business."/><div className="goal-grid">{goals.map(({icon:Icon,title,text,measure})=><article key={title}><span><Icon/></span><h3>{title}</h3><p>{text}</p><small><CircleCheck/> {measure}</small></article>)}</div></div></section>

 <section id="how" className="section how"><div className="wrap"><SectionHead overline="How REELCH works" title="Create. Promote. Measure." text="From setting up a campaign to sharing it with an audience, REELCH connects businesses and everyday social media users through a simple, trackable process."/><div className="step-grid"><Step number="01" title="Create" text="Set up your campaign by choosing your goals, defining your audience, setting your budget and establishing clear rewards."><CampaignCreationDemo/></Step><Step number="02" title="Promote" text="Social media users choose campaigns that interest them and share them with their audiences."><div className="mini-phone"><span>@amara.creates</span><Image src="/images/reelch-hero-collaboration.png" alt="Example social promotion" fill sizes="260px"/><b><Send/> Share campaign</b></div></Step><Step number="03" title="Measure" text="Review campaign activity, assess progress towards your goals and manage rewards according to the agreed terms."><div className="mini-report"><div><small>Tracked activity</small><b><AnimatedNumber value={184}/></b></div><div className="mini-bars">{[35,58,48,76,64,91].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><span>Rewards pending review</span></div></Step></div></div></section>

 <section className="section product-section"><div className="wrap"><ProductPreview/></div></section>

 <section className="section audience-section"><div className="wrap"><SectionHead overline="Value exchange" title="More visibility for brands. More opportunities for social media users." text="Brands use REELCH to get their products and messages in front of more people. Social media users discover campaigns they can participate in, with rewards and expectations clearly defined upfront."/><div className="audience-grid"><Audience id="businesses" tone="green" icon={BriefcaseBusiness} label="For Brands" title="For Brands" text="Get your products and messages in front of more people through everyday social media users." points={["Launch campaigns based on your goals","Set budgets and reward terms","Track measurable campaign activity"]} href="/register" cta="Launch a Campaign"/><Audience id="promoters" tone="purple" icon={Megaphone} label="For Social Media Users" title="For Social Media Users" text="Find campaigns to participate in, understand the expectations upfront and earn eligible rewards by meeting the stated terms." points={["Find campaigns that fit your audience","See requirements and rewards upfront","Track activity and eligible earnings"]} href="#waitlist" cta="Join REELCH"/></div></div></section>

 <section className="protection"><div className="wrap"><div><h2>Clear terms protect both sides.</h2><p>Before a campaign begins, everyone can see what is expected, which activities qualify and how rewards are determined.</p></div><div className="protection-grid"><span><ShieldCheck/><b>For brands</b><small>Define your campaign requirements, qualifying activities and reward terms upfront.</small></span><span><CircleCheck/><b>For social media users</b><small>Know what is expected, which activities qualify and what rewards are available before you join a campaign.</small></span><span><BarChart3/><b>Campaign reporting</b><small>Available reporting depends on the campaign objective and the tracking capabilities of the selected social platform.</small></span></div></div></section>

 <section className="section faq"><div className="wrap"><h2>Frequently asked questions.</h2><div className="faq-list">{faqs.map(([q,a],index)=><details key={q} open={index===0}><summary><span className="faq-number">{String(index+1).padStart(2,"0")}</span><strong>{q}</strong><i className="faq-toggle" aria-hidden="true"/></summary><p>{a}</p></details>)}</div></div></section>

 <section id="waitlist" className="section waitlist"><div className="wrap wait-grid"><div><h2>Bring your audience.<br/><em>Discover new opportunities.</em></h2><p>Explore campaigns that match your interests, understand the requirements upfront and discover opportunities to earn rewards by meeting the stated terms.</p><Link href="/register" className="business-path"><BriefcaseBusiness/><span><b>Launch a Campaign</b>Create your account and campaign workspace.</span><ArrowRight/></Link></div><PromoterWaitlistForm/></div></section>

 <MarketingFooter/><CookieBanner/>
 </main>}

function SectionHead({title,text}:{overline:string;title:string;text:string}){return <div className="section-head"><div><h2>{title}</h2></div><p>{text}</p></div>}
function HeroProduct(){return <div className="hero-product hero-photo"><Image src="/images/reelch-hero-collaboration.png" alt="A creator and a business owner planning a campaign together" fill priority sizes="(max-width:800px) 94vw, 1240px"/></div>}
function Step({number,title,text,children}:{number:string;title:string;text:string;children:React.ReactNode}){return <article><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p><div className="step-visual">{children}</div></article>}
function ProductPreview(){return <div className="product"><div className="product-copy"><h2>Track activity. Understand your progress.</h2><p>Keep track of campaign activity, review recorded outcomes and see the status of eligible rewards in one workspace.</p><div><span><MousePointerClick/>Track what matters to your campaign</span><span><ShieldCheck/>Review campaign activity with supporting evidence</span><span><BarChart3/>Track pending and completed rewards</span></div></div><div className="dashboard"><div className="dash-head"><div><small>ACQUISITION CAMPAIGN</small><h3>New customer referrals</h3></div><span>Live</span></div><div className="dash-stats"><span><small>Link clicks</small><b><AnimatedNumber value={428}/></b></span><span><small>Submitted leads</small><b><AnimatedNumber value={54}/></b></span><span><small>Approved actions</small><b><AnimatedNumber value={41}/></b></span></div><div className="dash-bottom"><div className="chart">{[32,48,41,67,55,77,70,92,84].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><div><small>REWARD STATUS</small><b><AnimatedNumber value={42000} prefix="₦"/></b><p>Pending review</p></div></div></div></div>}
function Audience({id,tone,icon:Icon,label,title,text,points,href,cta}:{id:string;tone:string;icon:typeof Megaphone;label:string;title:string;text:string;points:string[];href:string;cta:string}){return <article id={id} className={`audience ${tone}`}><div className="audience-label"><span><Icon/></span>{label}</div><h3>{title}</h3><p>{text}</p><ul>{points.map(x=><li key={x}><Check/>{x}</li>)}</ul><Link href={href} className="button dark">{cta}<ArrowRight/></Link></article>}
