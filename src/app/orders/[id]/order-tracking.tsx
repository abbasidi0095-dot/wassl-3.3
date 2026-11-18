"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Star,
} from "lucide-react";
import type { OrderView } from "@/lib/db";
import { ProductTile } from "@/components/product-icon";
import { HandoverCode } from "@/components/handover-code";
import { STATUS_META } from "@/lib/types";
import { clock, money, timeAgo } from "@/lib/utils";
import { MapView } from "@/components/map-view";
import { OrderRefundPanel } from "./order-refund-panel";
import { StartChatButton } from "@/components/start-chat-button";
import { CallDock } from "@/components/call-dock";
import { PriceOffer } from "@/components/price-offer";
import { RatingPrompt } from "@/components/rating-prompt";
import { useLiveEvents } from "@/lib/use-live-events";

const STEPS: { status: string; label: string; caption: string }[] = [
  { status: "placed", label: "Order placed", caption: "Sent to the store" },
  { status: "accepted", label: "Accepted", caption: "The store is on it" },
  { status: "preparing", label: "Preparing", caption: "Your food is being made" },
  { status: "ready", label: "Ready", caption: "Waiting for a driver" },
  { status: "assigned", label: "Driver assigned", caption: "A local driver is coming" },
  { status: "picked_up", label: "Picked up", caption: "Leaving the store" },
  { status: "en_route", label: "On the way", caption: "Follow the live map" },
  { status: "delivered", label: "Delivered", caption: "Enjoy your order" },
];

const PHASES: { label: string; statuses: string[] }[] = [
  { label: "Placed", statuses: ["placed", "accepted"] },
  { label: "Kitchen", statuses: ["preparing", "ready"] },
  { label: "On the way", statuses: ["assigned", "picked_up", "en_route"] },
  { label: "Delivered", statuses: ["delivered"] },
];

function firstName(name?: string) {
  return (name ?? "").trim().split(/\s+/)[0] || "";
}

