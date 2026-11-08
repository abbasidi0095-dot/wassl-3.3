import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { setRecurringOrderStatus, skipRecurringOrder } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  try {
    if (body?.action === "skip") {
      return NextResponse.json({ order: await skipRecurringOrder(id, session.userId) });
    }
    if (body?.action === "pause" || body?.action === "resume" || body?.action === "cancel") {
      const status = body.action === "pause" ? "paused" : body.action === "resume" ? "active" : "cancelled";
      return NextResponse.json({
        order: await setRecurringOrderStatus(id, session.userId, status),
      });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update schedule" },
      { status: 400 },
    );
  }
}
