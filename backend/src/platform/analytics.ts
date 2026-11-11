// Campaign analytics for a business, built from proofs that Reelch has already checked.
// Views come from the most trustworthy source available for each post: platform metrics,
// then the number the AI read from the evidence, then the promoter's own claim.

export type AnalyticsCampaign = {
  id: string; title: string; status: string; currency: string;
  unitPriceKobo: number; targetQuantity: number; fundedKobo: number; spentKobo: number; refundedKobo?: number; createdAt: Date;
};
export type AnalyticsProof = {
  campaignId: string; platform: string; status: string; createdAt: Date;
  claimedViews: number | null; aiViews: number | null; metricViews: number | null;
  aiDecision: string | null; fraudRisk: string | null;
};

export const PLATFORM_LABELS: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', x: 'X', whatsapp: 'WhatsApp' };

export function verifiedViews(proof: Pick<AnalyticsProof, 'claimedViews' | 'aiViews' | 'metricViews'>) {
  if (proof.metricViews != null) return proof.metricViews;
  // Never report more than the promoter claimed, and never more than the evidence shows.
  if (proof.aiViews != null) return proof.claimedViews ? Math.min(proof.aiViews, proof.claimedViews) : proof.aiViews;
  return proof.claimedViews ?? 0;
}

const day = (date: Date) => date.toISOString().slice(0, 10);
const perThousand = (kobo: number, views: number) => views > 0 ? Math.round(kobo * 1000 / views) : null;

export function summarizeAnalytics(campaigns: AnalyticsCampaign[], proofs: AnalyticsProof[], now = new Date(), days = 14) {
  const approved = proofs.filter(proof => proof.status === 'approved');
  const totalViews = approved.reduce((sum, proof) => sum + verifiedViews(proof), 0);
  const spentKobo = campaigns.reduce((sum, campaign) => sum + campaign.spentKobo, 0);
  const fundedKobo = campaigns.reduce((sum, campaign) => sum + campaign.fundedKobo, 0);
  const refundedKobo = campaigns.reduce((sum, campaign) => sum + (campaign.refundedKobo ?? 0), 0);
  // Whatever was funded but is neither paid out nor refunded is still held in escrow.
  const escrowKobo = Math.max(0, fundedKobo - spentKobo - refundedKobo);

  // Each approved post costs its campaign's reward, so spend can be split by platform too.
  const reward = new Map(campaigns.map(campaign => [campaign.id, campaign.unitPriceKobo]));
  const platforms = new Map<string, { posts: number; views: number; spentKobo: number }>();
  for (const proof of approved) {
    const entry = platforms.get(proof.platform) ?? { posts: 0, views: 0, spentKobo: 0 };
    entry.posts += 1; entry.views += verifiedViews(proof); entry.spentKobo += reward.get(proof.campaignId) ?? 0; platforms.set(proof.platform, entry);
  }
  const byPlatform = [...platforms.entries()]
    .map(([platform, entry]) => ({ platform, label: PLATFORM_LABELS[platform] ?? platform, ...entry, share: totalViews ? entry.views / totalViews : 0, costPerThousandViewsKobo: perThousand(entry.spentKobo, entry.views) }))
    .sort((a, b) => b.views - a.views);

  const byCampaign = campaigns.map(campaign => {
    const own = proofs.filter(proof => proof.campaignId === campaign.id);
    const ok = own.filter(proof => proof.status === 'approved');
    const views = ok.reduce((sum, proof) => sum + verifiedViews(proof), 0);
    const platformViews: Record<string, number> = {};
    for (const proof of ok) platformViews[proof.platform] = (platformViews[proof.platform] ?? 0) + verifiedViews(proof);
    return {
      id: campaign.id, title: campaign.title, status: campaign.status, currency: campaign.currency,
      posts: ok.length, targetPosts: campaign.targetQuantity, submitted: own.length,
      flagged: own.filter(proof => proof.fraudRisk === 'high' || proof.status === 'rejected').length,
      views, spentKobo: campaign.spentKobo, fundedKobo: campaign.fundedKobo, refundedKobo: campaign.refundedKobo ?? 0,
      costPerThousandViewsKobo: perThousand(campaign.spentKobo, views), platformViews,
    };
  }).sort((a, b) => b.views - a.views);

  const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - (days - 1));
  const timeline = Array.from({ length: days }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return { date: day(date), views: 0, posts: 0 }; });
  const byDay = new Map(timeline.map(entry => [entry.date, entry]));
  for (const proof of approved) { const entry = byDay.get(day(proof.createdAt)); if (entry) { entry.posts += 1; entry.views += verifiedViews(proof); } }

  const reviewed = proofs.filter(proof => proof.aiDecision);
  return {
    totals: {
      campaigns: campaigns.length, liveCampaigns: campaigns.filter(campaign => campaign.status === 'live').length,
      approvedPosts: approved.length, pendingPosts: proofs.filter(proof => ['submitted', 'under_review'].includes(proof.status)).length,
      rejectedPosts: proofs.filter(proof => proof.status === 'rejected').length,
      views: totalViews, spentKobo, fundedKobo, refundedKobo, escrowKobo, costPerThousandViewsKobo: perThousand(spentKobo, totalViews),
    },
    byPlatform, byCampaign, timeline,
    ai: {
      reviewed: reviewed.length,
      autoApproved: reviewed.filter(proof => proof.aiDecision === 'auto_approve').length,
      sentToPerson: reviewed.filter(proof => proof.aiDecision !== 'auto_approve').length,
      highRisk: reviewed.filter(proof => proof.fraudRisk === 'high').length,
    },
  };
}

export type BusinessAnalytics = ReturnType<typeof summarizeAnalytics> & { currency: string };
