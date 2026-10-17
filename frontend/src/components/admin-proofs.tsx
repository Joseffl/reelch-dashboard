"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ListSkeleton } from "@/components/loading-skeleton";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Row = {
  proof: {
    id: string;
    platform: string;
    submittedUrl?: string;
    claimedViews?: number;
    status: string;
    verificationMethod: string;
    automatedChecks: Record<string, unknown>;
    storageKey?: string;
    createdAt: string;
  };
  campaignTitle: string;
  promoterUsername: string;
  promoterName: string;
};

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Request failed");
  return body;
}

export function AdminProofs() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("submitted");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await fetch(`${apiUrl}/admin/proofs?status=${status}`, {
        credentials: "include",
      }).then(json);
      setItems(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load proofs");
    }
  }, [status]);

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/admin/proofs?status=${status}`, { credentials: "include" })
      .then(json)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load proofs");
      });
    return () => {
      active = false;
    };
  }, [status]);

  async function decide(id: string, decision: "approved" | "rejected") {
    const rejectionReason = reason.trim();
    if (decision === "rejected" && !rejectionReason) {
      setError("Enter a reason before rejecting this proof.");
      return;
    }

    setBusy(id);
    setError("");
    try {
      await fetch(`${apiUrl}/admin/proofs/${id}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason: rejectionReason }),
      }).then(json);
      setRejecting("");
      setReason("");
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Decision failed");
    } finally {
      setBusy("");
    }
  }

  async function evidence(id: string) {
    try {
      const body = await fetch(`${apiUrl}/proofs/${id}/evidence`, {
        credentials: "include",
      }).then(json);
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (evidenceError) {
      setError(evidenceError instanceof Error ? evidenceError.message : "Evidence unavailable");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {["submitted", "under_review", "approved", "rejected"].map((value) => (
          <button
            key={value}
            onClick={() => {
              setStatus(value);
              setItems(null);
              setRejecting("");
              setReason("");
            }}
            className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${
              status === value ? "bg-[#171811] text-white" : "bg-white"
            }`}
          >
            {value.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}

      {!items ? (
        <ListSkeleton />
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article key={item.proof.id} className="rounded-3xl border border-black/[.08] bg-white p-6">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-[#6558ff]">{item.proof.platform}</p>
                  <h2 className="mt-1 text-lg font-black">{item.campaignTitle}</h2>
                  <p className="mt-1 text-xs text-black/45">
                    {item.promoterName} · @{item.promoterUsername}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-black/5 px-3 py-1 text-xs font-bold capitalize">
                  {item.proof.verificationMethod.replaceAll("_", " ")}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-black/40">Claimed views</dt>
                  <dd className="font-black">{Number(item.proof.claimedViews || 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-black/40">Automated checks</dt>
                  <dd className="font-black">
                    {item.proof.automatedChecks.hashtagMatches === false ? "Needs attention" : "Passed / manual"}
                  </dd>
                </div>
              </dl>

              {rejecting === item.proof.id && (
                <div className="mt-5 rounded-2xl bg-red-50 p-4">
                  <label className="text-xs font-black text-red-900" htmlFor={`reason-${item.proof.id}`}>
                    Reason for rejection
                  </label>
                  <textarea
                    id={`reason-${item.proof.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain what the promoter needs to correct"
                    rows={3}
                    autoFocus
                    className="mt-2 w-full resize-none rounded-xl border border-red-200 bg-white p-3 text-sm outline-none focus:border-red-500"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setRejecting("");
                        setReason("");
                      }}
                      className="rounded-xl px-4 py-2 text-xs font-bold text-black/60"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={busy === item.proof.id}
                      onClick={() => decide(item.proof.id, "rejected")}
                      className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {busy === item.proof.id ? "Rejecting…" : "Reject proof"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {item.proof.submittedUrl && (
                  <a
                    href={item.proof.submittedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-black/10 px-3 text-xs font-bold"
                  >
                    Post <ExternalLink className="size-3" />
                  </a>
                )}
                {item.proof.storageKey && (
                  <button
                    onClick={() => evidence(item.proof.id)}
                    className="rounded-xl border border-black/10 px-3 text-xs font-bold"
                  >
                    Evidence
                  </button>
                )}
                {["submitted", "under_review"].includes(item.proof.status) && rejecting !== item.proof.id && (
                  <>
                    <button
                      disabled={busy === item.proof.id}
                      onClick={() => {
                        setRejecting(item.proof.id);
                        setReason("");
                      }}
                      className="ml-auto rounded-xl bg-red-50 px-3 text-xs font-bold text-red-700"
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy === item.proof.id}
                      onClick={() => decide(item.proof.id, "approved")}
                      className="rounded-xl bg-[#171811] px-4 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {busy === item.proof.id ? "Processing…" : "Approve & pay"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}

          {!items.length && (
            <p className="col-span-full rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/45">
              No proofs in this queue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
