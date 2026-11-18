"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CarTaxiFront,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import { useI18n } from "@/components/locale-provider";
import { AuthButton, AuthShell } from "@/components/auth-shell";

type Role = "customer" | "merchant" | "driver";

const ROLES: {
  id: Role;
  label: string;
  hint: string;
  icon: typeof ShoppingBag;
}[] = [
  {
    id: "customer",
    label: "Customer",
    hint: "Order from local stores. Active immediately.",
    icon: ShoppingBag,
  },
  {
    id: "merchant",
    label: "Store owner",
    hint: "Sell on Wassl. Needs operations approval.",
    icon: Store,
  },
  {
    id: "driver",
    label: "Courier",
    hint: "Deliver with Wassl. Needs operations approval.",
    icon: Bike,
  },
];

type CityOption = { slug: string; name: string; priority: boolean };

export function SignupForm({
  initialRole,
  initialKind = "delivery",
  defaultCitySlug,
  lockedRole = false,
  cities,
}: {
  initialRole: Role;
  initialKind?: "delivery" | "taxi" | "both";
  defaultCitySlug?: string;
  lockedRole?: boolean;
  cities: CityOption[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [role, setRole] = useState<Role>(initialRole);
  const [kind, setKind] = useState<"delivery" | "taxi" | "both">(initialKind);
  const [plate, setPlate] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [citySlug, setCitySlug] = useState(defaultCitySlug || "dakhla");
  const [storeName, setStoreName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const selectedRole = ROLES.find((item) => item.id === role)!;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8;
  const nameValid = name.trim().length >= 2;
  const phoneValid = phone.replace(/\D/g, "").length >= 9;
  const detailsValid =
    (role !== "merchant" || storeName.trim().length > 0) &&
    (role !== "driver" || kind !== "taxi" || plate.trim().length > 0);
  const stepOneValid = nameValid && emailValid && passwordValid && phoneValid;
  const canSubmit = stepOneValid && detailsValid;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (step === 1) {
      if (stepOneValid) setStep(2);
      return;
    }
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          phone: phone || undefined,
          citySlug,
          storeName: role === "merchant" ? storeName : undefined,
          vehicle: role === "driver" ? vehicle : undefined,
          kind: role === "driver" ? kind : undefined,
          plate: role === "driver" ? plate : undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
        needsApproval?: boolean;
        needsVerification?: boolean;
        email?: string;
      };
      if (!response.ok) {
        setError(data.error || t("Could not create the account"));
        return;
      }
      if (data.needsVerification) {
        const target =
          data.redirect ||
          `/verify-email?email=${encodeURIComponent(data.email || email.trim().toLowerCase())}`;
        router.push(target);
        return;
      }
      router.push(data.redirect || "/account");
      router.refresh();
    } catch {
      setError(t("Could not reach Wassl. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell variant="signup">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">
          {role === "merchant"
            ? t("Store partner")
            : role === "driver"
              ? kind === "taxi"
                ? t("Taxi partner")
                : t("Courier partner")
              : t("Customer account")}
        </p>
        <span className="text-[11px] font-semibold text-muted">
          {t("Step {step} of 2", { step })}
        </span>
      </div>

      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {[1, 2].map((segment) => (
          <span
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              step >= segment ? "bg-brand" : "bg-line"
            }`}
          />
        ))}
      </div>

      <h2 className="display mt-5 text-[clamp(1.9rem,1.5rem+1.2vw,2.6rem)]">
        {step === 1
          ? role === "merchant"
            ? t("Open your store")
            : role === "driver"
              ? t("Drive with Wassl")
              : t("Join Wassl")
          : role === "merchant"
            ? t("Where do you sell?")
            : role === "driver"
              ? t("What do you drive?")
              : t("Where should we deliver?")}
      </h2>
      <p className="mt-2 text-[13px] leading-6 text-muted">
        {step === 1
          ? t("Four fields, one minute. You can change everything later.")
          : t("This sets your city, your map and your dispatch queue.")}
      </p>

      {!lockedRole && step === 1 ? (
        <div className="mt-6 grid gap-2">
          {ROLES.map((item) => {
            const Icon = item.icon;
            const active = role === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRole(item.id);
                  setError("");
                }}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-[6px] border px-3 py-3 text-start outline-none transition-[border-color,background-color,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-paper motion-reduce:transition-none ${
                  active
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/60"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-[4px] ${
                    active ? "bg-brand text-on-dark" : "bg-surface-2 text-brand"
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">
                    {t(item.label)}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {t(item.hint)}
                  </span>
                </span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    active ? "border-brand bg-brand text-on-dark" : "border-line"
                  }`}
                >
                  {active ? <Check size={12} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4">
        {step === 1 ? (
          <>
            <label className="block">
              <span className="label">{t("Full name")}</span>
              <span className="relative block">
                <User size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="input h-12 ps-10"
                  placeholder={t("Your name")}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="label">{t("Email")}</span>
              <span className="relative block">
                <Mail size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input h-12 ps-10"
                  placeholder="you@example.ma"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="label">{t("Phone")}</span>
              <span className="relative block">
                <Phone size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="input h-12 ps-10"
                  placeholder="06 12 34 56 78"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="label">{t("Password")}</span>
              <span className="relative block">
                <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input h-12 ps-10 pe-12"
                  placeholder={t("At least 8 characters")}
                  autoComplete="new-password"
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
              <span className="mt-1.5 block text-[11px] text-muted">
                {password.length >= 8
                  ? t("Good, this password is long enough.")
                  : t("Eight characters or more.")}
              </span>
            </label>

            <div className="pt-1">
              <AuthButton
                disabled={!stepOneValid}
                icon={<ArrowRight size={17} className="rtl:-scale-x-100" />}
              >
                {t("Continue")}
              </AuthButton>
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <span className="label">{t("City")}</span>
              <span className="relative block">
                <MapPin size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <select
                  value={citySlug}
                  onChange={(event) => setCitySlug(event.target.value)}
                  className="input h-12 ps-10"
                >
                  {cities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            {role === "merchant" ? (
              <label className="block">
                <span className="label">{t("Store name")}</span>
                <span className="relative block">
                  <Store size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    className="input h-12 ps-10"
                    placeholder={t("e.g. Dakhla Grill")}
                    required
                  />
                </span>
              </label>
            ) : null}

            {role === "driver" ? (
              <>
                <div>
                  <span className="label">{t("Vehicle")}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "delivery" as const, label: t("Delivery"), icon: Bike },
                      { id: "taxi" as const, label: t("Taxi"), icon: CarTaxiFront },
                    ].map((option) => {
                      const Icon = option.icon;
                      const active = kind === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setKind(option.id)}
                          aria-pressed={active}
                          className={`flex h-12 items-center justify-center gap-2 rounded-[6px] border text-[13px] font-semibold transition-colors ${
                            active
                              ? "border-brand bg-brand-soft text-brand"
                              : "border-line bg-surface text-muted hover:border-brand/60"
                          }`}
                        >
                          <Icon size={16} /> {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="label">{t("Vehicle model")}</span>
                  <input
                    type="text"
                    value={vehicle}
                    onChange={(event) => setVehicle(event.target.value)}
                    className="input h-12"
                    placeholder={kind === "taxi" ? "Dacia Logan" : "Motorbike"}
                  />
                </label>

                <label className="block">
                  <span className="label">{t("Plate")}</span>
                  <input
                    type="text"
                    value={plate}
                    onChange={(event) => setPlate(event.target.value)}
                    className="input h-12 uppercase"
                    placeholder="12345-A-6"
                    required={kind === "taxi"}
                  />
                </label>
              </>
            ) : null}

            {error ? (
              <p className="rounded-[6px] border border-danger/25 bg-danger-soft px-3 py-2 text-[12px] font-medium leading-5 text-danger">
                {error}
              </p>
            ) : null}

            {role !== "customer" ? (
              <p className="flex items-start gap-2 rounded-[6px] bg-saffron/10 px-3 py-2.5 text-[11px] font-semibold leading-5 text-saffron-deep">
                <Check size={14} className="mt-0.5 shrink-0" />
                {t(
                  "Your account starts as pending. You can sign in, but your workspace unlocks only after a Wassl operator approves it.",
                )}
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
                    <Check size={17} />
                  )
                }
              >
                {loading ? t("Creating your account…") : t("Create account")}
              </AuthButton>
            </div>

            <AuthButton
              type="button"
              variant="quiet"
              icon={<ArrowLeft size={14} className="rtl:-scale-x-100" />}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              {t("Back to your details")}
            </AuthButton>
          </>
        )}
      </form>

      <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        {t("Already have an account?")}
        <Link href="/login" className="py-1 font-semibold text-brand hover:text-brand-deep">
          {t("Sign in")}
        </Link>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-4 text-[11px] font-semibold text-muted">
        <Link href="/" className="inline-flex min-h-[32px] items-center gap-1 transition-colors hover:text-ink">
          <ArrowLeft size={13} className="rtl:-scale-x-100" />
          {t("Back to storefront")}
        </Link>
        {role === "customer" ? (
          <>
            <Link href="/signup/store" className="inline-flex min-h-[32px] items-center text-brand hover:text-brand-deep">
              {t("Store partner")}
            </Link>
            <Link href="/signup/driver" className="inline-flex min-h-[32px] items-center text-brand hover:text-brand-deep">
              {t("Courier partner")}
            </Link>
          </>
        ) : (
          <Link href="/signup" className="inline-flex min-h-[32px] items-center text-brand hover:text-brand-deep">
            {t("Customer sign up")}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
