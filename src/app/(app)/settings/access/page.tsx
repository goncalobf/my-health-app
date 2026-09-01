"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil, ShieldCheck, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

interface Account { email: string; name: string | null; username: string | null; role: string; status: string; }
interface Member { email: string; name: string | null; role: string; status: string; id: number; joinedAt: string | null; }

const DELETE_CONFIRMATION = "DELETE";

export default function AccountAccessPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    const current = await apiGet<Account>("/api/account");
    setAccount(current);
    setUsernameInput(current.username ?? "");
    if (current.role === "owner") setMembers(await apiGet<Member[]>("/api/accounts"));
  }

  useEffect(() => { load(); }, []);

  async function saveUsername() {
    setSavingUsername(true);
    setUsernameError("");
    try {
      await apiPatch("/api/account", { username: usernameInput.trim().toLowerCase() });
      setEditingUsername(false);
      await load();
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Could not save username.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function setAccess(member: Member, status: "active" | "revoked") {
    await apiPatch("/api/accounts", { id: member.id, status });
    await load();
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/auth/sign-up`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError("");
    try {
      await apiDelete("/api/account");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete account.");
      setDeleting(false);
      return;
    }
    // The account is already gone server-side at this point, so a sign-out
    // hiccup is best-effort cleanup, not a reason to report "delete failed".
    await authClient.signOut().catch(() => {});
    router.replace("/auth/sign-in");
    router.refresh();
  }

  if (!account) return <p className="text-sm text-muted">Loading account…</p>;

  return (
    <div>
      <PageHeader title="Account & access" back="/settings" />
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><ShieldCheck size={20} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{account.name || "Fitlog account"}</p>
            <p className="break-all text-xs text-muted">{account.email}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-accent">{account.role}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-border pt-3">
          {editingUsername ? (
            <>
              <p className="mb-1.5 text-xs text-muted">Your friends look you up by this username.</p>
              <div className="flex gap-2">
                <input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="input min-w-0 flex-1"
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <button onClick={saveUsername} disabled={savingUsername || !usernameInput.trim()} className="btn-primary shrink-0 px-3">Save</button>
                <button onClick={() => { setEditingUsername(false); setUsernameInput(account.username ?? ""); setUsernameError(""); }} className="btn-ghost shrink-0 px-3">Cancel</button>
              </div>
              {usernameError && <p className="mt-1.5 text-xs text-danger">{usernameError}</p>}
            </>
          ) : (
            <button onClick={() => setEditingUsername(true)} className="flex items-center gap-1.5 text-sm text-muted">
              @{account.username ?? "add a username"} <Pencil size={13} />
            </button>
          )}
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

      <h2 className="mb-2 mt-6 text-sm font-semibold text-danger">Danger zone</h2>
      <div className="card border-danger/30 p-4">
        {!confirmingDelete ? (
          <>
            <p className="text-sm text-muted">Permanently delete your account and every workout, nutrition log, measurement, photo, and coach conversation tied to it. This cannot be undone.</p>
            <button type="button" onClick={() => setConfirmingDelete(true)} className="btn-danger mt-3">Delete account</button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              {account.role === "owner"
                ? "You're the app owner: deleting your account also removes the only account able to manage other members. This cannot be undone."
                : "This permanently deletes your account and every record tied to it. This cannot be undone."}
            </p>
            <p className="mt-3 text-xs text-muted">Type <strong className="text-text">{DELETE_CONFIRMATION}</strong> to confirm.</p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input mt-2"
              placeholder={DELETE_CONFIRMATION}
              autoCapitalize="characters"
              aria-label={`Type ${DELETE_CONFIRMATION} to confirm account deletion`}
            />
            {deleteError && <p className="mt-2 text-xs text-danger">{deleteError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { setConfirmingDelete(false); setDeleteConfirmText(""); setDeleteError(""); }}
                className="btn-ghost flex-1"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleteConfirmText !== DELETE_CONFIRMATION || deleting}
                className="btn-danger flex-1"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
