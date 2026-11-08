"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  Copy,
  Loader2,
  Plus,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { SavedBasketView } from "@/lib/db";

const STORAGE_KEY = "wassl_basket_v1";

export function SavedBaskets({
  baskets: initial,
  familyBaskets,
  shared,
}: {
  baskets: SavedBasketView[];
  familyBaskets: SavedBasketView[];
  shared: SavedBasketView | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [baskets, setBaskets] = useState(initial);
  const [lines, setLines] = useState<unknown[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      setLines(Array.isArray(raw) ? raw : []);
    } catch {
      setLines([]);
    }
  }, []);

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
        basket?: SavedBasketView;
        baskets?: SavedBasketView[];
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const data = await call("/api/saved-baskets", { name: name || "Saved basket", items: lines });
    if (data?.basket) {
      setBaskets((current) => [data.basket!, ...current]);
      setName("");
    }
  }

  function useBasket(basket: SavedBasketView) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket.items));
    router.push("/grocery/basket");
  }

  async function duplicate(basket: SavedBasketView) {
    const data = await call(`/api/saved-baskets/${basket.id}`, { action: "duplicate" });
    if (data?.basket) setBaskets((current) => [data.basket!, ...current]);
  }

  async function share(basket: SavedBasketView) {
    const data = await call(`/api/saved-baskets/${basket.id}`, { action: "share" });
    if (data?.token) {
      setShareUrl(`${window.location.origin}/grocery/basket/saved?share=${data.token}`);
    }
  }

  async function remove(basket: SavedBasketView) {
    await call(`/api/saved-baskets/${basket.id}`, undefined, "DELETE");
    setBaskets((current) => current.filter((entry) => entry.id !== basket.id));
  }

  async function remind(basket: SavedBasketView, remindAt: string) {
    const data = await call(`/api/saved-baskets/${basket.id}`, {
      action: "remind",
      remindAt: remindAt || undefined,
    });
    if (data?.basket) {
      setBaskets((current) =>
        current.map((entry) => (entry.id === basket.id ? data.basket! : entry)),
      );
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <header className="figma-band p-6 lg:p-8">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
          <ShoppingBasket size={14} /> {t("Saved baskets")}
        </div>
        <h1 className="display mt-2 text-[clamp(2.2rem,1.5rem+2.4vw,3.4rem)]">
          {t("Build it once. Shop it again.")}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted">
          {t(
            "Save the basket on this device, duplicate it, share a secure link, or set a reminder. Prices are checked again when you shop.",
          )}
        </p>
      </header>

      {shared ? (
        <section className="card mt-5 p-5">
          <h2 className="text-[14px] font-semibold">{shared.name}</h2>
          <p className="mt-1 text-[11px] text-muted">
            {shared.itemCount} {t("items")} · {shared.storeCount} {t("stores")} ·{" "}
            {shared.subtotal} MAD
          </p>
          <div className="mt-3 divide-y divide-line">
            {shared.items.slice(0, 12).map((item) => (
              <div key={`${item.storeId}-${item.productId}`} className="flex items-center justify-between gap-2 py-2 text-[12px]">
                <span className="truncate">{item.name} × {item.qty}</span>
                <span className="shrink-0 text-muted">{item.price * item.qty} MAD</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => useBasket(shared)} className="btn btn-primary mt-4 w-full">
            {t("Use this basket")}
          </button>
        </section>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <form onSubmit={save} className="card p-5">
          <h2 className="text-[14px] font-semibold">{t("Save current basket")}</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            {lines.length} {t("items")} {t("in your current basket.")}
          </p>
          <label className="mt-3 block">
            <span className="label">{t("Basket name")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="input" placeholder={t("Weekly basics")} maxLength={60} />
          </label>
          <button type="submit" className="btn btn-primary mt-3 w-full" disabled={busy || !lines.length}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t("Save basket")}
          </button>
          <Link href="/grocery/basket" className="mt-3 block text-center text-[12px] font-semibold text-muted">
            {t("Back to basket")}
          </Link>
        </form>

        <section>
          <h2 className="text-[13px] font-semibold">{t("Your saved baskets")}</h2>
          {shareUrl ? (
            <div className="mt-2 flex gap-1.5 rounded-[10px] border border-line bg-surface p-2">
              <input readOnly value={shareUrl} className="min-w-0 flex-1 bg-transparent text-[10px] text-muted outline-none" aria-label={t("Share link")} />
              <button type="button" onClick={copyShare} className="btn btn-ghost btn-sm">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          ) : null}
          <div className="mt-2 space-y-2">
            {baskets.map((basket) => (
              <article key={basket.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-semibold">{basket.name}</h3>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {basket.itemCount} {t("items")} · {basket.storeCount} {t("stores")} · {basket.subtotal} MAD
                    </p>
                    {basket.remindAt ? (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted">
                        <Bell size={10} /> {t("Reminder")} {new Date(basket.remindAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => remove(basket)} className="grid h-8 w-8 place-items-center rounded-[6px] text-muted hover:bg-danger-soft hover:text-danger" aria-label={t("Delete")}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => useBasket(basket)} className="btn btn-primary btn-sm">{t("Use basket")}</button>
                  <button type="button" onClick={() => duplicate(basket)} className="btn btn-ghost btn-sm">{t("Duplicate")}</button>
                  <button type="button" onClick={() => share(basket)} className="btn btn-ghost btn-sm">{t("Share")}</button>
                  <label className="inline-flex items-center gap-1 text-[10px] text-muted">
                    <Bell size={11} />
                    <input type="datetime-local" onChange={(event) => remind(basket, event.target.value ? new Date(event.target.value).toISOString() : "")} className="h-8 rounded-[6px] border border-line bg-surface px-1.5 text-[10px]" aria-label={t("Reminder")} />
                  </label>
                </div>
              </article>
            ))}
            {!baskets.length ? (
              <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
                {t("No saved baskets yet.")}
              </div>
            ) : null}
          </div>

          {familyBaskets.length ? (
            <div className="mt-6">
              <h2 className="text-[13px] font-semibold">{t("Family baskets")}</h2>
              <div className="mt-2 space-y-2">
                {familyBaskets.map((basket) => (
                  <article key={`family-${basket.id}`} className="card p-4">
                    <h3 className="truncate text-[13px] font-semibold">{basket.name}</h3>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {basket.itemCount} {t("items")} · {basket.storeCount} {t("stores")} · {basket.subtotal} MAD
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => useBasket(basket)} className="btn btn-ghost btn-sm">{t("Use basket")}</button>
                      <button type="button" onClick={() => duplicate(basket)} className="btn btn-ghost btn-sm">{t("Copy to my baskets")}</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {error ? <p className="mt-3 rounded-[4px] bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
