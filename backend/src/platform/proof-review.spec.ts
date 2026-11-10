import { describe, expect, it } from 'vitest';
import { decideProof, firstProofDeadline, resubmitDeadline, sanitizeAssessment, type AiProofAssessment, type ProofDecisionInput } from './proof-review.js';
import { fromPaypalValue, toPaypalValue } from './paypal.service.js';

const passing: AiProofAssessment = {
  summary: 'Post promotes the campaign', contentMatch: 94,
  requirements: [{ label: 'Includes #ReelchPromo', status: 'passed', evidence: 'Caption contains it' }],
  extracted: { handle: 'ada', views: 1500, hashtags: ['#ReelchPromo'] },
  fraudSignals: [], fraudRisk: 'low', recommendation: 'approve',
};
const input = (overrides: Partial<ProofDecisionInput> = {}): ProofDecisionInput => ({
  assessment: passing, verificationMethod: 'public_metadata', ownershipMatches: true, hashtagMatches: true,
  minimumViews: 0, duplicateEvidence: false,
  settings: { autoApprove: true, minimumScore: 85, allowEvidenceOnly: false }, ...overrides,
});

describe('proof decision policy', () => {
  it('auto-approves platform-verified proofs that pass every check', () => {
    expect(decideProof(input())).toEqual({ decision: 'auto_approve', assurance: 'platform_verified', fraudRisk: 'low', reasons: [] });
  });
  it('routes to review when the AI is unavailable or unconvinced', () => {
    expect(decideProof(input({ assessment: null })).decision).toBe('needs_review');
    expect(decideProof(input({ assessment: { ...passing, contentMatch: 70 } })).reasons).toContain('Content match 70 is below 85');
    expect(decideProof(input({ assessment: { ...passing, fraudSignals: [{ signal: 'Edited numbers', severity: 'medium', evidence: '' }] } })).decision).toBe('needs_review');
    expect(decideProof(input({ assessment: { ...passing, recommendation: 'reject' } })).decision).toBe('needs_review');
  });
  it('never lets the AI override deterministic platform checks', () => {
    expect(decideProof(input({ ownershipMatches: false })).reasons).toContain('The post author does not match the promoter account');
    expect(decideProof(input({ hashtagMatches: false })).decision).toBe('needs_review');
  });
  it('marks reused evidence as high risk', () => {
    const decision = decideProof(input({ duplicateEvidence: true }));
    expect(decision).toMatchObject({ decision: 'needs_review', fraudRisk: 'high' });
  });
  it('marks near-identical evidence as high risk', () => {
    const decision = decideProof(input({ nearDuplicateEvidence: true }));
    expect(decision).toMatchObject({ decision: 'needs_review', fraudRisk: 'high' });
    expect(decision.reasons[0]).toContain('near-identical');
  });
  it('only trusts screenshot view counts when evidence-only approval is enabled', () => {
    const screenshot = input({ verificationMethod: 'manual', minimumViews: 1000 });
    expect(decideProof(screenshot)).toMatchObject({ decision: 'needs_review', assurance: 'evidence_reviewed' });
    expect(decideProof({ ...screenshot, settings: { ...screenshot.settings, allowEvidenceOnly: true } }).decision).toBe('auto_approve');
    expect(decideProof({ ...screenshot, settings: { ...screenshot.settings, allowEvidenceOnly: true }, assessment: { ...passing, extracted: { ...passing.extracted, views: 400 } } }).reasons).toContain('400 views is below the 1000 minimum');
  });
  it('prefers platform metrics over screenshot readings', () => {
    expect(decideProof(input({ minimumViews: 1000, platformViews: 999 })).decision).toBe('needs_review');
    expect(decideProof(input({ minimumViews: 1000, platformViews: 1000 })).decision).toBe('auto_approve');
  });
  it('sends inflated view claims to review', () => {
    expect(decideProof(input({ claimedViews: 50000 })).reasons).toContain('Claimed 50000 views but the evidence shows 1500');
    expect(decideProof(input({ claimedViews: 5000, platformViews: 2000 })).reasons).toContain('Claimed 5000 views but the evidence shows 2000');
    expect(decideProof(input({ claimedViews: 1600 })).decision).toBe('auto_approve');
    expect(decideProof(input({ claimedViews: 0 })).decision).toBe('auto_approve');
  });
  it('respects the automatic approval switch', () => {
    expect(decideProof(input({ settings: { autoApprove: false, minimumScore: 85, allowEvidenceOnly: false } })).decision).toBe('needs_review');
  });
});

describe('resubmit window', () => {
  it('gives promoters 24 hours after a rejection', () => {
    expect(resubmitDeadline(new Date('2026-11-09T10:00:00Z')).toISOString()).toBe('2026-11-10T10:00:00.000Z');
  });
});

describe('first proof window', () => {
  it('gives promoters 72 hours after joining', () => {
    expect(firstProofDeadline(new Date('2026-11-09T10:00:00Z')).toISOString()).toBe('2026-11-12T10:00:00.000Z');
  });
});

describe('AI output sanitizing', () => {
  it('fails closed on malformed model output', () => {
    expect(sanitizeAssessment('nonsense')).toMatchObject({ contentMatch: 0, fraudRisk: 'high', recommendation: 'review', requirements: [] });
    const coerced = sanitizeAssessment({ contentMatch: 150, fraudRisk: 'none', recommendation: 'pay me', requirements: [{ label: 'x', status: 'maybe' }], extracted: { views: -5, handle: '@ada' } });
    expect(coerced).toMatchObject({ contentMatch: 100, fraudRisk: 'high', recommendation: 'review', requirements: [{ status: 'unverified' }], extracted: { handle: 'ada', views: undefined } });
  });
});

describe('PayPal amounts', () => {
  it('converts between minor units and PayPal decimal strings', () => {
    expect(toPaypalValue(250)).toBe('2.50');
    expect(toPaypalValue(100_000)).toBe('1000.00');
    expect(fromPaypalValue('19.99')).toBe(1999);
  });
});