export function OrderTracking({ initial }: { initial: OrderView }) {
  const [order, setOrder] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [liveRoute, setLiveRoute] = useState<[number, number][] | undefined>();

  useEffect(() => {
    try {
      const existing = JSON.parse(window.localStorage.getItem("wassl_orders") || "[]") as string[];
      window.localStorage.setItem(
        "wassl_orders",
        JSON.stringify([order.id, ...existing.filter((id) => id !== order.id)].slice(0, 40)),
      );
    } catch {
      // history is optional
    }
  }, [order.id]);

  async function refresh(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { order: OrderView };
        setOrder(data.order);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useLiveEvents({ orderId: order.id }, () => {
    void refresh(true);
  });

  useEffect(() => {
    if (!order.driver || order.status === "delivered" || order.status === "cancelled") {
      setLiveRoute(undefined);
      return;
    }
    let active = true;
    const driver = order.driver;
    fetch(
      `/api/route?fromLat=${driver.lat}&fromLng=${driver.lng}&toLat=${order.lat}&toLng=${order.lng}`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { coordinates?: [number, number][] } | null) => {
        if (active && data?.coordinates?.length) setLiveRoute(data.coordinates);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [order.driver?.lat, order.driver?.lng, order.lat, order.lng, order.status]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const currentIndex = STEPS.findIndex((step) => step.status === order.status);
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const live = !delivered && !cancelled;
  const eta =
    typeof order.etaMinutes === "number" && Number.isFinite(order.etaMinutes) && order.etaMinutes > 0
      ? Math.round(order.etaMinutes)
      : null;
  const etaSource = order.etaSetBy === "admin" ? "dispatch" : order.etaSetBy === "driver" ? "courier" : "";
  const canCall =
    Boolean(order.driver) && ["assigned", "picked_up", "en_route"].includes(order.status);
  const phaseIndex = Math.max(
    0,
    PHASES.findIndex((phase) => phase.statuses.includes(order.status)),
  );
  const phasePct = cancelled ? 0 : (phaseIndex / (PHASES.length - 1)) * 100;

  const points = useMemo(
    () => [
      ...(order.store
        ? [
            {
              id: "store",
              lat: order.store.lat,
              lng: order.store.lng,
              kind: "store" as const,
              label: order.store.name,
            },
          ]
        : []),
      ...(order.driver
        ? [
            {
              id: "driver",
              lat: order.driver.lat,
              lng: order.driver.lng,
              kind: "driver" as const,
              label: `${order.driver.name} · driver`,
            },
          ]
        : []),
      {
        id: "customer",
        lat: order.lat,
        lng: order.lng,
        kind: "customer" as const,
        label: "Your delivery address",
      },
    ],
    [order],
  );

  const fallbackRoute = order.store
    ? ([
        [order.store.lat, order.store.lng],
        [order.lat, order.lng],
      ] as [number, number][])
    : undefined;
  const route = liveRoute?.length ? liveRoute : fallbackRoute;

  const whatsappPhone = order.driver?.phone.replace(/[^0-9]/g, "");
  const meta = STATUS_META[order.status];
  const driverFirstName = firstName(order.driver?.name);

  const headline = delivered
    ? "Delivered. Enjoy!"
    : cancelled
      ? "Order cancelled"
      : driverFirstName && ["assigned", "picked_up", "en_route"].includes(order.status)
        ? `${driverFirstName} is on the way`
        : "Your order is moving";

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} /> {order.fulfillment === "pickup" ? "All pickups" : "All orders"}
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-muted">
            {order.code}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh the order"
            className={`bubble-press grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted ${
              refreshing ? "animate-spin" : ""
            }`}
          >
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {/* Live status band */}
      <section className="relative mt-3 overflow-hidden rounded-[22px] bg-ink px-5 py-5 text-on-dark sm:px-7 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
              <span
                className={`status-dot ${live ? "live-dot" : ""} ${
                  cancelled ? "text-coral" : "text-signal"
                }`}
              />
              {meta.label}
            </div>
            <h1 className="mt-2 max-w-[16ch] font-display text-[30px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[42px]">
              {headline}
            </h1>
            <p className="mt-1.5 truncate text-[12px] text-white/55">
              {order.store?.name} · {timeAgo(order.createdAt)}
              {order.fulfillment === "pickup" ? " · Pickup" : ""}
            </p>
          </div>

          {live ? (
            <div className="relative grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06]">
              {eta ? (
                <span
                  className="absolute inset-0 animate-ping rounded-full border border-signal/30 [animation-duration:2.6s] motion-reduce:hidden"
                  aria-hidden
                />
              ) : null}
              <div className="text-center">
                {eta ? (
                  <>
                    <div className="tnum font-display text-[27px] font-semibold leading-none">
                      {eta}
                    </div>
                    <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
                      min
                    </div>
                  </>
                ) : (
                  <>
                    <Clock3 size={18} className="mx-auto text-signal" />
                    <div className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      ETA soon
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {!cancelled ? (
          <div className="mt-6">
            <div className="relative flex items-center justify-between">
              <span className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/12" />
              <span
                className="absolute start-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-signal transition-[width] duration-700 ease-out"
                style={{ width: `calc(${phasePct}% - ${phasePct === 0 ? 0 : 8}px)` }}
              />
              {PHASES.map((phase, index) => {
                const done = index <= phaseIndex;
                const active = index === phaseIndex;
                return (
                  <div key={phase.label} className="relative z-10 flex flex-col items-center gap-2">
                    <span
                      className={`grid h-3.5 w-3.5 place-items-center rounded-full border-2 transition-colors ${
                        done
                          ? "border-signal bg-signal text-ink"
                          : "border-white/25 bg-ink text-transparent"
                      } ${active && live ? "ring-4 ring-signal/20" : ""}`}
                    >
                      <Check size={7} strokeWidth={4} />
                    </span>
                    <span
                      className={`text-[9.5px] font-semibold ${
                        active ? "text-white" : done ? "text-white/70" : "text-white/35"
                      }`}
                    >
                      {phase.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-white/50">
              {cancelled
                ? "This order was cancelled."
                : `${STEPS[Math.max(0, currentIndex)].label} · ${STEPS[Math.max(0, currentIndex)].caption}`}
              {etaSource ? ` · ${eta} min, set by ${etaSource}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-5 rounded-[12px] bg-white/[0.06] px-3 py-2.5 text-[11.5px] leading-5 text-white/60">
            Nothing further will be charged. If you were charged, contact support below.
          </p>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:items-start">
        {/* Courier + handover share the first left cell so the two columns balance */}
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        <div>
          {order.driver ? (
            <div className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow-float)]">
              <div className="flex items-center gap-3">
                {order.driver.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.driver.photo}
                    alt={order.driver.name}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
                    <Bike size={22} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ink">
                    {order.driver.name}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Star size={10} className="fill-saffron text-saffron" />
                      {order.driver.rating}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-line-strong" />
                    <span>{order.driver.vehicle}</span>
                    <span className="h-1 w-1 rounded-full bg-line-strong" />
                    <span className="tnum">{order.driver.plate}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {canCall ? (
                  <CallDock
                    orderId={order.id}
                    role="customer"
                    peerName={driverFirstName || order.driver.name}
                    className="!h-11 !rounded-full !border-brand !bg-brand !px-4 !text-[12px] !text-on-dark"
                  />
                ) : (
                  <a
                    href={`tel:${order.driver.phone.replace(/\s/g, "")}`}
                    className="bubble-press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-[12px] font-semibold text-on-dark"
                  >
                    <Phone size={14} /> {order.driver.phone}
                  </a>
                )}
                {whatsappPhone ? (
                  <a
                    href={`https://wa.me/${whatsappPhone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bubble-press inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-ink"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[18px] border border-dashed border-line-strong bg-surface/60 p-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
                <Bike size={20} />
              </span>
              <div>
                <div className="text-[13.5px] font-semibold text-ink">
                  {live ? "Finding your courier" : "No courier assigned"}
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-muted">
                  A local courier is assigned as soon as the store marks the order ready.
                </div>
              </div>
            </div>
          )}
        </div>

        {live && (order.fulfillment === "pickup" ? order.pickupCode : order.deliveryPin) ? (
          <HandoverCode
            code={order.fulfillment === "pickup" ? order.pickupCode : order.deliveryPin}
            label={order.fulfillment === "pickup" ? "Pickup code" : "Handover code"}
            note={
              order.fulfillment === "pickup"
                ? "Show these four digits at the counter when you collect."
                : "Give these four digits to the courier only when the order is in your hands."
            }
          />
        ) : null}
        </div>

        {/* Offer */}
        {order.price && live ? (
          <div className="lg:col-start-2 lg:row-start-1">
            <PriceOffer
              price={order.price}
              mode="customer"
              endpoint={`/api/orders/${order.id}/offer`}
              step={5}
              max={order.price.max}
              onUpdated={() => void refresh(true)}
            />
          </div>
        ) : null}

        {/* Map */}
        <div className="lg:col-start-1 lg:row-start-2">
          <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-float)]">
            <div className="relative">
              <MapView
                points={points}
                center={{ lat: order.lat, lng: order.lng }}
                zoom={14}
                height={330}
                route={route}
                followDriverId={order.driver ? "driver" : undefined}
              />
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                <span className="rounded-full bg-surface/95 px-3 py-1.5 text-[10.5px] font-semibold text-ink shadow-[var(--shadow-float)]">
                  {meta.label}
                </span>
                {live ? (
                  <span className="rounded-full bg-surface/95 px-3 py-1.5 text-[10.5px] font-semibold text-brand shadow-[var(--shadow-float)]">
                    Live
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[11px] text-muted">
              <MapPin size={13} className="shrink-0 text-brand" />
              <span className="min-w-0 truncate">
                {order.address}
                {order.landmark ? ` · ${order.landmark}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div className="lg:col-start-2 lg:row-start-2">
          <div className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow-float)] sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
                Receipt
              </h2>
              <ReceiptText size={15} className="text-muted" />
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{order.store?.name}</div>
            <div className="mt-3 space-y-2">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex items-center gap-2.5 text-[11.5px]">
                  <ProductTile
                    name={item.name}
                    image={item.image}
                    className="h-8 w-8 rounded-full"
                    iconSize={15}
                  />
                  <span className="min-w-0 flex-1 font-medium">
                    <span className="block truncate">
                      {item.qty}× {item.name}
                    </span>
                    {item.options?.length ? (
                      <span className="block truncate text-[10.5px] text-muted">
                        {item.options.map((option) => option.optionName).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="tnum font-semibold">
                    {money(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="tnum font-medium text-ink">{money(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>
                  Delivery
                  {typeof order.price?.km === "number" && Number.isFinite(order.price.km) ? (
                    <span className="ms-1 text-[10.5px]">
                      · {order.price.km.toFixed(1)} km
                    </span>
                  ) : null}
                </span>
                <span className="tnum font-medium text-ink">{money(order.deliveryFee)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2.5">
                <span className="text-[14px] font-semibold text-ink">Total</span>
                <span className="tnum font-display text-[20px] font-semibold text-ink">
                  {money(order.total)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-[12px] bg-signal-soft/60 px-3 py-2.5">
              <Banknote size={16} className="shrink-0 text-signal-ink" />
              <div>
                <div className="text-[12px] font-semibold text-signal-ink">Cash on delivery</div>
                <div className="text-[10.5px] text-signal-ink/75">
                  {order.cashCollected ? "Cash collected" : `Pay ${money(order.total)} on arrival`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="lg:col-start-2 lg:row-start-3">
          <div className="rounded-[18px] border border-line bg-surface p-4 sm:p-5">
            <h2 className="text-[12.5px] font-semibold text-ink">Delivery address</h2>
            <div className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-5 text-muted">
              <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
              <div className="min-w-0">
                <div className="font-medium text-ink">{order.address}</div>
                <div>{order.landmark}</div>
                {order.notes ? <div className="mt-1 italic">“{order.notes}”</div> : null}
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-muted">
              <Phone size={13} className="text-brand" /> {order.customerPhone}
            </div>
            {order.scheduledFor ? (
              <div className="mt-2 flex items-center gap-2 text-[11.5px] text-muted">
                <Clock3 size={13} className="text-brand" /> Scheduled for{" "}
                {new Date(order.scheduledFor).toLocaleString("en-GB", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Support */}
        <div className="lg:col-start-2 lg:row-start-4">
          <div className="rounded-[18px] bg-ink p-4 text-on-dark sm:p-5">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/40">
              <ShieldCheck size={13} className="text-saffron" /> Wassl support
            </div>
            <p className="mt-2 text-[13.5px] font-semibold">Something wrong with your order?</p>
            <p className="mt-1 text-[11px] leading-5 text-white/50">
              Call us and we will contact the store and courier directly.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="tel:+212660000000"
                className="bubble-press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-signal text-[12px] font-semibold text-ink"
              >
                <Phone size={14} /> Call support
              </a>
              <StartChatButton
                topic="support"
                orderId={order.id}
                storeId={order.storeId}
                driverId={order.driverId}
                subject={`Support · ${order.code}`}
                label="Message"
                className="!h-11 !rounded-full !border-white/20 !bg-transparent !px-4 !text-[12px] !text-on-dark"
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-start-1 lg:row-start-3">
          <details className="group rounded-[18px] border border-line bg-surface p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
                  Order timeline
                </h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  {cancelled
                    ? "Cancelled"
                    : `${Math.min(currentIndex + 1, STEPS.length)} of ${STEPS.length} steps · ${meta.label}`}
                </p>
              </div>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-4">
              {cancelled ? (
                <div className="rounded-[12px] bg-danger-soft p-3 text-[11.5px] font-semibold text-danger">
                  This order was cancelled. If you were charged, contact support.
                </div>
              ) : (
                <div className="space-y-0">
                  {STEPS.map((step, index) => {
                    const event = order.events.find((item) => item.type === step.status);
                    const done = Boolean(event) || index <= currentIndex;
                    const active = index === currentIndex;
                    return (
                      <div key={step.status} className="relative flex gap-3 pb-4 last:pb-0">
                        {index < STEPS.length - 1 ? (
                          <span
                            className={`absolute start-[9px] top-5 h-full w-px ${
                              done ? "timeline-line" : "bg-ink/10"
                            }`}
                          />
                        ) : null}
                        <span
                          className={`relative z-10 mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                            done
                              ? "border-brand bg-brand text-paper"
                              : "border-line-strong bg-paper text-transparent"
                          }`}
                        >
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[12.5px] ${
                                active
                                  ? "font-semibold text-ink"
                                  : done
                                    ? "font-medium text-ink"
                                    : "text-muted/60"
                              }`}
                            >
                              {step.label}
                            </span>
                            <span className="tnum text-[10.5px] font-medium text-muted">
                              {event ? clock(event.at) : ""}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-muted">{step.caption}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </div>
      </div>

      {delivered ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <RatingPrompt
            kind="order"
            id={order.id}
            initial={order.rating}
            subject={order.store?.name}
          />
          {order.store?.category === "grocery" ? <OrderRefundPanel orderId={order.id} /> : null}
          <Link href={`/store/${order.store?.slug}`} className="btn btn-primary sm:col-span-2">
            <CheckCircle2 size={15} /> Order again
          </Link>
        </div>
      ) : null}
    </div>
  );
}
