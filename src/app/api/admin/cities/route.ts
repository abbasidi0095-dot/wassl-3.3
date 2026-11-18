import { NextResponse } from "next/server";
import { updateCity } from "@/lib/db";
import { actorFromSession, isResponse, requireApiRole } from "@/lib/api-auth";
import { sanitizeCityServices } from "@/lib/city-services";
import type { CityPricing, CityService, CityStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = requireApiRole(request, ["admin"]);
  if (isResponse(session)) return session;
  const body = (await request.json().catch(() => null)) as
    | {
        cityId?: string;
        launchStatus?: CityStatus;
        active?: boolean;
        services?: Partial<Record<CityService, boolean>>;
        pricing?: CityPricing;
      }
    | null;
  if (!body?.cityId) {
    return NextResponse.json({ error: "cityId is required" }, { status: 400 });
  }
  const patch: {
    launchStatus?: CityStatus;
    active?: boolean;
    services?: Partial<Record<CityService, boolean>>;
    pricing?: CityPricing;
  } = {};
  if (body.launchStatus === "live" || body.launchStatus === "soon") {
    patch.launchStatus = body.launchStatus;
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.services && typeof body.services === "object") {
    patch.services = sanitizeCityServices(body.services);
  }
  if (body.pricing && typeof body.pricing === "object") {
    const clean = (raw: Record<string, unknown> | undefined) => {
      if (!raw) return undefined;
      const num = (key: string, min: number, max: number) => {
        const value = Number(raw[key]);
        return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;
      };
      return {
        base: num("base", 0, 500),
        perKm: num("perKm", 0, 100),
        freeKm: num("freeKm", 0, 50),
        min: num("min", 0, 500),
        max: num("max", 1, 2000),
        step: num("step", 1, 100),
        ...(typeof raw.enabled === "boolean" ? { enabled: raw.enabled } : {}),
        ...(typeof raw.allowCounter === "boolean" ? { allowCounter: raw.allowCounter } : {}),
      };
    };
    patch.pricing = {
      delivery: clean(body.pricing.delivery as Record<string, unknown> | undefined),
      taxi: clean(body.pricing.taxi as Record<string, unknown> | undefined),
    };
  }
  try {
    return NextResponse.json({ ok: true, city: await updateCity(body.cityId, patch, actorFromSession(session)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update city" },
      { status: 400 },
    );
  }
}
