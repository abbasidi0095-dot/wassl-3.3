import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { setGroupOrderItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as
    | { productId?: string; qty?: number }
    | null;
  if (!body?.productId || typeof body.qty !== "number") {
    return NextResponse.json({ error: "Product and quantity are required" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      order: await setGroupOrderItem({
        code,
        userId: session.userId,
        productId: body.productId,
        qty: body.qty,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update item" },
      { status: 400 },
    );
  }
}
