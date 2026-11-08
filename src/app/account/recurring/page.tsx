import { requireRole } from "@/lib/auth";
import { getCities, getStores, listRecurringOrders } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RecurringManager } from "./recurring-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recurring orders" };

export default async function RecurringOrdersPage() {
  const session = await requireRole("customer");
  const cities = await getCities();
  const city = await getPreferredCity(cities);
  const stores = (await getStores(city.slug)).filter((store) => store.isOpen);
  const orders = await listRecurringOrders(session.userId);

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl pb-16 pt-6 lg:pt-8">
        <RecurringManager
          stores={stores.map((store) => ({
            id: store.id,
            name: store.name,
            category: store.category,
          }))}
          orders={orders}
          defaultName={session.name}
          defaultPhone=""
        />
      </main>
      <SiteFooter />
    </>
  );
}
