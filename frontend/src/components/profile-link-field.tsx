"use client";

export function normalizeProfileInput(input: string, allowPhone = false) {
  const value = input.trim();
  if (!value || (allowPhone && /^\+?[\d\s()-]{7,}$/.test(value))) return value;
  return value.startsWith('//') ? `https:${value}` : /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
}

export function ProfileLinkField({ name, allowPhone = false, label = "Profile link" }: { name: string; allowPhone?: boolean; label?: string }) {
  return <label className="block text-sm font-bold">{label}
    <input name={name} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" required
      placeholder="https://x.com/yourname"
      onBlur={event => { event.currentTarget.value = normalizeProfileInput(event.currentTarget.value, allowPhone); }}
      className="mt-2 min-h-12 w-full rounded-xl border border-black/12 bg-white px-4 text-sm outline-none focus:border-[#6558ff] focus:ring-4 focus:ring-[#6558ff]/10" />
    {/* <span className="mt-1 block text-xs font-normal text-black/45">We’ll add https:// automatically if needed.</span> */}
  </label>;
}
