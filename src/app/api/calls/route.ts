import { NextResponse } from "next/server";
import { getOrder, getOrders } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { findLiveCall, openCall } from "@/lib/calls";
import type { CallRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALLABLE = new Set(["assigned", "picked_up", "en_route"]);

/**
 * Start (or rejoin) the voice call attached to an order. Couriers authenticate
 * and must own the order; customers use the order page itself as the capability,
 * exactly like the tracking URL.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { orderId?: string; as?: CallRole }
    | null;
  const orderId = (body?.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!CALLABLE.has(order.status)) {
    return NextResponse.json(
      { error: "Calling opens once the order is out for delivery" },
      { status: 409 },
    );
  }

  const session = getSessionFromRequest(request);
  let role: CallRole = "customer";
  if (session?.role === "driver" || body?.as === "driver") {
    if (!session || session.role !== "driver") {
      return NextResponse.json({ error: "Please sign in as a courier" }, { status: 401 });
    }
    if (order.driverId !== session.driverId) {
      return NextResponse.json({ error: "This order is not yours" }, { status: 403 });
    }
    role = "driver";
  }

  const call = openCall(order.id, order.code, role);
  return NextResponse.json({ call: findLiveCall(order.id, role) ?? null });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = (url.searchParams.get("orderId") ?? "").trim();
  const session = getSessionFromRequest(request);

  if (!orderId) {
    // Couriers poll without an id: any live call on one of their deliveries.
    if (session?.role !== "driver" || !session.driverId) {
      return NextResponse.json({ call: null });
    }
    const active = await getOrders({ driverId: session.driverId });
    for (const order of active) {
      const call = findLiveCall(order.id, "driver");
      if (call && call.status !== "ended" && call.status !== "declined") {
        return NextResponse.json({ call });
      }
    }
    return NextResponse.json({ call: null });
  }

  const role: CallRole = session?.role === "driver" ? "driver" : "customer";
  return NextResponse.json({ call: findLiveCall(orderId, role) ?? null });
}
