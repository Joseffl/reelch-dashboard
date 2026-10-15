import { Check, MousePointer2 } from "lucide-react";

export function CampaignCreationDemo() {
  return <div className="campaign-demo" aria-hidden="true">
    <div className="campaign-demo-field campaign-name-field"><small>Campaign name</small><span className="campaign-typed-name">Weekend wellness launch</span></div>
    <div className="campaign-demo-field campaign-category-field"><small>Category</small><span>Health &amp; wellness</span><i>⌄</i></div>
    <div className="campaign-demo-goals"><small>Campaign goal</small><div><b>Visibility</b><b className="campaign-goal-active"><Check/> Acquisition</b><b>Conversion</b></div></div>
    <button type="button" tabIndex={-1}>Review campaign</button>
    <MousePointer2 className="campaign-demo-cursor" fill="currentColor"/>
  </div>;
}
