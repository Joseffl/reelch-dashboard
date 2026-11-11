import { describe, expect, it } from 'vitest';
import { summarizeAnalytics, verifiedViews, type AnalyticsCampaign, type AnalyticsProof } from './analytics.js';

const now = new Date('2026-11-10T12:00:00Z');
const campaign = (id: string, spentKobo: number, overrides: Partial<AnalyticsCampaign> = {}): AnalyticsCampaign => ({
  id, title: `Campaign ${id}`, status: 'live', currency: 'USD', unitPriceKobo: 2500, targetQuantity: 20, fundedKobo: 50000, spentKobo, createdAt: now, ...overrides,
});
const proof = (campaignId: string, platform: string, views: number, overrides: Partial<AnalyticsProof> = {}): AnalyticsProof => ({
  campaignId, platform, status: 'approved', createdAt: now, claimedViews: views, aiViews: views, metricViews: null, aiDecision: 'auto_approve', fraudRisk: 'low', ...overrides,
});

describe('verified views', () => {
  it('prefers platform metrics, then the evidence, and never exceeds the claim', () => {
    expect(verifiedViews({ claimedViews: 900, aiViews: 1000, metricViews: 1200 })).toBe(1200);
    expect(verifiedViews({ claimedViews: 50000, aiViews: 1250, metricViews: null })).toBe(1250);
    expect(verifiedViews({ claimedViews: 900, aiViews: 1000, metricViews: null })).toBe(900);
    expect(verifiedViews({ claimedViews: 0, aiViews: 1000, metricViews: null })).toBe(1000);
    expect(verifiedViews({ claimedViews: 700, aiViews: null, metricViews: null })).toBe(700);
  });
});

describe('business analytics', () => {
  const result = summarizeAnalytics(
    [campaign('a', 5000), campaign('b', 2500, { status: 'completed' })],
    [
      proof('a', 'tiktok', 6000), proof('a', 'x', 2000), proof('b', 'instagram', 1000),
      proof('a', 'whatsapp', 50000, { status: 'rejected', aiViews: 1250, aiDecision: 'needs_review', fraudRisk: 'high' }),
      proof('b', 'x', 800, { status: 'under_review', aiDecision: 'needs_review' }),
      proof('a', 'tiktok', 4000, { createdAt: new Date('2026-10-01T00:00:00Z') }),
    ], now);

  it('totals only approved work', () => {
    expect(result.totals).toMatchObject({ campaigns: 2, liveCampaigns: 1, approvedPosts: 4, pendingPosts: 1, rejectedPosts: 1, views: 13000, spentKobo: 7500 });
    expect(result.totals.costPerThousandViewsKobo).toBe(577);
  });
  it('splits the budget into paid, refunded and still in escrow', () => {
    const budget = summarizeAnalytics([campaign('a', 5000), campaign('b', 2500, { status: 'completed', refundedKobo: 47500 })], [], now).totals;
    expect(budget).toMatchObject({ fundedKobo: 100000, spentKobo: 7500, refundedKobo: 47500, escrowKobo: 45000 });
  });
  it('splits views by platform, largest first', () => {
    expect(result.byPlatform.map(entry => [entry.label, entry.views, entry.posts])).toEqual([['TikTok', 10000, 2], ['X', 2000, 1], ['Instagram', 1000, 1]]);
    expect(result.byPlatform[0].share).toBeCloseTo(10000 / 13000);
    expect(result.byPlatform[0]).toMatchObject({ spentKobo: 5000, costPerThousandViewsKobo: 500 });
  });
  it('ranks campaigns by verified views with cost per thousand views', () => {
    expect(result.byCampaign.map(entry => [entry.id, entry.posts, entry.views, entry.flagged])).toEqual([['a', 3, 12000, 1], ['b', 1, 1000, 0]]);
    expect(result.byCampaign[0].costPerThousandViewsKobo).toBe(417);
    expect(result.byCampaign[0].platformViews).toEqual({ tiktok: 10000, x: 2000 });
  });
  it('builds a daily timeline for the last two weeks', () => {
    expect(result.timeline).toHaveLength(14);
    expect(result.timeline.at(-1)).toEqual({ date: '2026-11-10', views: 9000, posts: 3 });
  });
  it('summarizes what the AI did', () => {
    expect(result.ai).toEqual({ reviewed: 6, autoApproved: 4, sentToPerson: 2, highRisk: 1 });
  });
});
