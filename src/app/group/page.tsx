import { requireRole } from "@/lib/auth";
import { getCities, getCity, getStores, listGroupOrders } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GroupOrderHub } from "./group-hub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Group orders" };

export default async function GroupOrdersPage() {
  const session = await requireRole("customer");
  const cities = await getCities();
  const city = await getPreferredCity(cities);
  const currentCity = (await getCity(city.slug)) ?? cities[0];
  const stores = (await getStores(city.slug)).filter((store) => store.isOpen);
  const orders = await listGroupOrders(session.userId);

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl pb-16 pt-6 lg:pt-8">
        <GroupOrderHub
          stores={stores.map((store) => ({
            id: store.id,
            name: store.name,
            category: store.category,
          }))}
          orders={orders}
        />
      </main>
      <SiteFooter />
    </>
  );
}
