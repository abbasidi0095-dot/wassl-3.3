"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import type { PriceSnapshot } from "@/lib/types";

/** Numbers from storage are not trusted: a sparse admin patch once produced NaN. */
function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The bidding card used on both sides of a delivery or a taxi ride.
 * Customers raise the offer, couriers counter it. The big number is the amount
 * you are about to send, so tapping +5 visibly adds five on every tap.
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

  const current = Math.max(0, Math.round(safeNumber(price.current)));
  const suggested = Math.max(1, Math.round(safeNumber(price.suggested, current || 1)));
  const base = Math.max(0, Math.round(safeNumber(price.base, suggested)));
  const perKm = Math.max(0, safeNumber(price.perKm));
  const freeKm = Math.max(0, safeNumber(price.freeKm));
  const km = Math.max(0, safeNumber(price.km));
  const increment = Math.max(1, Math.round(safeNumber(step, 5)));
  const ceiling = Math.max(
    current,
    suggested,
    Math.round(safeNumber(max, Math.max(current, suggested))),
  );

  const [target, setTarget] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const [counterOpen, setCounterOpen] = useState(false);
  const [chip, setChip] = useState<number | null>(null);
  const sentTimer = useRef<number | null>(null);

  // A refresh from the server resets the amount unless the customer is mid-edit.
  useEffect(() => {
    if (!dirty) setTarget(current);
  }, [current, dirty]);

  useEffect(() => {
    return () => {
      if (sentTimer.current) window.clearTimeout(sentTimer.current);
    };
  }, []);

  const billable = Math.max(0, km - freeKm);
  const distanceFee = Math.round(billable * perKm);
  const addonTotal = (price.addons ?? []).reduce(
    (sum, addon) => sum + Math.max(0, safeNumber(addon.amount)),
    0,
  );
  const pending = target > current;
  const counter = price.counter;

  function bump(delta: number, keepChip = false) {
    if (!keepChip) setChip(null);
    setCustom("");
    setTarget((value) => clamp(value + delta, current, ceiling));
    setDirty(true);
    setSent(null);
    setError("");
  }

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
      setDirty(false);
      setCustom("");
      if (typeof body.amount === "number") setSent(body.amount);
      if (body.acceptCounter) setSent(safeNumber(counter?.amount, current));
      if (sentTimer.current) window.clearTimeout(sentTimer.current);
      sentTimer.current = window.setTimeout(() => setSent(null), 3200);
      onUpdated?.();
    } catch {
      setError(t("Could not reach Wassl"));
    } finally {
      setBusy(false);
    }
  }

  const showCounter = mode === "customer" && counter && !counterOpen;
  const remainingToCeiling = ceiling - target;

  return (
    <section
      data-price-offer={mode}
      className={`overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-float)] ${
        compact ? "text-[13px]" : ""
      }`}
    >
      <div className="h-1 w-full bg-brand" aria-hidden />

      <div className={compact ? "p-3.5" : "p-4 sm:p-5"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[12px] font-semibold text-ink">
              {mode === "customer" ? t("Your delivery offer") : t("Counter this delivery")}
            </h2>
            {compact ? null : (
              <p className="mt-0.5 text-[10.5px] leading-4 text-muted">
                {mode === "customer"
                  ? t("Tap + to raise what you pay the courier.")
                  : t("Ask for more, the customer accepts or raises.")}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-muted">
            {t("Suggested {amount} MAD", { amount: suggested })}
          </span>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            aria-label={t("Lower the offer")}
            disabled={disabled || busy || target <= current}
            onClick={() => bump(-increment)}
            className="bubble-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink disabled:opacity-30"
          >
            <Minus size={18} strokeWidth={2.4} />
          </button>

          <div className="min-w-0 flex-1 rounded-full bg-surface-2/70 px-3 py-2 text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span
                key={target}
                className={`pop-in tnum block font-display font-semibold leading-none text-ink ${
                  compact ? "text-[28px]" : "text-[34px]"
                }`}
                aria-live="polite"
              >
                {target}
              </span>
              <span className="text-[10px] font-semibold text-muted">{t("MAD")}</span>
            </div>
            <div className="mt-0.5 text-[9.5px] font-medium text-muted">
              {pending
                ? t("{amount} MAD more than now", { amount: target - current })
                : t("Current offer")}
            </div>
          </div>

          <button
            type="button"
            aria-label={t("Raise the offer")}
            disabled={disabled || busy || target >= ceiling}
            onClick={() => bump(increment)}
            className="bubble-press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-on-dark shadow-[0_12px_20px_-12px_var(--brand)] disabled:opacity-40"
          >
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {[increment, increment * 2, increment * 4].map((amount) => {
            const selected =
              custom === "" &&
              (chip === amount || target === clamp(current + amount, current, ceiling));
            return (
              <button
                key={amount}
                type="button"
                disabled={disabled || busy || current + amount > ceiling}
                onClick={() => bump(amount, true)}
                className={`bubble-press tnum flex-1 rounded-full border text-[12px] font-semibold ${
                  compact ? "h-9" : "h-10"
                } ${
                  selected
                    ? "border-ink bg-ink text-on-dark"
                    : "border-line bg-surface text-ink hover:border-ink/40"
                } disabled:opacity-40`}
              >
                +{amount}
              </button>
            );
          })}
          <input
            value={custom}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "").slice(0, 4);
              setChip(null);
              setCustom(raw);
              if (raw) setTarget(clamp(Number(raw), current, ceiling));
              else setTarget(current);
              setDirty(Boolean(raw));
              setSent(null);
            }}
            inputMode="numeric"
            placeholder={t("Other")}
            aria-label={t("Custom offer")}
            className="tnum h-10 w-[64px] shrink-0 rounded-full border border-line bg-surface px-2 text-center text-[12px] font-semibold"
          />
        </div>

        {showCounter ? (
          <div className="mt-3.5 rounded-[14px] border border-signal/45 bg-signal-soft/70 p-3">
            <p className="text-[12px] font-semibold leading-5 text-signal-ink">
              {counter?.note
                ? t("{name} suggests {amount} MAD", {
                    name: counter.note,
                    amount: safeNumber(counter.amount),
                  })
                : t("Your courier suggests {amount} MAD", {
                    amount: safeNumber(counter.amount),
                  })}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() => void send({ acceptCounter: true })}
                className="bubble-press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink text-[12.5px] font-semibold text-on-dark disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} strokeWidth={2.6} />
                )}
                {t("Accept {amount} MAD", { amount: safeNumber(counter?.amount) })}
              </button>
              <button
                type="button"
                onClick={() => setCounterOpen(true)}
                className="bubble-press h-11 shrink-0 rounded-full border border-signal/50 px-3 text-[11.5px] font-semibold text-signal-ink"
              >
                {t("Raise mine")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {pending || busy ? (
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() =>
                  void send(
                    mode === "customer"
                      ? { amount: target }
                      : { counter: true, amount: target },
                  )
                }
                className={`bubble-press pop-in mt-3.5 flex w-full items-center justify-center gap-2 rounded-full bg-brand text-[14px] font-semibold text-on-dark shadow-[0_16px_26px_-16px_var(--brand)] disabled:opacity-45 ${
                  compact ? "h-12" : "h-[52px]"
                }`}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === "customer" ? (
                  <ArrowUpRight size={17} strokeWidth={2.4} />
                ) : (
                  <Sparkles size={16} />
                )}
                {mode === "customer"
                  ? t("Send {amount} MAD offer", { amount: target })
                  : t("Suggest {amount} MAD", { amount: target })}
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled || busy || target >= ceiling}
                onClick={() => bump(increment)}
                className="bubble-press mt-3.5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-line-strong text-[12px] font-semibold text-muted hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <Plus size={15} strokeWidth={2.6} />
                {mode === "customer"
                  ? t("Add {amount} MAD", { amount: increment })
                  : t("Suggest {amount} MAD more", { amount: increment })}
              </button>
            )}

            <div className="mt-2 min-h-[16px] text-center">
              {error ? (
                <p className="text-[10.5px] font-semibold text-danger">{error}</p>
              ) : sent ? (
                <p className="text-[10.5px] font-semibold text-success">
                  {t("Offer sent · {amount} MAD", { amount: sent })}
                </p>
              ) : (
                <p className="text-[10px] leading-4 text-muted">
                  {remainingToCeiling > 0
                    ? mode === "customer"
                      ? t("Couriers see your offer instantly. Max {max} MAD here.", {
                          max: ceiling,
                        })
                      : t("The customer sees this price instantly. Max {max} MAD.", {
                          max: ceiling,
                        })
                    : t("You have reached the highest price for this city.")}
                </p>
              )}
            </div>
          </>
        )}

        <details className="group mt-3 border-t border-line pt-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[10.5px] font-medium text-muted [&::-webkit-details-marker]:hidden">
            <span>
              {t("{base} MAD flat", { base })}
              <span className="mx-1.5 text-line-strong">·</span>
              {billable > 0
                ? `${billable.toFixed(1)} km × ${perKm} MAD`
                : `${freeKm} km ${t("included")}`}
            </span>
            <ChevronDown
              size={14}
              className="shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-2 space-y-1 rounded-[10px] bg-surface-2/50 px-2.5 py-2 text-[10.5px] leading-4 text-muted">
            <div className="flex justify-between gap-3">
              <span>{t("Flat price")}</span>
              <span className="tnum shrink-0">{base} MAD</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {billable > 0
                  ? `${billable.toFixed(1)} km × ${perKm} MAD`
                  : `${freeKm} km ${t("included")}`}
              </span>
              <span className="tnum shrink-0">{distanceFee} MAD</span>
            </div>
            {(price.addons ?? []).map((addon) => (
              <div key={addon.label} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{t(addon.label)}</span>
                <span className="tnum shrink-0">
                  {Math.round(safeNumber(addon.amount))} MAD
                </span>
              </div>
            ))}
            {addonTotal > 0 ? (
              <div className="flex justify-between gap-3 border-t border-line pt-1 font-semibold text-ink">
                <span>{t("Suggested quote")}</span>
                <span className="tnum shrink-0">{suggested} MAD</span>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  );
}
