import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { cancelGroupOrder } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { code } = await params;
  try {
    return NextResponse.json({ order: await cancelGroupOrder(code, session.userId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cancel" },
      { status: 400 },
    );
  }
}
