import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { createRecurringOrder, listRecurringOrders } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  return NextResponse.json({ orders: await listRecurringOrders(session.userId) });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as {
    storeId?: string;
    title?: string;
    frequency?: "daily" | "weekly" | "monthly" | "custom";
    intervalDays?: number;
    startAt?: string;
    consent?: boolean;
    address?: {
      name?: string;
      phone?: string;
      address?: string;
      landmark?: string;
      notes?: string;
      lat?: number;
      lng?: number;
    };
    items?: Array<{ productId?: string; qty?: number }>;
  } | null;
  if (!body?.storeId || !body.frequency || !body.address?.phone || !body.address.address || !body.address.landmark) {
    return NextResponse.json({ error: "Store, frequency and delivery details are required" }, { status: 400 });
  }
  const items = (body.items ?? [])
    .filter((item): item is { productId: string; qty: number } => Boolean(item.productId) && typeof item.qty === "number")
    .map((item) => ({ productId: item.productId, qty: item.qty }));
  try {
    const order = await createRecurringOrder({
      userId: session.userId,
      storeId: body.storeId,
      title: body.title || "Recurring order",
      frequency: body.frequency,
      intervalDays: body.intervalDays,
      startAt: body.startAt,
      consent: Boolean(body.consent),
      address: {
        name: body.address.name || session.name,
        phone: body.address.phone,
        email: session.email,
        address: body.address.address,
        landmark: body.address.landmark,
        notes: body.address.notes,
        lat: Number(body.address.lat ?? 0),
        lng: Number(body.address.lng ?? 0),
      },
      items,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create schedule" },
      { status: 400 },
    );
  }
}
