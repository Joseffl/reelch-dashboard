"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type PlatformConfig = { paymentProvider: "paypal" | "paystack"; currency: string; aiVerification: boolean };

let cached: Promise<PlatformConfig> | undefined;

export function loadPlatformConfig() {
  cached ??= fetch(`${apiUrl}/platform/config`)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("config unavailable"))))
    .catch(() => {
      cached = undefined;
      return { paymentProvider: "paypal", currency: "USD", aiVerification: false } as PlatformConfig;
    });
  return cached;
}

export function usePlatformConfig() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  useEffect(() => {
    let active = true;
    void loadPlatformConfig().then((value) => { if (active) setConfig(value); });
    return () => { active = false; };
  }, []);
  return config;
}
