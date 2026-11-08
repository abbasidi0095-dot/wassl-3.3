import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, ExternalLink, MapPin, Star } from "lucide-react";
import { getOpenState } from "@/lib/hours";
import { storePhoto } from "@/lib/store-images";
import type { Store } from "@/lib/types";
import { categoryLabel, money } from "@/lib/utils";

export function StoreCard({ store }: { store: Store }) {
  const hasRating = store.rating > 0 && store.reviews > 0;
  const openState = getOpenState(store);
  const mapsUrl =
    store.sourceUrl ||
    `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
  const tags = [...new Set([...(store.dietaryTags ?? []), ...(store.tags ?? [])])];

  return (
    <article className="figma-store group relative focus-within:ring-2 focus-within:ring-brand">
      <Link
        href={`/store/${store.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`Browse ${store.name}`}
      />
      <div className="pointer-events-none relative z-10">
        <div className="figma-store-image">
          <Image
            src={storePhoto(store)}
            alt={`${store.name} storefront`}
            fill
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 400px"
            className="object-cover"
          />
          <span className="figma-cat-chip">{categoryLabel(store.category)}</span>
          {hasRating ? (
            <span className="figma-rating">
              <Star size={11} className="fill-signal text-signal" />
              <span className="tnum">{store.rating.toFixed(1)}</span>
            </span>
          ) : null}
          <span className="figma-price tnum">{money(store.deliveryFee)}</span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-[20px] font-bold leading-tight tracking-[-0.02em]">
                {store.name}
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {store.nameAr ? (
                  <span className="arabic">{store.nameAr}</span>
                ) : (
                  store.landmark
                )}
              </p>
            </div>
          </div>

          <p className="mt-2 line-clamp-1 text-[13px] text-muted">{store.tagline}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted tnum">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={11} />
              {store.prepTime}–{store.prepTime + 10} min
            </span>
            <span>{money(store.minOrder)} min</span>
            {tags.slice(0, 1).map((tag) => (
              <span key={tag} className="truncate">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                openState.open ? "text-success" : "text-muted"
              }`}
              title={openState.detail}
            >
              <span
                className={`status-dot ${openState.open ? "live-dot" : ""}`}
                aria-hidden="true"
              />
              {openState.open ? "Open now" : "Closed"}
            </span>
            <span className="inline-flex items-center gap-2 text-[11px] text-muted">
              {hasRating ? (
                <span className="tnum">{store.reviews.toLocaleString("en-US")} reviews</span>
              ) : null}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="pointer-events-auto -m-1 inline-flex min-h-6 min-w-6 items-center justify-center gap-0.5 p-1 font-medium text-brand"
                aria-label={`View ${store.name} on Google Maps`}
              >
                <MapPin size={11} />
                <ExternalLink size={9} />
              </a>
              <ArrowUpRight
                size={12}
                className="text-line-strong transition-colors group-hover:text-ink"
              />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
