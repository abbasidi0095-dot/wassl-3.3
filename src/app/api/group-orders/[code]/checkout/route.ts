import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { checkoutGroupOrder } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        customerName?: string;
        customerPhone?: string;
        address?: string;
        landmark?: string;
        notes?: string;
        lat?: number;
        lng?: number;
      }
    | null;
  if (!body?.customerName || !body.customerPhone || !body.address || !body.landmark) {
    return NextResponse.json(
      { error: "Name, phone, address and landmark are required" },
      { status: 400 },
    );
  }
  try {
    const result = await checkoutGroupOrder({
      code,
      userId: session.userId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: session.email,
      address: body.address,
      landmark: body.landmark,
      notes: body.notes,
      lat: Number(body.lat ?? 0),
      lng: Number(body.lng ?? 0),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not checkout" },
      { status: 400 },
    );
  }
}
