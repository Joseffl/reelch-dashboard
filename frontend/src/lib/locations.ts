// Keep in sync with CAMPAIGN_COUNTRIES in backend/src/platform/campaign-location.ts.
export const CAMPAIGN_COUNTRIES = ["United States", "United Kingdom", "Canada", "Ireland", "Germany", "France", "Spain", "Italy", "Netherlands", "Australia", "Nigeria", "Ghana", "Kenya", "South Africa"];
export const CAMPAIGN_LOCATIONS = ["Anywhere", ...CAMPAIGN_COUNTRIES];
export const PROFILE_COUNTRIES = [...CAMPAIGN_COUNTRIES, "Other"];

const COUNTRY_CODES: Record<string, string> = {
  "United States": "US", "United Kingdom": "GB", Canada: "CA", Ireland: "IE", Germany: "DE", France: "FR", Spain: "ES", Italy: "IT",
  Netherlands: "NL", Australia: "AU", Nigeria: "NG", Ghana: "GH", Kenya: "KE", "South Africa": "ZA",
};
export const countryCode = (name?: string | null) => (name && COUNTRY_CODES[name]) || undefined;
