import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getCities, getDb } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { activeGroceryPromotions } from "@/lib/grocery-promotions";
import { PROMOS } from "@/lib/promos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deals" };

export default async function DealsPage() {
  const db = await getDb();
  const cities = await getCities();
  const city = await getPreferredCity(cities);
  const stores = db.stores.filter((store) => store.citySlug === city.slug);
  const promotions = db.promotions ?? [];
  const deals = stores.flatMap((store) =>
    activeGroceryPromotions(promotions, store.id).map((promotion) => {
      const product = promotion.productIds?.length
        ? db.products.find((entry) => promotion.productIds?.includes(entry.id))
        : db.products.find(
            (entry) =>
              entry.storeId === store.id &&
              (!promotion.categories?.length || promotion.categories.includes(entry.category)),
          );
      return { promotion, store, product };
    }),
  );
  const codes = PROMOS.filter(
    (promo) => !promo.cities?.length || promo.cities.includes(city.slug),
  );

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl pb-16 pt-6 lg:pt-8">
        <header className="figma-band p-6 lg:p-8">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-saffron">
            <Tag size={14} /> {city.name} deals
          </div>
          <h1 className="display mt-2 text-[clamp(2.2rem,1.5rem+2.4vw,3.4rem)]">
            Real offers, no fake countdowns.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[14px] leading-6 text-muted">
            Live supermarket promotions and Wassl promo codes. Discounts are validated again by
            the server at checkout.
          </p>
        </header>

        <section className="mt-7">
          <h2 className="font-display text-[26px] font-semibold">Store promotions</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map(({ promotion, store, product }) => (
              <Link
                key={promotion.id}
                href={`/store/${store.slug}`}
                className="group overflow-hidden rounded-[22px] border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div className="relative h-36 overflow-hidden bg-surface-2">
                  {product?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                  ) : null}
                  <span className="absolute start-3 top-3 rounded-full bg-signal px-2.5 py-1 text-[11px] font-bold text-[#2a1b14]">
                    -{promotion.percentOff}%
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-[19px] font-semibold leading-tight">{promotion.title}</h3>
                  <p className="mt-1 text-[12px] text-muted">{store.name}</p>
                  <p className="mt-2 text-[11px] text-muted">
                    {promotion.minQty > 1 ? `Minimum ${promotion.minQty} items · ` : ""}
                    {promotion.minSubtotal ? `Spend ${promotion.minSubtotal} MAD · ` : ""}
                    Ends {new Date(promotion.endsAt).toLocaleDateString()}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                    Shop the offer <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
            {!deals.length ? (
              <div className="rounded-[16px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted sm:col-span-2 lg:col-span-3">
                No active store promotions in {city.name} right now.
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-[26px] font-semibold">Promo codes</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {codes.map((promo) => (
              <div key={promo.code} className="rounded-[18px] border border-line bg-surface p-4">
                <div className="font-mono text-[18px] font-bold tracking-[0.08em]">{promo.code}</div>
                <p className="mt-1 text-[13px] font-semibold">{promo.label}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {promo.minSubtotal ? `Minimum ${promo.minSubtotal} MAD` : "No minimum"}
                  {promo.type === "delivery" ? " · Free delivery" : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
