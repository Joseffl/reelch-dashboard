"use client";

import { useId, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = getCountries().sort((a, b) => (countryNames.of(a) ?? a).localeCompare(countryNames.of(b) ?? b));
const flag = (country: string) => country.replace(/./g, letter => String.fromCodePoint(127397 + letter.charCodeAt(0)));

export function PhoneField({ label, name, defaultValue = "", required = false }: { label: string; name: string; defaultValue?: string; required?: boolean }) {
  const id = useId();
  const initial = parsePhoneNumberFromString(defaultValue, "NG");
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? "NG");
  const [value, setValue] = useState(initial?.nationalNumber ?? defaultValue);
  const callingCode = getCountryCallingCode(country);
  const parsed = parsePhoneNumberFromString(value, country);
  const combined = value.trim() ? parsed?.number ?? (value.trim().startsWith("+") ? value.trim() : `+${callingCode}${value.replace(/\D/g, "").replace(/^0+/, "")}`) : "";

  return <div className="phone-field block text-sm font-bold">
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-black/12 bg-white focus-within:border-[#6558ff] focus-within:ring-4 focus-within:ring-[#6558ff]/10">
      <select aria-label={`${label} country code`} value={country} onChange={event => setCountry(event.target.value as CountryCode)} className="phone-country min-w-0 max-w-[130px] shrink-0 border-0 border-r border-black/10 bg-[#f6f5f0] px-2 text-base outline-none">
        {countries.map(code => <option key={code} value={code}>{flag(code)} +{getCountryCallingCode(code)} · {countryNames.of(code)}</option>)}
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={value} required={required}
        placeholder={country === "NG" ? "0801 234 5678" : "Phone number"}
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
