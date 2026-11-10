"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ListSkeleton } from "@/components/loading-skeleton";
import { ErrorFallback, useErrorToast } from "@/components/toasts";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export const NOTIFICATIONS_READ_EVENT = "reelch:notifications-read";

type Role = "business" | "promoter" | "admin";
type Notification = { id: string; type: string; title: string; body: string; data: { campaignId?: string }; readAt: string | null; createdAt: string };

function destination(role: Role, notification: Notification) {
  if (role === "promoter") {
    if (["proof_reviewed", "campaign_slot_released"].includes(notification.type)) return "/promoter/proofs";
    if (notification.type === "payout_account_required") return "/promoter/earnings";
    return notification.data.campaignId ? "/promoter/campaigns" : null;
  }
  return notification.data.campaignId ? `/${role}/campaigns/${notification.data.campaignId}` : null;
}

export function NotificationsPage({ role }: { role: Role }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useErrorToast();

  useEffect(() => {
    fetch(`${apiUrl}/notifications`, { credentials: "include" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "Could not load notifications");
        setItems(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load notifications"));
  }, [setError]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    setItems((current) => current?.map((item) => (ids.includes(item.id) ? { ...item, readAt } : item)) ?? null);
    await Promise.all(ids.map((id) => fetch(`${apiUrl}/notifications/${id}/read`, { method: "POST", credentials: "include" }))).catch(() => undefined);
    window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
  }, []);

  if (!items) return error ? <ErrorFallback /> : <ListSkeleton />;
  const unread = items.filter((item) => !item.readAt);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
        <p className="text-sm font-bold text-black/50">{unread.length ? `${unread.length} unread` : "All caught up"}</p>
        {unread.length > 0 && (
          <button onClick={() => markRead(unread.map((item) => item.id))} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold">
            <CheckCheck className="size-4" /> Mark all as read
          </button>
        )}
      </div>
      <section className="overflow-hidden rounded-[1.6rem] border border-black/[.08] bg-white">
        {items.map((item) => {
          const href = destination(role, item);
          const content = (
            <>
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-[#6558ff]"}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className={`block text-sm ${item.readAt ? "font-bold text-black/70" : "font-black"}`}>{item.title}</span>
                <span className="mt-1 block text-sm leading-6 text-black/55">{item.body}</span>
                <span className="mt-1 block text-xs text-black/35">{new Date(item.createdAt).toLocaleString()}</span>
              </span>
            </>
          );
          const row = "flex w-full gap-3 border-b border-black/[.06] p-4 text-left last:border-0 sm:p-5";
          return href
            ? <Link key={item.id} href={href} onClick={() => markRead(item.readAt ? [] : [item.id])} className={`${row} hover:bg-black/[.02]`}>{content}</Link>
            : <button key={item.id} onClick={() => markRead(item.readAt ? [] : [item.id])} className={`${row} hover:bg-black/[.02]`}>{content}</button>;
        })}
        {!items.length && (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <Bell className="mx-auto size-7 text-black/25" />
              <p className="mt-3 text-sm font-bold">No notifications yet</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
