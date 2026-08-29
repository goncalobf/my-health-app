"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck, UserPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

interface Account { email: string; name: string | null; role: string; status: string; }
interface Member extends Account { id: number; joinedAt: string | null; }

export default function FriendsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const current = await apiGet<Account>("/api/account");
    setAccount(current);
    if (current.role === "owner") setMembers(await apiGet<Member[]>("/api/invitations"));
  }

  useEffect(() => { load(); }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiPost("/api/invitations", { email });
      setEmail("");
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not add this email.");
    }
  }

  async function setAccess(member: Member, status: "invited" | "revoked") {
    await apiPatch("/api/invitations", { id: member.id, status });
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
      <PageHeader title="Accounts & friends" back="/settings" />
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><ShieldCheck size={20} /></div>
          <div className="min-w-0"><p className="font-semibold">{account.name || "Fitlog account"}</p><p className="break-all text-xs text-muted">{account.email}</p><p className="mt-1 text-[11px] uppercase tracking-wide text-accent">{account.role}</p></div>
        </div>
      </section>

      {account.role === "owner" ? (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">Invite a friend</h2>
          <form onSubmit={invite} className="card flex flex-col gap-3 p-4">
            <p className="text-xs leading-relaxed text-muted">Add their exact email first. Then send them the registration link so their health data is attached only to their account.</p>
            <input type="email" inputMode="email" autoCapitalize="none" className="input" placeholder="friend@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn-primary"><UserPlus size={18} /> Add invitation</button>
            <button type="button" onClick={copyLink} className="btn-ghost">{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Copied" : "Copy registration link"}</button>
          </form>

          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">People with access</h2>
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <div key={member.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{member.name || member.email}</p>{member.name && <p className="truncate text-xs text-muted">{member.email}</p>}<p className={`mt-1 text-[10px] uppercase ${member.status === "active" ? "text-accent" : member.status === "revoked" ? "text-danger" : "text-warn"}`}>{member.status}</p></div>
                {member.role !== "owner" && (member.status === "revoked" ? <button onClick={() => setAccess(member, "invited")} className="btn-ghost px-3 py-2 text-xs">Restore</button> : <button onClick={() => setAccess(member, "revoked")} className="btn-ghost px-3 py-2 text-xs text-danger">Revoke</button>)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="card mt-5 p-4 text-sm text-muted">Your account and all associated health data are private. Only the Fitlog owner can manage invitations.</p>
      )}
    </div>
  );
}
