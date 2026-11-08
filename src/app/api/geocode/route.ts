import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
};

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 120);
  if (query.length < 3) return NextResponse.json({ suggestions: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    format: "jsonv2",
    q: query,
    countrycodes: "ma",
    limit: "6",
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
    if (!response.ok) throw new Error(`Geocoder ${response.status}`);
    const results = (await response.json()) as NominatimResult[];
    const suggestions = results
      .map((result, index) => {
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
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: `${lat.toFixed(5)}:${lng.toFixed(5)}:${index}`,
          label: result.display_name ?? `${street}, ${area}`,
          address: street || area || result.display_name || query,
          landmark: area || parts.city || parts.town || "",
          lat,
          lng,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
