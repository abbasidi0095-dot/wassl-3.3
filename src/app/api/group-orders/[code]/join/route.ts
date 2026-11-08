import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { joinGroupOrder } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
  try {
    return NextResponse.json({
      order: await joinGroupOrder({
        code,
        token: body.token,
        userId: session.userId,
        userName: session.name,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not join" },
      { status: 400 },
    );
  }
}
