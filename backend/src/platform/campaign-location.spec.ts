import { describe, expect, it } from 'vitest';
import { campaignCountry, campaignLocationAllows, campaignLocations } from './campaign-location.js';

describe('campaign locations', () => {
  it('lets anyone join campaigns open everywhere, including older Nigeria-wide campaigns', () => {
    expect(campaignLocationAllows('Anywhere', { country: 'Germany' })).toBe(true);
    expect(campaignLocationAllows('Anywhere in Nigeria', { country: 'United States' })).toBe(true);
    expect(campaignLocationAllows(undefined, {})).toBe(true);
  });
  it('matches country campaigns against the promoter country', () => {
    expect(campaignLocationAllows('United States', { country: 'United States' })).toBe(true);
    expect(campaignLocationAllows('United States', { country: 'us' })).toBe(true);
    expect(campaignLocationAllows('United States', { country: 'Canada' })).toBe(false);
    expect(campaignLocationAllows('Nigeria', { country: 'NG' })).toBe(true);
  });
  it('keeps older state-level campaigns matching on city', () => {
    expect(campaignLocationAllows('Lagos', { country: 'Nigeria', city: 'Lagos' })).toBe(true);
    expect(campaignLocationAllows('Lagos', { country: 'Nigeria', city: 'Abuja' })).toBe(false);
  });
  it('records the country a campaign targets', () => {
    expect(campaignCountry('United Kingdom')).toBe('United Kingdom');
    expect(campaignCountry('Lagos')).toBe('Nigeria');
    expect(campaignCountry('Anywhere')).toBeUndefined();
    expect(campaignLocations.has('Anywhere') && campaignLocations.has('Kano')).toBe(true);
  });
});
