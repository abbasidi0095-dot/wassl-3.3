import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPersonalSearch } from "@/lib/personal-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return NextResponse.json(
      { personalized: false, recent: [], frequent: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const result = await getPersonalSearch(session.email);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
