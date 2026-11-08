"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  Lock,
  Minus,
  Plus,
  Unlock,
  Users,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { GroupOrderView } from "@/lib/db";

type ProductOption = {
  id: string;
  name: string;
  price: number;
  image?: string;
  unit?: string;
  available: boolean;
  stock: number;
  category: string;
};

export function GroupOrderRoom({
  order: initialOrder,
  currentUserId,
  products,
  storeName,
  customerName,
  initialToken,
}: {
  order: GroupOrderView;
  currentUserId: string;
  products: ProductOption[];
  storeName: string;
  customerName: string;
  initialToken: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [token, setToken] = useState(initialToken);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [checkout, setCheckout] = useState({
    phone: "",
    address: "",
    landmark: "",
    notes: "",
  });

  useEffect(() => {
    setToken(
      initialToken ||
        window.localStorage.getItem(`wassl_group_token_${order.code}`) ||
        "",
    );
    setOrigin(window.location.origin);
  }, [order.code, initialToken]);

  const participant = order.participants.find(
    (entry) => entry.userId === currentUserId,
  );
  const isOwner = order.ownerUserId === currentUserId;
  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of participant?.items ?? []) map.set(item.productId, item.qty);
    return map;
  }, [participant]);

  const inviteLink = token && origin ? `${origin}/group/${order.code}?token=${token}` : "";

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/group-orders/${order.code}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json()) as {
        order?: GroupOrderView;
        error?: string;
        orderId?: string;
      };
      if (!response.ok) throw new Error(data.error || "Something went wrong");
      if (data.order) setOrder(data.order);
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!token) {
      setError(t("Ask the owner for the invitation link."));
      return;
    }
    await call("/join", { token });
  }

  async function setQty(product: ProductOption, qty: number) {
    await call("/items", { productId: product.id, qty });
  }

  async function lock() {
    await call("/lock");
  }

  async function cancel() {
    await call("/cancel");
  }

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    const result = await call("/checkout", {
      customerName,
      customerPhone: checkout.phone,
      address: checkout.address,
      landmark: checkout.landmark,
      notes: checkout.notes,
      lat: 0,
      lng: 0,
    });
    if (result?.orderId) router.push(`/orders/${result.orderId}`);
  }

  async function copyInvite() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!participant && order.status === "open") {
    return (
      <div className="mx-auto max-w-xl">
        <div className="figma-band p-6 text-center">
          <Users size={26} className="mx-auto text-saffron" />
          <h1 className="display mt-3 text-4xl">{order.title}</h1>
          <p className="mt-2 text-[13px] text-muted">
            {storeName} · {order.ownerName}
          </p>
        </div>
        <div className="card mt-4 p-6 text-center">
          <p className="text-[14px] leading-6 text-muted">
            {t("You have been invited to add your items to this group order.")}
          </p>
          {error ? <p className="mt-3 text-[12px] text-danger">{error}</p> : null}
          <button type="button" onClick={join} className="btn btn-primary mt-5 w-full" disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
            {t("Join group order")}
          </button>
          <Link href="/group" className="mt-3 inline-block text-[12px] font-semibold text-muted">
            {t("Back to group orders")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/group" className="text-[12px] font-semibold text-muted hover:text-ink">
          ← {t("Group orders")}
        </Link>
        <span className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold">
          {order.code} · {order.status}
        </span>
      </div>

      <header className="figma-band mt-3 p-6 lg:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
              <Users size={14} /> {t("Group order")}
            </div>
            <h1 className="display mt-2 text-[clamp(2rem,1.4rem+2vw,3rem)]">
              {order.title}
            </h1>
            <p className="mt-2 text-[13px] text-muted">
              {storeName} · {order.participants.length} {t("people")} ·{" "}
              {order.itemCount} {t("items")} · {order.subtotal} MAD
            </p>
          </div>
          <div className="text-[12px] text-muted">
            {t("Deadline")}: {new Date(order.deadline).toLocaleString()}
          </div>
        </div>
      </header>

      {inviteLink ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-surface p-3">
          <Link2 size={15} className="text-muted" />
          <input
            readOnly
            value={inviteLink}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-muted outline-none"
            aria-label={t("Invitation link")}
          />
          <button type="button" onClick={copyInvite} className="btn btn-ghost btn-sm">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t("Copied") : t("Copy link")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-[8px] bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <section>
          <h2 className="font-display text-[22px] font-semibold">{t("Add your items")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {products.map((product) => {
              const qty = quantities.get(product.id) ?? 0;
              const disabled =
                order.status !== "open" || busy || !product.available || product.stock <= 0;
              return (
                <article
                  key={product.id}
                  className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-2.5"
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-surface-2">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {product.name}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {product.price} MAD {product.unit ? `· ${product.unit}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(product, qty - 1)}
                      disabled={disabled || qty <= 0}
                      className="grid h-8 w-8 place-items-center rounded-full border border-line disabled:opacity-40"
                      aria-label={`${t("Remove")} ${product.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-[12px] font-semibold tnum">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(product, qty + 1)}
                      disabled={disabled || qty >= product.stock}
                      className="grid h-8 w-8 place-items-center rounded-full border border-line disabled:opacity-40"
                      aria-label={`${t("Add")} ${product.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card p-4">
            <h2 className="text-[13px] font-semibold">{t("Participants")}</h2>
            <div className="mt-2 space-y-2">
              {order.participants.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate">
                    {entry.name}
                    {entry.userId === order.ownerUserId ? (
                      <span className="ms-1 text-[10px] text-muted">({t("Owner")})</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-semibold tnum">{entry.subtotal} MAD</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[13px] font-semibold">
              <span>{t("Total")}</span>
              <span className="tnum">{order.subtotal} MAD</span>
            </div>
          </div>

          {isOwner && order.status === "open" ? (
            <button type="button" onClick={lock} className="btn btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {t("Lock group order")}
            </button>
          ) : null}

          {isOwner && order.status === "locked" ? (
            <form onSubmit={placeOrder} className="card p-4">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <Unlock size={14} /> {t("Checkout")}
              </h2>
              <p className="mt-1 text-[11px] text-muted">
                {t("One cash-on-delivery order from this store.")}
              </p>
              <label className="mt-3 block">
                <span className="label">{t("Phone")}</span>
                <input
                  value={checkout.phone}
                  onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })}
                  className="input"
                  required
                />
              </label>
              <label className="mt-2 block">
                <span className="label">{t("Address")}</span>
                <input
                  value={checkout.address}
                  onChange={(event) => setCheckout({ ...checkout, address: event.target.value })}
                  className="input"
                  required
                />
              </label>
              <label className="mt-2 block">
                <span className="label">{t("Landmark")}</span>
                <input
                  value={checkout.landmark}
                  onChange={(event) => setCheckout({ ...checkout, landmark: event.target.value })}
                  className="input"
                  required
                />
              </label>
              <label className="mt-2 block">
                <span className="label">{t("Notes")}</span>
                <input
                  value={checkout.notes}
                  onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })}
                  className="input"
                />
              </label>
              <button type="submit" className="btn btn-primary mt-3 w-full" disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                {t("Place COD order")} · {order.subtotal} MAD
              </button>
            </form>
          ) : null}

          {isOwner && order.status !== "placed" && order.status !== "cancelled" ? (
            <button type="button" onClick={cancel} className="btn btn-ghost w-full" disabled={busy}>
              {t("Cancel group order")}
            </button>
          ) : null}

          {order.status === "placed" && order.placedOrderId ? (
            <Link href={`/orders/${order.placedOrderId}`} className="btn btn-primary w-full">
              {t("Track order")}
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
