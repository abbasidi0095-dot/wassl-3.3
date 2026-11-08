import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { removeFamilyMember, updateFamilyMemberRole } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  if (body?.role !== "adult" && body?.role !== "restricted") {
    return NextResponse.json({ error: "Choose adult or restricted" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      family: await updateFamilyMemberRole({
        userId: session.userId,
        memberId: id,
        role: body.role,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update role" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { id } = await params;
  try {
    return NextResponse.json({
      family: await removeFamilyMember(session.userId, id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove member" },
      { status: 400 },
    );
  }
}
