"use client";

import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { useSyncExternalStore } from "react";

const consentKey = "reelch-cookie-consent";
const consentEvent = "reelch-consent-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(consentEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(consentEvent, onChange);
  };
}

export function CookieBanner() {
  const visible = useSyncExternalStore(subscribe, () => window.localStorage.getItem(consentKey) === null, () => false);

  function choose(value: "accepted" | "essential") {
    window.localStorage.setItem(consentKey, value);
    window.dispatchEvent(new Event(consentEvent));
  }

  if (!visible) return null;
  return <aside aria-label="Cookie notice" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl border border-black/15 bg-white p-4 shadow-[0_16px_50px_rgba(23,24,17,.16)] sm:bottom-6 sm:p-5"><button onClick={() => choose("essential")} aria-label="Close cookie notice" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full hover:bg-black/5"><X className="size-4" /></button><div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:pr-0"><span className="hidden size-12 shrink-0 place-items-center rounded-full bg-[#a8e86f] sm:grid"><Cookie className="size-5" /></span><p className="flex-1 text-sm leading-6 text-black/60"><strong className="text-black">A small cookie, for a smoother Reelch.</strong> We use essential cookies to make the site work and optional cookies to understand how it’s used. Read our <Link href="/privacy" className="font-bold text-[#5145cf] underline underline-offset-2">privacy policy</Link>.</p><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => choose("essential")} className="min-h-11 rounded-full border border-black/20 px-4 text-xs font-black">Essential only</button><button onClick={() => choose("accepted")} className="min-h-11 rounded-full bg-[#6255e7] px-5 text-xs font-black text-white">Accept all</button></div></div></aside>;
}
