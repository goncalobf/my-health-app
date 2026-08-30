"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPatch } from "@/lib/api";

interface Account { email: string; name: string | null; role: string; status: string; }
interface Member extends Account { id: number; joinedAt: string | null; }

export default function FriendsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);

  async function load() {
    const current = await apiGet<Account>("/api/account");
    setAccount(current);
    if (current.role === "owner") setMembers(await apiGet<Member[]>("/api/accounts"));
  }

  useEffect(() => { load(); }, []);

  async function setAccess(member: Member, status: "active" | "revoked") {
    await apiPatch("/api/accounts", { id: member.id, status });
    await load();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/auth/sign-up`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!account) return <p className="text-sm text-muted">Loading account…</p>;

  return (
    <div>
      <PageHeader title="Account & access" back="/settings" />
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><ShieldCheck size={20} /></div>
          <div className="min-w-0"><p className="font-semibold">{account.name || "Fitlog account"}</p><p className="break-all text-xs text-muted">{account.email}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-accent">{account.role}</p></div>
        </div>
      </section>

      {account.role === "owner" ? (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">Share Fitlog</h2>
          <div className="card flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <div className="icon-frame"><Users size={19} /></div>
              <p className="text-xs leading-relaxed text-muted">Anyone can create an account. Every person gets separate workouts, nutrition, body data and coach history.</p>
            </div>
            <button type="button" onClick={copyLink} className="btn-ghost">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Copied" : "Copy sign-up link"}</button>
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">Registered accounts</h2>
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <div key={member.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name || member.email}</p>{member.name && <p className="truncate text-xs text-muted">{member.email}</p>}<p className={`mt-1 text-[10px] uppercase ${member.status === "active" ? "text-accent" : member.status === "revoked" ? "text-danger" : "text-warn"}`}>{member.status}</p></div>
                {member.role !== "owner" && (member.status === "revoked" ? <button onClick={() => setAccess(member, "active")} className="btn-ghost px-3 py-2 text-xs">Restore</button> : <button onClick={() => setAccess(member, "revoked")} className="btn-ghost px-3 py-2 text-xs text-danger">Disable</button>)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="card mt-5 p-4 text-sm text-muted">Your account and all associated health data are private. Other Fitlog users cannot see your records.</p>
      )}
    </div>
  );
}
