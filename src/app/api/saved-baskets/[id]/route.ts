import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import {
  deleteSavedBasket,
  duplicateSavedBasket,
  setSavedBasketReminder,
  shareSavedBasket,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  await deleteSavedBasket(id, session.userId);
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { action?: string; remindAt?: string }
    | null;
  try {
    if (body?.action === "duplicate") {
      return NextResponse.json({ basket: await duplicateSavedBasket(id, session.userId) });
    }
    if (body?.action === "share") {
      return NextResponse.json(await shareSavedBasket(id, session.userId));
    }
    if (body?.action === "remind") {
      return NextResponse.json({
        basket: await setSavedBasketReminder(id, session.userId, body.remindAt),
      });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update basket" },
      { status: 400 },
    );
  }
}
