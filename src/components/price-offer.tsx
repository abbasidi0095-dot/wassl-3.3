"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Loader2, Route, Sparkles } from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { PriceSnapshot } from "@/lib/types";

/**
 * The bidding card used on both sides of a delivery or a taxi ride.
 * Customers raise the offer; couriers either accept it elsewhere or counter here.
 *
 * Layout: stacked on phones, two columns from `sm` so the card still reads as a
 * card inside the wide desktop tracking pages instead of stretching its controls.
 */
export function PriceOffer({
  price,
  mode,
  endpoint,
  step = 5,
  max,
  disabled = false,
  onUpdated,
  compact = false,
}: {
  price: PriceSnapshot;
  mode: "customer" | "driver";
  endpoint: string;
  step?: number;
  max?: number;
  disabled?: boolean;
  onUpdated?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState("");
  const [raise, setRaise] = useState(step);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const ceiling = Math.max(price.current, max ?? price.current);
  const next = Math.min(ceiling, price.current + raise);
  const billable = Math.max(0, price.km - price.freeKm);
  const distanceFee = Math.round(billable * price.perKm);

  async function send(body: { amount?: number; acceptCounter?: boolean; counter?: boolean }) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || t("Could not update the price"));
        return;
      }
      setCustom("");
      onUpdated?.();
    } catch {
      setError(t("Could not reach Wassl"));
    } finally {
      setBusy(false);
    }
  }

  const counterBlock =
    price.counter && mode === "customer" ? (
      <div className="rounded-[6px] border border-saffron/40 bg-saffron/10 p-2.5">
        <p className="text-[11px] font-semibold text-saffron-deep">
          {t("The courier suggests {amount} MAD", { amount: price.counter.amount })}
        </p>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => void send({ acceptCounter: true })}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-[6px] bg-brand text-[13px] font-semibold text-on-dark transition-colors hover:bg-brand-deep disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {t("Accept {amount} MAD", { amount: price.counter.amount })}
        </button>
        <button
          type="button"
          onClick={() => setRaiseOpen(true)}
          className="mt-1.5 h-7 w-full text-[10.5px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {t("Or raise my offer instead")}
        </button>
      </div>
    ) : null;

  const controls =
    mode === "customer" ? (
      price.counter && !raiseOpen ? (
        counterBlock
      ) : (
      <>
        <div className="flex items-center gap-1.5">
          {[step, step * 2, step * 4].map((increment) => (
            <button
              key={increment}
              type="button"
              onClick={() => setRaise(increment)}
              className={`tnum h-8 flex-1 rounded-[6px] border text-[11px] font-semibold transition-colors ${
                raise === increment
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-muted hover:border-brand/60"
              }`}
            >
              +{increment}
            </button>
          ))}
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder={t("MAD")}
            aria-label={t("Custom offer")}
            className="tnum h-8 w-16 rounded-[6px] border border-line bg-surface px-2 text-[11px] font-semibold"
          />
        </div>
        <button
          type="button"
          disabled={busy || disabled || (next <= price.current && !custom)}
          onClick={() => void send({ amount: custom ? Number(custom) : next })}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-brand text-[13px] font-semibold text-on-dark transition-transform hover:-translate-y-0.5 hover:bg-brand-deep disabled:translate-y-0 disabled:opacity-40 motion-reduce:hover:translate-y-0"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
          {t("Raise to {amount} MAD", { amount: custom || next })}
        </button>
        <p className="mt-1.5 text-[9.5px] leading-3.5 text-muted">
          {t("Higher offers reach couriers faster. You only pay the amount you set.")}
        </p>
      </>
      )
    ) : (
      <>
        <div className="flex items-center gap-1.5">
          {[step, step * 2, step * 4].map((increment) => (
            <button
              key={increment}
              type="button"
              disabled={busy || disabled}
              onClick={() => {
                setRaise(increment);
                setCustom("");
              }}
              className={`tnum h-9 flex-1 rounded-[6px] border text-[11px] font-semibold transition-colors ${
                !custom && raise === increment
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-muted hover:border-brand hover:text-brand"
              } disabled:opacity-40`}
            >
              +{increment}
            </button>
          ))}
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder={t("MAD")}
            aria-label={t("Your counter")}
            className="tnum h-9 w-16 rounded-[6px] border border-line bg-surface px-2 text-[11px] font-semibold"
          />
        </div>
        <button
          type="button"
          disabled={busy || disabled || (custom ? Number(custom) : price.current + raise) <= price.current}
          onClick={() =>
            void send({ counter: true, amount: custom ? Number(custom) : price.current + raise })
          }
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-[6px] border border-brand text-[11.5px] font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {t("Suggest {amount} MAD", { amount: custom || price.current + raise })}
        </button>
        <p className="mt-1.5 text-center text-[9.5px] leading-3.5 text-muted">
          {t("The customer can accept or raise their offer.")}
        </p>
      </>
    );

  return (
    <div
      data-price-offer={mode}
      className={`rounded-[10px] border border-line bg-surface ${compact ? "p-3.5" : "p-4"}`}
    >
      <div className={compact ? "" : "flex flex-wrap items-start gap-x-4 gap-y-3"}>
        <div className="flex w-full items-start justify-between gap-3 sm:w-auto sm:flex-col sm:justify-start">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              <Route size={12} className="text-brand" />
              {mode === "customer" ? t("Your offer") : t("Delivery offer")}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="tnum font-display text-[30px] font-semibold leading-none text-ink">
                {price.current}
              </span>
              <span className="text-[11px] font-semibold text-muted">{t("MAD")}</span>
            </div>
          </div>
          <div className="rounded-[6px] bg-surface-2 px-2.5 py-1.5 text-end sm:mt-2.5 sm:bg-transparent sm:px-0 sm:py-0 sm:text-start">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              {t("Suggested")}
            </div>
            <div className="tnum text-[13px] font-semibold text-ink sm:text-[11.5px]">
              {price.suggested} MAD
            </div>
          </div>
        </div>

        <div
          className={`space-y-1 rounded-[6px] bg-surface-2/60 px-2.5 py-2 text-[10.5px] leading-4 text-muted ${
            compact ? "mt-3" : "w-full sm:mt-4 sm:w-auto sm:min-w-[168px] sm:flex-1"
          }`}
        >
          <div className="flex justify-between gap-3">
            <span>{t("Flat price")}</span>
            <span className="tnum shrink-0">{price.base} MAD</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {billable > 0
                ? `${billable.toFixed(1)} km × ${price.perKm} MAD`
                : `${price.freeKm} km ${t("included")}`}
            </span>
            <span className="tnum shrink-0">{distanceFee} MAD</span>
          </div>
          {price.addons?.map((addon) => (
            <div key={addon.label} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{t(addon.label)}</span>
              <span className="tnum shrink-0">{addon.amount} MAD</span>
            </div>
          ))}
        </div>

        <div className={compact ? "mt-3" : "w-full sm:w-[268px] sm:shrink-0"}>
          {controls}
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-[4px] bg-danger-soft px-2 py-1.5 text-[10.5px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
