import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";

export default async function OnboardingPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== "business" && role !== "promoter") notFound();
  return <OnboardingFlow role={role} />;
}
