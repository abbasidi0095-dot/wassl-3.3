import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordinates are required" }, { status: 400 });
  }
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "ar,fr,en",
  }).toString();
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Wassl/12.0 (https://wassl.shop; contact@wassl.shop)",
        "Accept-Language": "ar,fr,en",
      },
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error(String(response.status));
    const result = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const parts = result.address ?? {};
    const street = [parts.house_number, parts.road].filter(Boolean).join(" ");
    const area = [
      parts.neighbourhood,
      parts.suburb,
      parts.city_district,
      parts.city || parts.town || parts.village,
    ]
      .filter(Boolean)
      .join(", ");
    return NextResponse.json({
      address: street || area || result.display_name || "",
      landmark: area || parts.city || parts.town || "",
      label: result.display_name ?? "",
      lat,
      lng,
    });
  } catch {
    return NextResponse.json({ address: "", landmark: "", label: "", lat, lng });
  }
}
