"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, LogOut, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { FamilyView } from "@/lib/db";
import type { FamilyRole } from "@/lib/types";

const ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "Owner",
  adult: "Adult",
  restricted: "Restricted",
};

export function FamilyManager({
  family: initialFamily,
  currentUserId,
  initialToken,
}: {
  family: FamilyView | null;
  currentUserId: string;
  initialToken: string;
}) {
  const { t } = useI18n();
  const [family, setFamily] = useState(initialFamily);
  const [name, setName] = useState("My family");
  const [token, setToken] = useState(initialToken);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (family) setInviteUrl("");
  }, [family]);

  async function call(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json()) as {
        family?: FamilyView;
        token?: string;
        error?: string;
        ok?: boolean;
      };
      if (!response.ok) throw new Error(data.error || "Something went wrong");
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const data = await call("/api/family", { name });
    if (!data?.family) return;
    setFamily(data.family);
    const link = data.token
      ? `${window.location.origin}/account/family?token=${data.token}`
      : "";
    setInviteUrl(link);
    setToken(data.token ?? "");
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    const data = await call("/api/family/join", { token });
    if (data?.family) setFamily(data.family);
  }

  async function generateInvite() {
    const data = await call("/api/family/invite");
    if (!data?.token) return;
    setToken(data.token);
    setInviteUrl(`${window.location.origin}/account/family?token=${data.token}`);
  }

  async function setRole(memberId: string, role: "adult" | "restricted") {
    const data = await call(`/api/family/members/${memberId}`, { role }, "PATCH");
    if (data?.family) setFamily(data.family);
  }

  async function remove(memberId: string) {
    const data = await call(`/api/family/members/${memberId}`, undefined, "DELETE");
    if (data?.family) setFamily(data.family);
  }

  async function leave() {
    const data = await call("/api/family/leave");
    if (data?.ok) setFamily(null);
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!family) {
    return (
      <div className="mx-auto max-w-xl">
        <header className="figma-band p-6">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
            <Users size={14} /> {t("Wassl Family")}
          </div>
          <h1 className="display mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)]">
            {t("One household, one shared shop.")}
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            {t("Share addresses, favourites, lists and baskets with the people you live with.")}
          </p>
        </header>

        <form onSubmit={create} className="card mt-4 p-5">
          <h2 className="text-[14px] font-semibold">{t("Create a family")}</h2>
          <label className="mt-3 block">
            <span className="label">{t("Family name")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="input" maxLength={60} />
          </label>
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {t("Create family")}
          </button>
        </form>

        <form onSubmit={join} className="card mt-3 p-5">
          <h2 className="text-[14px] font-semibold">{t("Join a family")}</h2>
          <label className="mt-3 block">
            <span className="label">{t("Invitation token")}</span>
            <input value={token} onChange={(event) => setToken(event.target.value)} className="input" placeholder={t("Paste the invitation link token")} />
          </label>
          <button type="submit" className="btn btn-ghost mt-4 w-full" disabled={busy || !token}>
            {t("Join family")}
          </button>
        </form>
        {error ? <p className="mt-3 rounded-[4px] bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p> : null}
      </div>
    );
  }

  const isOwner = family.ownerUserId === currentUserId;

  return (
    <div className="mx-auto max-w-[920px]">
      <header className="figma-band p-6 lg:p-8">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
          <Users size={14} /> {t("Wassl Family")}
        </div>
        <h1 className="display mt-2 text-[clamp(2rem,1.5rem+2vw,3rem)]">{family.name}</h1>
        <p className="mt-2 text-[13px] text-muted">
          {family.members.length} {t("members")} · {isOwner ? t("You are the owner") : t("Member")}
        </p>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <section className="card p-4">
          <h2 className="text-[13px] font-semibold">{t("Members")}</h2>
          <div className="mt-2 divide-y divide-line">
            {family.members.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {member.name}
                    {member.userId === currentUserId ? (
                      <span className="ms-1 text-[10px] text-muted">({t("You")})</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                    <Shield size={10} /> {t(ROLE_LABELS[member.role])}
                  </span>
                </span>
                {isOwner && member.role !== "owner" ? (
                  <span className="flex items-center gap-1.5">
                    <select
                      value={member.role}
                      onChange={(event) => setRole(member.id, event.target.value as "adult" | "restricted")}
                      className="h-8 rounded-[6px] border border-line bg-surface px-2 text-[11px]"
                      aria-label={t("Role")}
                    >
                      <option value="adult">{t("Adult")}</option>
                      <option value="restricted">{t("Restricted")}</option>
                    </select>
                    <button type="button" onClick={() => remove(member.id)} className="grid h-8 w-8 place-items-center rounded-[6px] text-muted hover:bg-danger-soft hover:text-danger" aria-label={t("Remove member")}>
                      <Trash2 size={13} />
                    </button>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-3">
          {isOwner ? (
            <div className="card p-4">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <Link2 size={14} /> {t("Invite")}
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                {t("Invitation tokens are secret and can be regenerated at any time.")}
              </p>
              {inviteUrl ? (
                <div className="mt-2 flex gap-1.5">
                  <input readOnly value={inviteUrl} className="input text-[10px]" aria-label={t("Invitation link")} />
                  <button type="button" onClick={copyInvite} className="btn btn-ghost btn-sm shrink-0">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              ) : null}
              <button type="button" onClick={generateInvite} className="btn btn-primary mt-2 w-full" disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {inviteUrl ? t("Regenerate invite") : t("Generate invite")}
              </button>
            </div>
          ) : (
            <button type="button" onClick={leave} className="btn btn-ghost w-full" disabled={busy}>
              <LogOut size={14} /> {t("Leave family")}
            </button>
          )}
          {error ? <p className="rounded-[4px] bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}
