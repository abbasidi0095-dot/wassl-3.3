import Link from "next/link";
import {
  ArrowRight,
  CarTaxiFront,
  Headphones,
  MessageCircle,
  Pill,
  ReceiptText,
  Search,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PromoTicker } from "@/components/promo-ticker";
import { StoreCard } from "@/components/store-card";
import { getSession } from "@/lib/auth";
import {
  getCities,
  getOrderViews,
  getStores,
  getTaxiRides,
  getUserById,
} from "@/lib/db";
import { getOpenState } from "@/lib/hours";
import { getPreferredCity } from "@/lib/city-preference";
import { getTranslator } from "@/lib/i18n-server";
import { money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ORDER_ACTIVE = new Set([
  "placed",
  "accepted",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "en_route",
]);

export default async function HomePage() {
  const { t, locale } = await getTranslator();
  const session = await getSession();
  const cities = await getCities();
  const city = await getPreferredCity(cities);
  const cityLabel = locale === "ar" ? city.nameAr : city.name;
  const stores = await getStores();
  const localStores = stores.filter((store) => store.citySlug === city.slug);
  const localPharmacies = localStores.filter(
    (store) => store.category === "pharmacy",
  );
  const pharmacyPartner = stores.find((store) => store.category === "pharmacy");
  const pharmacyPartnerCity = cities.find(
    (city) => city.slug === pharmacyPartner?.citySlug,
  );
  const [user, orders, rides] = await Promise.all([
    session ? getUserById(session.userId) : Promise.resolve(undefined),
    session?.email
      ? getOrderViews({ customerEmail: session.email })
      : Promise.resolve([]),
    session?.role === "customer"
      ? getTaxiRides({ customerId: session.userId, limit: 5 })
      : Promise.resolve([]),
  ]);
  const activeOrders = orders.filter((order) => ORDER_ACTIVE.has(order.status)).slice(0, 2);
  const activeRides = rides.filter(
    (ride) => !["completed", "cancelled"].includes(ride.status),
  ).slice(0, 1);
  const openNow = localStores.filter((store) => getOpenState(store).open).length;
  const picks = localStores
    .filter(
      (store) =>
        (store.category === "restaurant" || store.category === "cafe") &&
        getOpenState(store).open,
    )
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, 3);
  const name = user?.name?.split(" ")[0] || session?.name?.split(" ")[0];

  const launcher = [
    {
      href: `/city/${city.slug}`,
      label: t("Food to go"),
      note: t("Restaurants, cafés and delivery"),
      detail: t("{count} open now", { count: openNow }),
      icon: UtensilsCrossed,
    },
    {
      href: "/grocery",
      label: t("Grocery"),
      note: t("Supermarkets and essentials"),
      detail: t("Delivery or pickup"),
      icon: ShoppingBasket,
    },
    {
      href: `/pharmacy?city=${city.slug}`,
      label: t("Pharmacy"),
      note: t("Health, baby and personal care"),
      detail: localPharmacies.length
        ? localPharmacies.length === 1
          ? t("1 partner online")
          : t("{count} partners online", { count: localPharmacies.length })
        : t("Licensed partners"),
      icon: Pill,
    },
    {
      href: "/taxi",
      label: t("Taxi"),
      note: t("Cash fare, live route"),
      detail: t("Local and intercity"),
      icon: CarTaxiFront,
    },
  ];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <PromoTicker
        citySlug={city.slug}
        cityName={cityLabel}
        pharmacyLive={localPharmacies.length > 0}
        pharmacyCity={
          pharmacyPartnerCity
            ? locale === "ar"
              ? pharmacyPartnerCity.nameAr
              : pharmacyPartnerCity.name
            : ""
        }
      />
      <main className="pb-[112px] md:pb-12">
        <section className="figma-hero">
          <div className="figma-hero-inner">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[12px] font-medium opacity-80">
                  {t("Now delivering in {city}", { city: cityLabel })}
                </div>
                <h1 className="figma-hero-title">
                  {name ? t("Salam, {name}.", { name }) : t("What do you need today?")}
                </h1>
                <p className="mt-2 max-w-[48ch] text-[14px] leading-6 opacity-85">
                  {t("One app for food, groceries, pharmacy and rides.")}
                </p>
              </div>
              <div className="hidden text-end sm:block">
                <div className="text-[11px] opacity-75">{t("Open now")}</div>
                <div className="text-[30px] font-semibold leading-none tnum">{openNow}</div>
              </div>
            </div>

            <form action="/search" method="get" className="figma-search" role="search">
              <Search size={18} className="ms-1 shrink-0 text-muted" />
              <input
                name="q"
                placeholder={t("Search food, groceries, rides…")}
                aria-label={t("Search Wassl")}
              />
              <input type="hidden" name="city" value={city.slug} />
              <button type="submit" className="btn btn-primary h-11 shrink-0 px-5">
                {t("Search")}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/orders" className="figma-chip">
                <ReceiptText size={13} /> {t("My orders")}
              </Link>
              <Link href="/messages" className="figma-chip">
                <MessageCircle size={13} /> {t("Messages")}
              </Link>
              <Link href="/account/loyalty" className="figma-chip">
                <Sparkles size={13} /> {t("Wassl Club")}
              </Link>
            </div>
          </div>
        </section>

        <div className="figma-sheet">
          <div className="container-wassl pt-5">

        {activeOrders.length || activeRides.length ? (
          <section className="mt-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("In progress")}
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {activeOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="aero-tile flex items-center gap-3 rounded-[10px] border p-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-brand-soft text-brand">
                    <ReceiptText size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {order.store?.name || t("Order")} · {order.code}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {t(order.status.replace("_", " "))} · {money(order.total)}
                    </span>
                  </span>
                  <ArrowRight size={13} className="text-muted" />
                </Link>
              ))}
              {activeRides.map((ride) => (
                <Link
                  key={ride.id}
                  href={`/taxi/${ride.id}`}
                  className="aero-tile flex items-center gap-3 rounded-[10px] border p-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-[6px] bg-brand-soft text-brand">
                    <CarTaxiFront size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">
                      {ride.pickupLabel} → {ride.dropoffLabel}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {t(ride.status)} · {money(ride.fare)}
                    </span>
                  </span>
                  <ArrowRight size={13} className="text-muted" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-1" aria-label={t("Services")}>
          <div className="figma-cats">
            {launcher.map((item) => (
              <Link key={item.href} href={item.href} className="figma-cat group">
                <span className="figma-cat-icon">
                  <item.icon size={27} strokeWidth={1.6} />
                </span>
                <span className="figma-cat-label">{item.label}</span>
                <span className="figma-cat-note">{item.detail}</span>
              </Link>
            ))}
          </div>
        </section>

        <Link href={`/city/${city.slug}`} className="figma-promo mt-6">
          <div>
            <div className="figma-promo-kicker">
              {t("Cash on delivery · prices in MAD")}
            </div>
            <div className="figma-promo-title">
              {t("Local favourites, delivered across the South.")}
            </div>
            <span className="figma-promo-cta">
              {t("Order now")} <ArrowRight size={13} className="rtl:-scale-x-100" />
            </span>
          </div>
          <UtensilsCrossed
            size={70}
            strokeWidth={1.2}
            className="relative z-10 hidden opacity-70 sm:block"
            aria-hidden="true"
          />
        </Link>

        {picks.length ? (
          <section className="mt-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="headline">{t("Best seller")}</h2>
                <p className="mt-1 text-[11px] text-muted">
                  {t("Top-rated kitchens delivering today.")}
                </p>
              </div>
              <Link
                href={`/city/${city.slug}`}
                className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brand"
              >
                {t("View all")} <ArrowRight size={13} className="rtl:-scale-x-100" />
              </Link>
            </div>
            <div className="figma-row mt-3">
              {picks.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
            <Link
              href={`/city/${city.slug}`}
              className="btn btn-ghost mt-3 h-11 w-full justify-center sm:hidden"
            >
              {t("See all restaurants and cafés")} <ArrowRight size={13} />
            </Link>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-line py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
            <span>{t("Wassl · cash on delivery · prices in MAD")}</span>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/orders" className="hover:text-ink">{t("Orders")}</Link>
              <Link href="/cities" className="hover:text-ink">{t("Cities")}</Link>
              <Link href="/messages" className="hover:text-ink">{t("Support")}</Link>
              <Link href="/account" className="hover:text-ink">{t("Account")}</Link>
              <a href="tel:+212660000000" className="inline-flex items-center gap-1 hover:text-ink">
                <Headphones size={11} /> {t("Call")}
              </a>
            </div>
          </div>
        </footer>
          </div>
        </div>
      </main>
    </>
  );
}
