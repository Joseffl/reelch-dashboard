"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "@/components/toasts";

type Member = { userId: string; email: string; displayName: string; isActive: boolean; isSuperAdmin: boolean; createdAt: string };
type Invitation = { id: string; email: string; expiresAt: string; createdAt: string };

export function Administrators() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const [data, setData] = useState<{ members: Member[]; invitations: Invitation[] } | null>(null);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`${apiUrl}/admin/administrators`, { credentials: "include" });
    if (response.status === 403) throw new Error("Only a super administrator can manage administrator access.");
    if (!response.ok) throw new Error("Unable to load administrators.");
    return await response.json() as { members: Member[]; invitations: Invitation[] };
  }, [apiUrl]);

  useEffect(() => {
    let active = true;
    load().then(value => { if (active) setData(value); }).catch((error: Error) => { if (active) toast.error(error); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => {
    if (!inviteOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setInviteOpen(false); };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = ""; };
  }, [busy, inviteOpen]);

  function openInvite() {
    setEmail(""); setInviteUrl(""); setInviteOpen(true);
  }

  function closeInvite() {
    if (busy) return;
    setInviteOpen(false); setEmail(""); setInviteUrl("");
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setInviteUrl("");
    try {
    const response = await fetch(`${apiUrl}/admin/administrators/invitations`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? "Unable to create invitation.");
    setInviteUrl(body.inviteUrl); setEmail(""); toast.success("Invitation created. Copy and share the secure link.");
    setData(await load());
    } catch (error) { toast.error(error); }
    finally { setBusy(false); }
  }

  async function copyInvite() {
    try {
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invitation link copied.");
    } catch { toast.error("Could not copy the invitation link. Please select and copy it manually."); }
  }

  async function revoke(id: string) {
    try {
    const response = await fetch(`${apiUrl}/admin/administrators/invitations/${id}/revoke`, { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error("Unable to revoke this invitation.");
    setData(await load());
    } catch (error) { toast.error(error); }
  }

  async function toggle(member: Member) {
    try {
    const response = await fetch(`${apiUrl}/admin/administrators/${member.userId}/status`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !member.isActive }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message ?? "Unable to update administrator.");
    setData(await load());
    } catch (error) { toast.error(error); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-black/8 bg-white p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-2xl font-black tracking-[-0.03em]">Current administrators</h2><p className="mt-1 text-sm text-black/45">Manage who can access Reelch operations.</p></div>
          <button type="button" onClick={openInvite} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#171811] px-5 text-sm font-bold text-white transition hover:bg-[#6558ff]"><UserPlus className="size-4" /> Invite admin</button>
        </div>

        <div className="mt-5 divide-y divide-black/8">
          {data?.members.map((member) => <div key={member.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <span className="grid size-11 place-items-center rounded-full bg-[#eeeaff] text-[#6558ff]"><ShieldCheck className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-bold">{member.displayName}</p><p className="truncate text-sm text-black/50">{member.email}</p></div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${member.isSuperAdmin ? "bg-[#e9ffd9] text-[#315d13]" : "bg-[#eeeaff] text-[#5145d8]"}`}>{member.isSuperAdmin ? "Super administrator" : "Administrator"}</span>
            {!member.isSuperAdmin && <button onClick={() => toggle(member)} className="rounded-full border border-black/12 px-4 py-2 text-xs font-bold hover:bg-black/5">{member.isActive ? "Suspend" : "Reactivate"}</button>}
          </div>)}
          {!data && <p className="py-8 text-sm text-black/45">Loading administrators…</p>}
        </div>
      </section>

      {!!data?.invitations.length && <section className="rounded-[2rem] border border-black/8 bg-white p-6 lg:p-8"><h2 className="text-2xl font-black tracking-[-0.03em]">Pending invitations</h2><div className="mt-5 divide-y divide-black/8">{data.invitations.map((invitation) => <div key={invitation.id} className="flex items-center gap-3 py-4"><span className="grid size-9 place-items-center rounded-full bg-amber-100 text-amber-700"><Check className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate font-bold">{invitation.email}</p><p className="text-xs text-black/45">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><button onClick={() => revoke(invitation.id)} className="grid size-10 place-items-center rounded-full border border-black/10 hover:bg-black/5" aria-label={`Revoke invitation for ${invitation.email}`}><X className="size-4" /></button></div>)}</div></section>}

      {inviteOpen && <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="invite-admin-title">
        <button type="button" aria-label="Close invite administrator dialog" onClick={closeInvite} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <section className="relative w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-[0_30px_100px_rgba(0,0,0,.35)] sm:p-8">
          <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#9cff57]"><UserPlus className="size-5" /></span><div className="min-w-0 flex-1"><h2 id="invite-admin-title" className="text-2xl font-black tracking-[-0.035em]">Invite admin</h2><p className="mt-1 text-sm leading-6 text-black/48">The secure invitation link expires after seven days.</p></div><button type="button" onClick={closeInvite} disabled={busy} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-black/45 hover:bg-black/5 hover:text-black disabled:opacity-40"><X className="size-4" /></button></div>
          <form onSubmit={invite} className="mt-7">
            <label className="text-sm font-bold" htmlFor="administrator-email">Email address</label>
            <input id="administrator-email" autoFocus type="email" required disabled={busy || Boolean(inviteUrl)} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@reelch.com" className="mt-2 h-14 w-full rounded-xl border border-black/12 px-4 font-semibold outline-none focus:border-[#6558ff] disabled:bg-black/[.035]" />
            {!inviteUrl && <button disabled={busy} className="mt-4 flex h-13 w-full items-center justify-center rounded-xl bg-[#171811] font-black text-white transition hover:bg-[#6558ff] disabled:opacity-50">{busy ? "Creating invitation…" : "Create invitation"}</button>}
          </form>
          {inviteUrl && <div className="mt-5 rounded-2xl bg-[#f3f1ea] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/40">Invitation link</p><div className="mt-2 flex gap-2"><input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-xl border border-black/8 bg-white px-3 text-xs text-black/60" /><button type="button" onClick={copyInvite} className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#171811] text-white" aria-label="Copy invitation link"><Copy className="size-4" /></button></div></div>}

        </section>
      </div>}
    </div>
  );
}
