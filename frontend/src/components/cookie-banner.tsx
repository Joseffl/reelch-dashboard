"use client";

import Link from "next/link";
import { Check, Cookie, X } from "lucide-react";
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
  const visible = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(consentKey) === null,
    () => false,
  );

  function choose(value: "accepted" | "essential") {
    window.localStorage.setItem(consentKey, value);
    window.dispatchEvent(new Event(consentEvent));
  }

  if (!visible) return null;

  return (
    <aside className="cookie-consent" aria-label="Cookie consent" role="dialog" aria-live="polite">
      <button className="cookie-close" onClick={() => choose("essential")} aria-label="Close and use essential cookies only">
        <X />
      </button>
      <div className="cookie-icon"><Cookie /></div>
      <div className="cookie-copy">
        <h2>Your choices matter.</h2>
        <p>
          We use essential cookies to keep Reelch working. With your permission,
          optional cookies help us understand and improve the experience. Read our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </div>
      <div className="cookie-actions">
        <button onClick={() => choose("essential")}>Essential only</button>
        <button onClick={() => choose("accepted")}><Check /> Accept all</button>
      </div>
    </aside>
  );
}
