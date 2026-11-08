import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { createSavedBasket, listSavedBaskets } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  return NextResponse.json({ baskets: await listSavedBaskets(session.userId) });
}

export async function POST(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | { name?: string; items?: unknown }
    | null;
  try {
    return NextResponse.json(
      {
        basket: await createSavedBasket({
          userId: session.userId,
          name: body?.name ?? "Saved basket",
          items: body?.items,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save basket" },
      { status: 400 },
    );
  }
}
