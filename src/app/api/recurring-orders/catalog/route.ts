import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { getProducts } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = requireApiRole(request, ["customer"]);
  if (isResponse(session)) return session;
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ products: [] });
  const products = await getProducts(storeId);
  return NextResponse.json({
    products: products
      .filter((product) => product.available)
      .map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        unit: product.unit,
        category: product.category,
        stock: product.variants?.length
          ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
          : (product.stock ?? 1),
      })),
  });
}
