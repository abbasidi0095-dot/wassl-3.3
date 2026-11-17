import { NextResponse } from "next/server";
import { setOrderEta } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { OrderRuleError } from "@/lib/order-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Publish the delivery estimate. Only dispatch or the courier assigned to the
 * order may call this; the customer never sets its own ETA.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = requireApiRole(request, ["admin", "driver"]);
  if (isResponse(session)) return session;

  const body = (await request.json().catch(() => null)) as
    | { minutes?: number | string }
    | null;
  const minutes = Number(body?.minutes);
  if (!Number.isFinite(minutes)) {
    return NextResponse.json(
      { error: "Give an estimate in minutes" },
      { status: 400 },
    );
  }

  try {
    const order = await setOrderEta(id, minutes, actorFromSession(session));
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    if (error instanceof OrderRuleError) {
      const status =
        error.code === "not_found"
          ? 404
          : ["role_not_allowed", "wrong_driver"].includes(error.code)
            ? 403
            : error.code === "illegal_transition"
              ? 409
              : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not set the estimate" },
      { status: 400 },
    );
  }
}
