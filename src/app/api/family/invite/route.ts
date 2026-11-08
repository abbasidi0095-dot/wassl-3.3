import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { regenerateFamilyInvite } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  try {
    return NextResponse.json(await regenerateFamilyInvite(session.userId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create invite" },
      { status: 400 },
    );
  }
}
