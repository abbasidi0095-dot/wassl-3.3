"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus, Users } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { GroupOrderView } from "@/lib/db";

type StoreOption = { id: string; name: string; category: string };

function defaultDeadline() {
  const date = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export function GroupOrderHub({
  stores,
  orders,
}: {
  stores: StoreOption[];
  orders: GroupOrderView[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!storeId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/group-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          title: title || "Group order",
          deadline: new Date(deadline).toISOString(),
        }),
      });
      const data = (await response.json()) as {
        order?: GroupOrderView;
        token?: string;
        error?: string;
      };
      if (!response.ok || !data.order || !data.token) {
        throw new Error(data.error || "Could not create the group order");
      }
      window.localStorage.setItem(`wassl_group_token_${data.order.code}`, data.token);
      router.push(`/group/${data.order.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the group order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <header className="figma-band p-6 lg:p-8">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
          <Users size={14} /> {t("Group orders")}
        </div>
        <h1 className="display mt-2 text-[clamp(2.2rem,1.5rem+2.4vw,3.4rem)]">
          {t("Order together, pay once.")}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted">
          {t(
            "Create a shared cart, invite family or friends, set a deadline, then lock and check out as one cash-on-delivery order from a single store.",
          )}
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={create} className="card p-5">
          <h2 className="text-[15px] font-semibold">{t("Start a group order")}</h2>
          <label className="mt-4 block">
            <span className="label">{t("Store")}</span>
            <select
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              className="input"
              required
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="label">{t("Title")}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input"
              placeholder={t("Friday dinner")}
              maxLength={80}
            />
          </label>
          <label className="mt-3 block">
            <span className="label">{t("Deadline")}</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="input"
              required
            />
          </label>
          {error ? (
            <p className="mt-3 rounded-[4px] bg-danger-soft px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || !stores.length}>
            <Plus size={15} /> {busy ? t("Creating…") : t("Create group order")}
          </button>
        </form>

        <section>
          <h2 className="text-[13px] font-semibold">{t("Your group orders")}</h2>
          <div className="mt-2 space-y-2">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/group/${order.code}`}
                className="card flex items-center gap-3 p-4 transition-colors hover:border-line-strong"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-brand-soft text-brand">
                  <Users size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {order.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {order.storeName} · {order.participants.length} {t("people")} ·{" "}
                    {order.itemCount} {t("items")} · {order.status}
                  </span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-muted" />
              </Link>
            ))}
            {!orders.length ? (
              <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
                {t("No group orders yet.")}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
