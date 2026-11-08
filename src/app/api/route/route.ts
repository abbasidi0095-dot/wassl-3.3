import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const fromLat = Number(params.get("fromLat"));
  const fromLng = Number(params.get("fromLng"));
  const toLat = Number(params.get("toLat"));
  const toLng = Number(params.get("toLng"));
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "Coordinates are required" }, { status: 400 });
  }
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Wassl/12.0 (https://wassl.shop)" },
      next: { revalidate: 10 },
    });
    if (!response.ok) throw new Error(`Routing ${response.status}`);
    const data = (await response.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };
    const route = data.routes?.[0];
    const coordinates = (route?.geometry?.coordinates ?? []).map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    return NextResponse.json(
      {
        coordinates,
        distanceMeters: route?.distance ?? null,
        durationSeconds: route?.duration ?? null,
      },
      { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } },
    );
  } catch {
    return NextResponse.json({ coordinates: [] }, { status: 200 });
  }
}
