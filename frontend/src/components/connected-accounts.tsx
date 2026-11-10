"use client";

import { toast } from "@/components/toasts";
import { CheckCircle2, Link2, LoaderCircle, Music2, Unlink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Connection = { provider: string; username: string; connectedAt: string };
type Data = { tiktok: { available: boolean }; connections: Connection[] };

// Messages for the status TikTok sends the promoter back with (?tiktok=...).
const outcomes: Record<string, [ok: boolean, message: string]> = {
  connected: [true, "TikTok connected. Reelch can now confirm your TikTok posts and their views."],
  cancelled: [false, "TikTok was not connected because the request was cancelled."],
  "missing-permission": [false, "Please allow Reelch to see your public videos so it can confirm your posts."],
  "in-use": [false, "That TikTok account is already connected to another Reelch promoter."],
  expired: [false, "The TikTok connection timed out. Please try again."],
  error: [false, "TikTok could not be connected. Please try again."],
};

export function ConnectedAccounts() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const load = useCallback(() => fetch(`${apiUrl}/promoter/social/connections`, { credentials: "include" }).then(response => response.ok ? response.json() : null).then(setData).catch(() => setData(null)), []);

  useEffect(() => {
    void load();
    const status = new URLSearchParams(window.location.search).get("tiktok");
    if (status && outcomes[status]) {
      const [ok, message] = outcomes[status];
      if (ok) toast.success(message); else toast.error(message);
      const url = new URL(window.location.href); url.searchParams.delete("tiktok"); window.history.replaceState(null, "", url);
    }
  }, [load]);

  async function connect() {
    setBusy("connect");
    try {
      const response = await fetch(`${apiUrl}/promoter/social/tiktok/connect`, { method: "POST", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) throw new Error(body.message || "TikTok could not be connected right now.");
      window.location.assign(body.url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "TikTok could not be connected right now."); setBusy(null); }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const response = await fetch(`${apiUrl}/promoter/social/tiktok`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error();
      toast.success("TikTok disconnected."); await load();
    } catch { toast.error("TikTok could not be disconnected. Please try again."); }
    finally { setBusy(null); }
  }

  if (!data) return null;
  const tiktok = data.connections.find(connection => connection.provider === "tiktok");

  return <section className="rounded-2xl border border-black/[.08] bg-white p-6">
    <h3 className="text-base font-black">Connected accounts</h3>
    <p className="mt-1 text-xs leading-5 text-black/50">Connect an account so Reelch can read your post&apos;s real view count. Read-only: Reelch never posts for you.</p>
    <div className="mt-4 rounded-xl border border-black/[.08] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[#171811] text-white"><Music2 className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">TikTok</p>
          {tiktok
            ? <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-green-700"><CheckCircle2 className="size-3.5 shrink-0" /> {tiktok.username}</p>
            : <p className="mt-0.5 text-xs text-black/45">Views confirmed by TikTok</p>}
        </div>
      </div>
      {tiktok
        ? <button onClick={disconnect} disabled={busy !== null} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-black/12 text-sm font-bold disabled:opacity-50">{busy === "disconnect" ? <LoaderCircle className="size-4 animate-spin" /> : <Unlink className="size-4" />} Disconnect</button>
        : data.tiktok.available
          ? <button onClick={connect} disabled={busy !== null} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#171811] text-sm font-bold text-white disabled:opacity-50">{busy === "connect" ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />} Connect TikTok</button>
          : <p className="mt-3 text-xs text-black/45">Connecting TikTok is coming soon.</p>}
    </div>
    <p className="mt-3 text-xs leading-5 text-black/45">Instagram, X and WhatsApp posts are checked from the link and a screenshot of your views.</p>
  </section>;
}
