"use client";

import { useEffect } from "react";
import { toast, Toaster } from "@/components/toasts";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { toast.error("We couldn’t open Reelch. Please try again."); }, [error]);
  return <html lang="en"><body><main className="grid min-h-screen place-items-center bg-[#f6f5f0] p-6"><button onClick={retry} className="rounded-full bg-[#171811] px-6 py-3 font-bold text-white">Try again</button></main><Toaster /></body></html>;
}
