"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CarTaxiFront,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { AuthButton, AuthShell } from "@/components/auth-shell";

export function LoginForm({
  next,
  blocked,
}: {
  next?: string;
  blocked?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    blocked ? "This account was not approved. Contact Wassl operations." : "",
  );
  const [loading, setLoading] = useState(false);

  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length > 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
        role?: string;
        needsApproval?: boolean;
        needsVerification?: boolean;
        email?: string;
      };
      if (!response.ok) {
        setError(data.error || "Could not sign in");
        return;
      }
      if (data.needsVerification) {
        const target =
          data.redirect ||
          `/verify-email?email=${encodeURIComponent(data.email || email.trim().toLowerCase())}`;
        router.push(target);
        return;
      }
      const safeNext =
        next && /^[a-z0-9][a-z0-9/_-]*$/i.test(next) ? `/${next}` : null;
      const target = safeNext || data.redirect || "/";
      router.push(target);
      router.refresh();
    } catch {
      setError("Could not reach Wassl. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell variant="login">
      <p className="eyebrow">{t("Welcome back")}</p>
      <h2 className="display mt-2 text-[clamp(1.9rem,1.5rem+1.2vw,2.6rem)]">
        {t("Sign in")}
      </h2>
      <p className="mt-3 text-[13px] leading-6 text-muted">
        {t("Use the email and password you signed up with.")}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block">
          <span className="label">{t("Email")}</span>
          <span className="relative block">
            <Mail
              size={16}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input h-12 ps-10"
              placeholder="you@example.ma"
              autoComplete="email"
              autoFocus
              required
            />
          </span>
        </label>

        <label className="block">
          <span className="label">{t("Password")}</span>
          <span className="relative block">
            <Lock
              size={16}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input h-12 ps-10 pe-12"
              placeholder={t("Your password")}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute end-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[4px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={showPassword ? t("Hide password") : t("Show password")}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        {error ? (
          <p className="rounded-[6px] border border-danger/25 bg-danger-soft px-3 py-2 text-[12px] font-medium leading-5 text-danger">
            {error}
          </p>
        ) : null}

        <div className="pt-1">
          <AuthButton
            loading={loading}
            disabled={!canSubmit}
            icon={
              loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <ArrowRight size={17} className="rtl:-scale-x-100" />
              )
            }
          >
            {loading ? t("Signing in…") : t("Sign in")}
          </AuthButton>
        </div>
      </form>

      <div className="mt-7 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-semibold text-muted">
          {t("No account yet?")}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          { href: "/signup", label: t("Customer"), hint: t("Order food and groceries"), icon: ShoppingBag },
          { href: "/signup/store", label: t("Store owner"), hint: t("Sell on Wassl"), icon: Store },
          { href: "/signup/driver", label: t("Courier"), hint: t("Deliver by bike or car"), icon: Bike },
          { href: "/signup/taxi", label: t("Taxi driver"), hint: t("Drive local rides"), icon: CarTaxiFront },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-[6px] border border-line bg-surface px-3 py-3 text-start outline-none transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-paper motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] bg-brand-soft text-brand">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-ink">
                  {item.label}
                </span>
                <span className="block truncate text-[10.5px] text-muted">
                  {item.hint}
                </span>
              </span>
              <ArrowRight
                size={14}
                className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              />
            </Link>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" />
        {t(
          "Store and courier accounts open after a Wassl operator checks your details. Customers are active immediately.",
        )}
      </p>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-ink lg:hidden"
      >
        <ArrowLeft size={12} className="rtl:-scale-x-100" />
        {t("Back to storefront")}
      </Link>
    </AuthShell>
  );
}
