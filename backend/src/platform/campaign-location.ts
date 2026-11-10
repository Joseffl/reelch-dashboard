export const CAMPAIGN_COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Ireland', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Australia', 'Nigeria', 'Ghana', 'Kenya', 'South Africa'];
// Campaigns created before Reelch went international target Nigerian states and stay valid.
const legacyNigerianLocations = new Set(['Anywhere in Nigeria', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']);
export const campaignLocations = new Set(['Anywhere', ...CAMPAIGN_COUNTRIES, ...legacyNigerianLocations]);
const countryAliases: Record<string, string> = { ng: 'nigeria', us: 'united states', usa: 'united states', uk: 'united kingdom', gb: 'united kingdom' };
const normalizeCountry = (value?: string | null) => { const key = value?.trim().toLowerCase() ?? ''; return countryAliases[key] ?? key; };
export function campaignLocationAllows(location: unknown, promoter: { country?: string | null; city?: string | null }) {
  const target = typeof location === 'string' ? location.trim().toLowerCase() : 'anywhere';
  if (target === 'anywhere' || target === 'anywhere in nigeria') return true;
  if (CAMPAIGN_COUNTRIES.some(country => country.toLowerCase() === target)) return normalizeCountry(promoter.country) === target;
  return !!promoter.city && promoter.city.trim().toLowerCase() === target;
}
export const campaignCountry = (location: unknown) => typeof location === 'string' && CAMPAIGN_COUNTRIES.includes(location) ? location : legacyNigerianLocations.has(String(location)) ? 'Nigeria' : undefined;
