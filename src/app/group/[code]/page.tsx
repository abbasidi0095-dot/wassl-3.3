import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCities, getGroupOrder, getProducts, getStore } from "@/lib/db";
import { getCity } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GroupOrderRoom } from "./group-room";

export const dynamic = "force-dynamic";

export default async function GroupOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { code } = await params;
  const { token } = await searchParams;
  const session = await requireRole("customer");
  const order = await getGroupOrder(code);
  if (!order) notFound();
  const store = await getStore(order.storeId);
  const products = await getProducts(order.storeId);
  const cities = await getCities();
  const city = (await getCity(order.citySlug)) ?? cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl pb-16 pt-6 lg:pt-8">
        <GroupOrderRoom
          order={order}
          currentUserId={session.userId}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            unit: product.unit,
            available: product.available,
            stock: product.variants?.length
              ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
              : (product.stock ?? 1),
            category: product.category,
          }))}
          storeName={store?.name ?? order.storeName}
          customerName={session.name}
          initialToken={token ?? ""}
        />
      </main>
      <SiteFooter />
    </>
  );
}
