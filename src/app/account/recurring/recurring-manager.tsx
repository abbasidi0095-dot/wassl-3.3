"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  Pause,
  Play,
  Plus,
  Repeat,
  SkipForward,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { RecurringOrder } from "@/lib/types";

type StoreOption = { id: string; name: string; category: string };
type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  image?: string;
  unit?: string;
  stock: number;
  category: string;
};

function defaultStart() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(9, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export function RecurringManager({
  stores,
  orders: initialOrders,
  defaultName,
  defaultPhone,
}: {
  stores: StoreOption[];
  orders: RecurringOrder[];
  defaultName: string;
  defaultPhone: string;
}) {
  const { t } = useI18n();
  const [orders, setOrders] = useState(initialOrders);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "custom">("weekly");
  const [intervalDays, setIntervalDays] = useState(14);
  const [startAt, setStartAt] = useState(defaultStart);
  const [address, setAddress] = useState({ name: defaultName, phone: defaultPhone, address: "", landmark: "", notes: "" });
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!storeId) return;
    let active = true;
    fetch(`/api/recurring-orders/catalog?storeId=${encodeURIComponent(storeId)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { products?: CatalogProduct[] } | null) => {
        if (active && data?.products) setProducts(data.products);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId]);

  const selected = useMemo(
    () => products.filter((product) => (quantities[product.id] ?? 0) > 0),
    [products, quantities],
  );
  const subtotal = selected.reduce(
    (sum, product) => sum + product.price * (quantities[product.id] ?? 0),
    0,
  );

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/recurring-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          title: title || "Recurring order",
          frequency,
          intervalDays,
          startAt: new Date(startAt).toISOString(),
          consent,
          address,
          items: selected.map((product) => ({
            productId: product.id,
            qty: quantities[product.id] ?? 1,
          })),
        }),
      });
      const data = (await response.json()) as { order?: RecurringOrder; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error || "Could not create schedule");
      setOrders((current) => [...current, data.order!]);
      setQuantities({});
      setTitle("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create schedule");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "pause" | "resume" | "skip" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/recurring-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { order?: RecurringOrder; error?: string };
      if (!response.ok || !data.order) throw new Error(data.error || "Could not update");
      setOrders((current) => current.map((order) => (order.id === id ? data.order! : order)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1080px]">
      <header className="figma-band p-6 lg:p-8">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
          <Repeat size={14} /> {t("Recurring orders")}
        </div>
        <h1 className="display mt-2 text-[clamp(2.2rem,1.5rem+2.4vw,3.4rem)]">
          {t("Your weekly shop, on a schedule.")}
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-6 text-muted">
          {t(
            "Daily, weekly, monthly or a custom interval. COD only. Automatic orders are created only when you explicitly give consent.",
          )}
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={create} className="card p-5">
          <h2 className="text-[15px] font-semibold">{t("New schedule")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">{t("Store")}</span>
              <select value={storeId} onChange={(event) => setStoreId(event.target.value)} className="input">
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("Title")}</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="input" placeholder={t("Weekly groceries")} />
            </label>
            <label className="block">
              <span className="label">{t("Frequency")}</span>
              <select value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)} className="input">
                <option value="daily">{t("Daily")}</option>
                <option value="weekly">{t("Weekly")}</option>
                <option value="monthly">{t("Monthly")}</option>
                <option value="custom">{t("Custom")}</option>
              </select>
            </label>
            {frequency === "custom" ? (
              <label className="block">
                <span className="label">{t("Every (days)")}</span>
                <input type="number" min={1} max={90} value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} className="input" />
              </label>
            ) : null}
            <label className="block">
              <span className="label">{t("First run")}</span>
              <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="input" />
            </label>
          </div>

          <h3 className="mt-4 text-[12px] font-semibold">{t("Products")}</h3>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pe-1">
            {products.slice(0, 60).map((product) => {
              const qty = quantities[product.id] ?? 0;
              return (
                <div key={product.id} className="flex items-center gap-2 rounded-[8px] border border-line bg-surface p-2">
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-[6px] bg-surface-2">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{product.name}</span>
                  <span className="text-[10px] text-muted">{product.price} MAD</span>
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => setQuantities({ ...quantities, [product.id]: Math.max(0, qty - 1) })} className="grid h-6 w-6 place-items-center rounded-full border border-line" aria-label={t("Remove")}>−</button>
                    <span className="w-4 text-center text-[11px] tnum">{qty}</span>
                    <button type="button" onClick={() => setQuantities({ ...quantities, [product.id]: Math.min(product.stock, qty + 1) })} className="grid h-6 w-6 place-items-center rounded-full border border-line" aria-label={t("Add")}>+</button>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block"><span className="label">{t("Name")}</span><input value={address.name} onChange={(event) => setAddress({ ...address, name: event.target.value })} className="input" required /></label>
            <label className="block"><span className="label">{t("Phone")}</span><input value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} className="input" required /></label>
            <label className="block sm:col-span-2"><span className="label">{t("Address")}</span><input value={address.address} onChange={(event) => setAddress({ ...address, address: event.target.value })} className="input" required /></label>
            <label className="block sm:col-span-2"><span className="label">{t("Landmark")}</span><input value={address.landmark} onChange={(event) => setAddress({ ...address, landmark: event.target.value })} className="input" required /></label>
          </div>

          <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
            {t("Create the COD order automatically when the schedule is due. Without consent, Wassl only reminds you.")}
          </label>

          {error ? <p className="mt-3 rounded-[4px] bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p> : null}
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || !selected.length}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t("Create schedule")} · {subtotal} MAD
          </button>
        </form>

        <section>
          <h2 className="text-[13px] font-semibold">{t("Your schedules")}</h2>
          <div className="mt-2 space-y-2">
            {orders.map((order) => (
              <article key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-semibold">{order.title}</h3>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {order.storeName} · {order.frequency} · {order.items.length} {t("items")}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                      <CalendarClock size={11} /> {t("Next")} {new Date(order.nextRunAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      {order.consent ? t("Automatic COD creation is on") : t("Reminder only")}
                      {order.lastError ? ` · ${order.lastError}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${order.status === "active" ? "border-success/40 text-success" : "border-line text-muted"}`}>
                    {order.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {order.status === "active" ? (
                    <>
                      <button type="button" onClick={() => act(order.id, "pause")} className="btn btn-ghost btn-sm" disabled={busy}><Pause size={11} /> {t("Pause")}</button>
                      <button type="button" onClick={() => act(order.id, "skip")} className="btn btn-ghost btn-sm" disabled={busy}><SkipForward size={11} /> {t("Skip next")}</button>
                    </>
                  ) : null}
                  {order.status === "paused" ? (
                    <button type="button" onClick={() => act(order.id, "resume")} className="btn btn-ghost btn-sm" disabled={busy}><Play size={11} /> {t("Resume")}</button>
                  ) : null}
                  {order.status !== "cancelled" ? (
                    <button type="button" onClick={() => act(order.id, "cancel")} className="btn btn-ghost btn-sm text-danger" disabled={busy}><Trash2 size={11} /> {t("Cancel")}</button>
                  ) : null}
                </div>
              </article>
            ))}
            {!orders.length ? (
              <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
                {t("No recurring orders yet.")}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
