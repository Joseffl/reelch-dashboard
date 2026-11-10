"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries().sort((a, b) => (countryNames.of(a) ?? a).localeCompare(countryNames.of(b) ?? b));
const flag = (country: string) => country.replace(/./g, letter => String.fromCodePoint(127397 + letter.charCodeAt(0)));
const subscribeToNothing = () => () => undefined;
const examples: Partial<Record<CountryCode, string>> = { US: "(201) 555-0123", CA: "(204) 555-0123", GB: "07400 123456", IE: "085 012 3456", NG: "0801 234 5678", AU: "0412 345 678", DE: "01512 3456789" };

export function PhoneField({ label, name, defaultValue = "", required = false, defaultCountry = "US" }: { label: string; name: string; defaultValue?: string; required?: boolean; defaultCountry?: CountryCode }) {
  const id = useId();
  // Country names and their order vary between Node, browsers and locales, so the server renders only
  // the selected country and the full list appears once the page has loaded in the browser.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const initial = parsePhoneNumberFromString(defaultValue, defaultCountry);
  // Until the user picks a dialling code (or a saved number has one), follow the country chosen elsewhere in the form.
  const [picked, setCountry] = useState<CountryCode | null>(initial?.country ?? null);
  const country = picked ?? defaultCountry;
  const [value, setValue] = useState(initial?.nationalNumber ?? defaultValue);
  const callingCode = getCountryCallingCode(country);
  const parsed = parsePhoneNumberFromString(value, country);
  const combined = value.trim() ? parsed?.number ?? (value.trim().startsWith("+") ? value.trim() : `+${callingCode}${value.replace(/\D/g, "").replace(/^0+/, "")}`) : "";

  return <div className="phone-field block text-sm font-bold">
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-black/12 bg-white focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
      <select aria-label={`${label} country code`} value={country} onChange={event => setCountry(event.target.value as CountryCode)} className="phone-country min-w-0 max-w-[130px] shrink-0 border-0 border-r border-black/10 bg-[#f6f5f0] px-2 text-base outline-none">
        {hydrated
          ? countries.map(code => <option key={code} value={code}>{flag(code)} +{getCountryCallingCode(code)} · {countryNames.of(code)}</option>)
          : <option value={country}>{flag(country)} +{callingCode}</option>}
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={value} required={required}
        placeholder={examples[country] ?? "Phone number"}
        onChange={event => {
          const next = event.target.value;
          if (next.trim().startsWith("+")) {
            const international = parsePhoneNumberFromString(next);
            if (international?.country) { setCountry(international.country); setValue(international.nationalNumber); return; }
          }
          setValue(next);
        }}
        onInput={event => event.currentTarget.setCustomValidity(/^[+\d\s().-]*$/.test(event.currentTarget.value) ? "" : "Enter a valid phone number.")}
        minLength={6} maxLength={26} className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-base font-normal outline-none" />
    </div>
    <input type="hidden" name={name} value={combined} />
  </div>;
}
