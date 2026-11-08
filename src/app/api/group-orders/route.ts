import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { createGroupOrder, listGroupOrders } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  return NextResponse.json({ orders: await listGroupOrders(session.userId) });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | { storeId?: string; title?: string; deadline?: string }
    | null;
  if (!body?.storeId || !body.deadline) {
    return NextResponse.json({ error: "Store and deadline are required" }, { status: 400 });
  }
  try {
    const result = await createGroupOrder({
      userId: session.userId,
      userName: session.name,
      storeId: body.storeId,
      title: body.title || "Group order",
      deadline: body.deadline,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create group order" },
      { status: 400 },
    );
  }
}
