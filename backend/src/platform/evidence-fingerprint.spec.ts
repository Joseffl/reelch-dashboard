import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { fingerprintDistance, imageFingerprint, isNearDuplicate } from './evidence-fingerprint.js';

const screen = (views: string, background = '#075e54', headline = 'SaveUp savings app') => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="1000"><rect width="640" height="1000" fill="${background}"/><text x="32" y="330" font-family="Helvetica" font-size="40" fill="#fff">${headline}</text><circle cx="320" cy="600" r="120" fill="#9f5"/><text x="32" y="930" font-family="Helvetica" font-size="28" fill="#fff">Seen by ${views}</text></svg>`)).png().toBuffer();

describe('evidence fingerprint', () => {
  it('keeps re-saved and resized copies close, and different images far', async () => {
    const original = await screen('1,250');
    const fingerprint = await imageFingerprint(original);
    expect(fingerprint).toHaveLength(64);
    expect(fingerprintDistance(fingerprint, await imageFingerprint(await sharp(original).jpeg({ quality: 40 }).toBuffer()))).toBeLessThanOrEqual(40);
    expect(fingerprintDistance(fingerprint, await imageFingerprint(await sharp(original).resize(320).webp().toBuffer()))).toBeLessThanOrEqual(40);
    expect(fingerprintDistance(fingerprint, await imageFingerprint(await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="1000"><rect width="640" height="1000" fill="#fff"/><rect y="100" width="640" height="200" fill="#000"/><rect y="600" x="300" width="200" height="300" fill="#333"/></svg>')).png().toBuffer()))).toBeGreaterThan(40);
  });
  it('only flags images that look alike and read the same', () => {
    const same = '0'.repeat(64);
    const far = 'f'.repeat(64);
    expect(isNearDuplicate({ fingerprint: same, views: 1250 }, { fingerprint: same, views: 1250 })).toBe(true);
    expect(isNearDuplicate({ fingerprint: same, views: 1250 }, { fingerprint: same, views: 1870 })).toBe(false);
    expect(isNearDuplicate({ fingerprint: same, views: 1250 }, { fingerprint: far, views: 1250 })).toBe(false);
    expect(isNearDuplicate({ fingerprint: same, handle: 'Ada' }, { fingerprint: same, handle: 'ada' })).toBe(true);
    expect(isNearDuplicate({ fingerprint: same }, { fingerprint: same })).toBe(false);
    expect(isNearDuplicate({ fingerprint: same, views: 1250 }, { fingerprint: same })).toBe(false);
  });
});
