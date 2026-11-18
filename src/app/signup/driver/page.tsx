import { SignupShell } from "../signup-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Driver sign up" };

export default function DriverSignupPage() {
  return <SignupShell mode="driver" />;
}
