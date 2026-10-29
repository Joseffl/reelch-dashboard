import { BadRequestException } from '@nestjs/common';
import { normalizeProfileLink } from '../common/profile-link.js';

const known = ['Instagram', 'TikTok', 'X', 'YouTube', 'WhatsApp', 'Facebook', 'LinkedIn', 'Other'];
export function waitlistPlatforms(input: { platforms?: unknown; primaryPlatform?: unknown; otherPlatform?: unknown }): string[] {
  const raw = Array.isArray(input.platforms) ? input.platforms : [input.primaryPlatform];
  if (!raw.length || raw.length > 8 || raw.some(value => typeof value !== 'string')) throw new BadRequestException('Select at least one platform');
  const platforms = [...new Set(raw.map(value => {
    const label = String(value).trim();
    const match = known.find(item => item.toLowerCase() === label.toLowerCase());
    if (!match) throw new BadRequestException('Select a supported platform or choose Other');
    if (match !== 'Other') return match;
    const other = typeof input.otherPlatform === 'string' ? input.otherPlatform.trim() : '';
    if (!other || other.length > 60 || other.toLowerCase() === 'other') throw new BadRequestException('Enter the name of your other platform');
    return other;
  }))];
  return platforms;
}

export type WaitlistProfile = { platform: string; profileUrl?: string; phone?: string };
export function waitlistProfiles(input: { profiles?: unknown; platforms?: unknown; primaryPlatform?: unknown; otherPlatform?: unknown; profileUrl?: string }, platforms: string[]): WaitlistProfile[] {
  // Old clients supplied only one profile. Preserve that association without
  // inventing links for their other selected platforms.
  if (input.profiles === undefined) {
    if (!input.profileUrl?.trim()) throw new BadRequestException('Complete all required waitlist fields');
    const value = normalizeProfileLink(input.profileUrl, platforms[0] === 'WhatsApp');
    return [platforms[0] === 'WhatsApp' && /^\+?[\d\s()-]+$/.test(value) ? { platform: platforms[0], phone: value } : { platform: platforms[0], profileUrl: value }];
  }
  if (!Array.isArray(input.profiles) || input.profiles.length !== platforms.length) throw new BadRequestException('Provide a profile for each selected platform');
  const rawPlatforms = Array.isArray(input.platforms) ? input.platforms : [input.primaryPlatform];
  return platforms.map(platform => {
    const key = platform === input.otherPlatform?.toString().trim() && rawPlatforms.includes('Other') ? 'Other' : platform;
    const matches = input.profiles as Record<string, unknown>[];
    const profiles = matches.filter(profile => profile && typeof profile === 'object' && profile.platform === key);
    if (profiles.length !== 1) throw new BadRequestException(`Provide one profile for ${platform}`);
    const profile = profiles[0];
    if (platform === 'WhatsApp') {
      const phone = typeof profile.phone === 'string' ? profile.phone.replace(/[\s().-]/g, '') : '';
      if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new BadRequestException('Enter a WhatsApp number with its country code');
      return { platform, phone };
    }
    if (typeof profile.profileUrl !== 'string' || !profile.profileUrl.trim()) throw new BadRequestException(`Enter your ${platform} profile link`);
    return { platform, profileUrl: normalizeProfileLink(profile.profileUrl) };
  });
}
