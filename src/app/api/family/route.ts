import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { createFamily, getFamilyForUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  return NextResponse.json({ family: (await getFamilyForUser(session.userId)) ?? null });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  try {
    return NextResponse.json(
      await createFamily(session.userId, session.name, body?.name ?? "My family"),
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create family" },
      { status: 400 },
    );
  }
}
