import { getCities } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { SignupForm } from "./signup-form";

export type SignupMode = "customer" | "merchant" | "driver";

export async function SignupShell({
  mode,
  defaultKind = "delivery",
}: {
  mode: SignupMode;
  defaultKind?: "delivery" | "taxi" | "both";
}) {
  const cities = await getCities();
  const preferredCity = await getPreferredCity(cities);

  return (
    <SignupForm
      initialRole={mode}
      initialKind={defaultKind}
      defaultCitySlug={preferredCity.slug}
      lockedRole={mode !== "customer"}
      cities={cities.map((city) => ({
        slug: city.slug,
        name: city.name,
        priority: city.priority,
      }))}
    />
  );
}
