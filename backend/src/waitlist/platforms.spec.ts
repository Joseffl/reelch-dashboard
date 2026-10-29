import { describe, expect, it } from 'vitest';
import { waitlistPlatforms, waitlistProfiles } from './platforms.js';

describe('waitlist platform selections', () => {
  it('supports multiple platforms and legacy single-platform clients', () => {
    expect(waitlistPlatforms({ platforms: ['x', 'Instagram', 'X'] })).toEqual(['X', 'Instagram']);
    expect(waitlistPlatforms({ primaryPlatform: 'TikTok' })).toEqual(['TikTok']);
  });
  it('requires and preserves the platform name for Other', () => {
    expect(() => waitlistPlatforms({ platforms: ['Other'] })).toThrow('Enter the name');
    expect(waitlistPlatforms({ platforms: ['X', 'Other'], otherPlatform: ' Bluesky ' })).toEqual(['X', 'Bluesky']);
  });
  it('rejects empty or unsupported choices', () => {
    expect(() => waitlistPlatforms({ platforms: [] })).toThrow();
    expect(() => waitlistPlatforms({ platforms: ['unknown'] })).toThrow();
  });
});

describe('waitlist profile associations', () => {
  it('matches links and WhatsApp numbers to platforms rather than array order', () => {
    expect(waitlistProfiles({ platforms: ['X', 'WhatsApp', 'Other'], otherPlatform: 'Bluesky', profiles: [
      { platform: 'WhatsApp', phone: '+234 801 234 5678' },
      { platform: 'Other', profileUrl: 'bsky.app/profile/example.test' },
      { platform: 'X', profileUrl: 'x.com/example' },
    ] }, ['X', 'WhatsApp', 'Bluesky'])).toEqual([
      { platform: 'X', profileUrl: 'https://x.com/example' },
      { platform: 'WhatsApp', phone: '+2348012345678' },
      { platform: 'Bluesky', profileUrl: 'https://bsky.app/profile/example.test' },
    ]);
  });
  it('rejects missing, duplicate, unsafe links and numbers without country codes', () => {
    for (const profiles of [[], [{platform:'X',profileUrl:'x.com/a'},{platform:'X',profileUrl:'x.com/b'}], [{platform:'X',profileUrl:'javascript:alert(1)'}]]) {
      expect(() => waitlistProfiles({ profiles }, ['X'])).toThrow();
    }
    expect(() => waitlistProfiles({profiles:[{platform:'WhatsApp',phone:'08012345678'}]}, ['WhatsApp'])).toThrow('country code');
  });
  it('preserves the original single link from older clients', () => {
    expect(waitlistProfiles({profileUrl:'x.com/example'}, ['X', 'Instagram'])).toEqual([{platform:'X',profileUrl:'https://x.com/example'}]);
  });
});
