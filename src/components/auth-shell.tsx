"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/components/locale-provider";

/** The corridor: Dakhla → Laâyoune → Boujdour → Esmara → Tarfaya. */
function CorridorLine({ className = "" }: { className?: string }) {
  const stops = [10, 86, 158, 232, 300];
  return (
    <svg
      viewBox="0 0 310 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1="10"
        y1="12"
        x2="300"
        y2="12"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="1 5"
        opacity="0.55"
      />
      {stops.map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy="12"
          r={index === 0 ? 3.2 : 2}
          fill="currentColor"
          opacity={index === 0 ? 1 : 0.45}
        />
      ))}
    </svg>
  );
}

export function AuthShell({
  variant,
  children,
}: {
  variant: "login" | "signup";
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-paper lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <aside className="relative hidden overflow-hidden bg-ink text-on-dark lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Image
          src="/images/stores/moroccan-2.jpg"
          alt=""
          fill
          priority
          sizes="60vw"
          className="object-cover opacity-25"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/40"
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between">
          <Logo light />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-on-dark/50 transition-colors hover:text-on-dark"
          >
            <ArrowLeft size={14} className="rtl:-scale-x-100" />
            {t("Storefront")}
          </Link>
        </div>

        <div className="relative">
          <p className="text-[12px] font-semibold text-saffron">
            {variant === "login"
              ? t("Dakhla · Laâyoune · Boujdour · Esmara · Tarfaya")
              : t("One minute to your first order")}
          </p>
          <h1 className="display mt-4 max-w-[22ch] text-[clamp(2.6rem,1.4rem+2.8vw,4.1rem)] leading-[0.98]">
            {variant === "login"
              ? t("Back on the road.")
              : t("Your city, delivered.")}
          </h1>
          <p className="mt-5 max-w-[34ch] text-[14px] leading-6 text-on-dark/60">
            {variant === "login"
              ? t(
                  "Customers, stores, couriers and operations sign in here. Cash on delivery, tracked door to door.",
                )
              : t(
                  "Order from the shops down your street. Pay cash at the door, follow the courier on the map.",
                )}
          </p>

          <CorridorLine className="mt-10 h-6 w-full max-w-[310px] text-saffron" />

          <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[
              ["209", t("cities")],
              ["COD", t("cash on delivery")],
              ["24/7", t("local support")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="tnum font-display text-[24px] font-semibold leading-none">
                  {value}
                </dt>
                <dd className="mt-2 text-[11px] leading-4 text-on-dark/45">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-[11px] text-on-dark/25">
          {t("Wassl · وصّل · from the store to your door")}
        </p>
      </aside>

      <section className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 lg:px-10">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-1 items-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>

        <footer className="px-5 pb-6 sm:px-8 lg:px-10">
          <p className="text-[11px] leading-5 text-muted">
            {t("By continuing you accept the Wassl terms and privacy policy.")}
          </p>
        </footer>
      </section>
    </main>
  );
}

/** Large, unmistakable primary action. */
export function AuthButton({
  children,
  loading,
  disabled,
  icon,
  variant = "primary",
  type = "submit",
  onClick,
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  const base =
    "group flex w-full items-center justify-center gap-2.5 rounded-[6px] text-[15px] font-semibold outline-none transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  const styles =
    variant === "primary"
      ? "h-13 min-h-[52px] bg-brand text-on-dark shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--brand)_75%,transparent)] hover:-translate-y-0.5 hover:bg-brand-deep active:translate-y-0"
      : variant === "secondary"
        ? "h-13 min-h-[52px] border border-line-strong bg-surface text-ink hover:-translate-y-0.5 hover:border-brand hover:text-brand active:translate-y-0"
        : "h-11 min-h-[44px] text-[13px] font-semibold text-muted hover:text-brand";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${styles}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
