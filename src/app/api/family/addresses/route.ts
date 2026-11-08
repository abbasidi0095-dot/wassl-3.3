import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { addFamilyAddress, removeFamilyAddress } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as {
    label?: string; name?: string; phone?: string; address?: string; landmark?: string; lat?: number; lng?: number;
  } | null;
  if (!body?.name || !body.phone || !body.address || !body.landmark) {
    return NextResponse.json({ error: "Name, phone, address and landmark are required" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      family: await addFamilyAddress({
        userId: session.userId,
        label: body.label ?? "Home",
        name: body.name,
        phone: body.phone,
        address: body.address,
        landmark: body.landmark,
        lat: Number(body.lat ?? 0),
        lng: Number(body.lng ?? 0),
      }),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save address" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Address id is required" }, { status: 400 });
  try {
    return NextResponse.json({ family: await removeFamilyAddress(session.userId, id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove address" }, { status: 400 });
  }
}
