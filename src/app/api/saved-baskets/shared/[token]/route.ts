import { NextResponse } from "next/server";
import { getSavedBasketByShareToken } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const basket = await getSavedBasketByShareToken(token);
  if (!basket) return NextResponse.json({ error: "Basket not found" }, { status: 404 });
  return NextResponse.json({ basket });
}
