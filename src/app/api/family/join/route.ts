import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { joinFamily } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
  try {
    return NextResponse.json({
      family: await joinFamily({
        token: body.token,
        userId: session.userId,
        userName: session.name,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not join family" },
      { status: 400 },
    );
  }
}
