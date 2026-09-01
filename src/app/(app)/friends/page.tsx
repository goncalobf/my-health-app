"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, UserPlus, Users, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

interface FriendSummary { id: number; username: string | null; name: string | null; friendshipId: number; }
interface FriendsResponse { friends: FriendSummary[]; incoming: FriendSummary[]; outgoing: FriendSummary[]; }

export default function FriendsPage() {
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setData(await apiGet<FriendsResponse>("/api/friends"));
  }
  useEffect(() => { load(); }, []);

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    const value = username.trim().toLowerCase();
    if (!value) return;
    setSending(true);
    setError("");
    try {
      await apiPost("/api/friends", { username: value });
      setUsername("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request.");
    } finally {
      setSending(false);
    }
  }

  async function respond(friendshipId: number, action: "accept" | "decline") {
    await apiPatch(`/api/friends/${friendshipId}`, { action });
    await load();
  }

  async function remove(friendshipId: number) {
    await apiDelete(`/api/friends/${friendshipId}`);
    await load();
  }

  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader title="Friends" back="/settings" />

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2"><UserPlus size={18} className="text-accent" /><p className="font-semibold">Add a friend</p></div>
        <form onSubmit={sendRequest} className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="input min-w-0 flex-1"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="btn-primary shrink-0 px-4" disabled={sending || !username.trim()}>Request</button>
        </form>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>

      {data.incoming.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">Requests</h2>
          <div className="flex flex-col gap-2">
            {data.incoming.map((req) => (
              <div key={req.friendshipId} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{req.name || req.username}</p><p className="truncate text-xs text-muted">@{req.username}</p></div>
                <button onClick={() => respond(req.friendshipId, "accept")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent" aria-label="Accept"><Check size={17} /></button>
                <button onClick={() => respond(req.friendshipId, "decline")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger" aria-label="Decline"><X size={17} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.outgoing.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">Sent</h2>
          <div className="flex flex-col gap-2">
            {data.outgoing.map((req) => (
              <div key={req.friendshipId} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{req.name || req.username}</p><p className="truncate text-xs text-muted">@{req.username} · pending</p></div>
                <button onClick={() => remove(req.friendshipId)} className="btn-ghost px-3 py-2 text-xs">Cancel</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-muted">Your friends</h2>
        {data.friends.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-6 text-center">
            <Users className="text-muted" size={28} />
            <p className="text-sm text-muted">No friends yet. Add someone by their username above.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.friends.map((friend) => (
              <Link key={friend.friendshipId} href={`/friends/${friend.friendshipId}`} className="card flex items-center gap-3 p-4 active:scale-[0.98] transition">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{friend.name || friend.username}</p><p className="truncate text-xs text-muted">@{friend.username}</p></div>
                <ChevronRight className="shrink-0 text-muted" size={20} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
