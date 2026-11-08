import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { runDueRecurringOrders } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WASSL_CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const cronAuthorized = Boolean(secret) && authorization === `Bearer ${secret}`;
  if (!cronAuthorized) {
    const session = requireApiRole(request, ["admin"]);
    if (isResponse(session)) return session;
  }
  const summary = await runDueRecurringOrders();
  return NextResponse.json(summary);
}
