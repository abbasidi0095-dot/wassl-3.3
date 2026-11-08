import { requireRole } from "@/lib/auth";
import { getFamilyForUser } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { FamilyManager } from "./family-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wassl Family" };

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await requireRole("customer");
  const { token } = await searchParams;
  const family = await getFamilyForUser(session.userId);
  const cities = await getCities();
  const city = await getPreferredCity(cities);

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl pb-16 pt-6 lg:pt-8">
        <FamilyManager
          family={family ?? null}
          currentUserId={session.userId}
          initialToken={token ?? ""}
        />
      </main>
      <SiteFooter />
    </>
  );
}
