import { NextResponse } from "next/server";
import { setRideOffer } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { OrderRuleError } from "@/lib/order-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Taxi bidding: the rider raises the fare, drivers counter. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { amount?: number; acceptCounter?: boolean; counter?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const session = getSessionFromRequest(request);
  const actor =
    session?.role === "driver"
      ? { role: "driver" as const, id: session.userId, name: session.name, driverId: session.driverId }
      : session?.role === "admin"
        ? { role: "admin" as const, id: session.userId, name: session.name }
        : { role: "customer" as const, id: session?.userId };

  if (body.counter && actor.role !== "driver") {
    return NextResponse.json({ error: "Only drivers can counter" }, { status: 403 });
  }

  try {
    const ride = await setRideOffer(id, body, actor);
    return NextResponse.json({ ok: true, ride });
  } catch (error) {
    if (error instanceof OrderRuleError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "wrong_driver"
            ? 403
            : error.code === "illegal_transition"
              ? 409
              : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the fare" },
      { status: 400 },
    );
  }
}
