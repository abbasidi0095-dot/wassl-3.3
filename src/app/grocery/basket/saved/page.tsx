import { requireRole } from "@/lib/auth";
import { getSavedBasketByShareToken, listFamilySavedBaskets, listSavedBaskets } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { SavedBaskets } from "./saved-baskets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved baskets" };

export default async function SavedBasketsPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string }>;
}) {
  const session = await requireRole("customer");
  const { share } = await searchParams;
  const [baskets, familyBaskets, shared, cities] = await Promise.all([
    listSavedBaskets(session.userId),
    listFamilySavedBaskets(session.userId),
    share ? getSavedBasketByShareToken(share) : Promise.resolve(undefined),
    getCities(),
  ]);
  const city = await getPreferredCity(cities);

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl pb-16 pt-6 lg:pt-8">
        <SavedBaskets baskets={baskets} familyBaskets={familyBaskets} shared={shared ?? null} />
      </main>
      <SiteFooter />
    </>
  );
}
