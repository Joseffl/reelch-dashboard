"use client";

import { useEffect } from "react";
import { toast } from "@/components/toasts";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { toast.error("We couldn’t open this page. Please try again."); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-[#f6f5f0] p-6"><button onClick={retry} className="rounded-full bg-[#171811] px-6 py-3 font-bold text-white">Try again</button></main>;
}
