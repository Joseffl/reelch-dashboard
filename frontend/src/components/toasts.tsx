"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, TriangleAlert, Info, X } from "lucide-react";

type Kind = "error" | "success" | "warning" | "info";
type Toast = { id: number; message: string; createdAt: number; kind: Kind };
let messages: Toast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const empty: Toast[] = [];
const publish = () => listeners.forEach(listener => listener());

export function errorMessage(value: unknown, fallback = "Something went wrong. Please try again."): string {
  if (value instanceof DOMException && value.name === "AbortError") return "The request timed out. Please try again.";
  if (value instanceof TypeError && /fetch|network|load failed/i.test(value.message)) return "We couldn’t reach Reelch. Please check your connection and try again.";
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === "string" && /^(failed to fetch|load failed|networkerror)/i.test(value)) return "We couldn’t reach Reelch. Please check your connection and try again.";
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function show(kind: Kind, value: unknown) {
    const message = errorMessage(value);
    // Strict Mode and concurrent requests can report the same failure twice.
    if (messages.some(item => item.kind === kind && item.message === message && Date.now() - item.createdAt < 5000)) return;
    messages = [...messages, { id: ++sequence, message, createdAt: Date.now(), kind }].slice(-3);
    publish();
}

export const toast = {
  error: (value: unknown) => show("error", value),
  success: (value: string) => { if (value) show("success", value); },
  warning: (value: string) => { if (value) show("warning", value); },
  info: (value: string) => { if (value) show("info", value); },
  dismiss(id: number) { messages = messages.filter(item => item.id !== id); publish(); },
};

export function useSuccessToast() {
  return useCallback((message: string) => { if (message) toast.success(message); }, []);
}

// Retain load-failure state for retry/fallback rendering; display errors in toasts.
export function useErrorToast(): [string, (message: string) => void] {
  const [error, setError] = useState("");
  const report = useCallback((message: string) => {
    const text = message === "" ? "" : errorMessage(message);
    setError(text);
    if (text) toast.error(text);
  }, [setError]);
  return [error, report];
}

function ErrorToast({ item }: { item: Toast }) {
  const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "warning" ? TriangleAlert : item.kind === "info" ? Info : AlertCircle;
  const tone = item.kind === "success" ? "text-[#a8e86f]" : item.kind === "warning" ? "text-amber-300" : item.kind === "info" ? "text-violet-300" : "text-red-300";
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => toast.dismiss(item.id), 10_000);
    return () => clearTimeout(timer);
  }, [item.id, paused]);
  return <div role={item.kind === "error" || item.kind === "warning" ? "alert" : "status"} aria-atomic="true" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
    className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/15 bg-[#171811] p-4 text-white shadow-[0_12px_40px_rgba(0,0,0,.22)]">
    <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${tone}`} />
    <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-6">{item.message}</p>
    <button type="button" aria-label={`Dismiss ${item.kind}`} onClick={() => toast.dismiss(item.id)} className="grid size-8 shrink-0 place-items-center rounded-full text-white/65 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X aria-hidden="true" className="size-4" /></button>
  </div>;
}

export function Toaster() {
  const items = useSyncExternalStore(
    useCallback(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, []),
    () => messages,
    () => empty,
  );
  useEffect(() => {
    let validating = false;
    let validationTimer: ReturnType<typeof setTimeout> | undefined;
    const invalid = (event: Event) => {
      // Keep native validity rules, but present their feedback consistently.
      event.preventDefault();
      if (validating) return;
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
      validating = true;
      // Native validation fires an event for every invalid control. Wait until
      // that batch finishes so focus stays on the first control, not the last.
      validationTimer = setTimeout(() => {
        validating = false;
        if (field.isConnected) field.focus();
      }, 0);
      toast.warning(field.validationMessage || "Please check this field.");
    };
    const rejected = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof DOMException && event.reason.name === "AbortError") return;
      toast.error("Something went wrong. Please try again.");
    };
    const failed = (event: ErrorEvent) => { if (event.error) toast.error("Something went wrong. Please try again."); };
    document.addEventListener("invalid", invalid, true);
    window.addEventListener("unhandledrejection", rejected);
    window.addEventListener("error", failed);
    return () => {
      clearTimeout(validationTimer);
      document.removeEventListener("invalid", invalid, true);
      window.removeEventListener("unhandledrejection", rejected);
      window.removeEventListener("error", failed);
    };
  }, []);
  return <section aria-label="Notifications" className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[2000] mx-auto flex max-w-md flex-col gap-2 sm:left-auto sm:mx-0 sm:w-96">
    {items.map(item => <ErrorToast key={item.id} item={item} />)}
  </section>;
}

export function ErrorFallback() {
  return <div className="rounded-2xl border border-black/10 bg-white p-6 text-center"><p className="text-sm text-black/55">This content is unavailable right now.</p><button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-full bg-[#171811] px-5 py-2.5 text-sm font-bold text-white">Try again</button></div>;
}
