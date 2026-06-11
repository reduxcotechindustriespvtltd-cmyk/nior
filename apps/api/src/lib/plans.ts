export type PlanId = "FREE" | "STARTER" | "PRO" | "AGENCY" | "ENTERPRISE";
export type BillingInterval = "monthly" | "annual";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceMonthlyInr: number | null;
  priceAnnualInr: number | null;
  sitesLimit: number | null;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "FREE",
    name: "Free",
    description: "Perfect for personal projects",
    priceMonthlyInr: 0,
    priceAnnualInr: 0,
    sitesLimit: 1,
    features: [
      "1 site",
      "All kill modes",
      "Event history (last 10)",
      "Community support",
    ],
  },
  {
    id: "STARTER",
    name: "Starter",
    description: "For small teams and indie developers",
    priceMonthlyInr: 499,
    priceAnnualInr: 4990,
    sitesLimit: 5,
    features: [
      "5 sites",
      "All kill modes",
      "Full event history",
      "API key access",
      "Email support",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    description: "For growing businesses",
    priceMonthlyInr: 1499,
    priceAnnualInr: 14990,
    sitesLimit: 20,
    highlighted: true,
    features: [
      "20 sites",
      "All kill modes",
      "Full event history",
      "API key access",
      "Webhook notifications",
      "Priority support",
    ],
  },
  {
    id: "AGENCY",
    name: "Agency",
    description: "For agencies managing client sites",
    priceMonthlyInr: 3999,
    priceAnnualInr: 39990,
    sitesLimit: 100,
    features: [
      "100 sites",
      "All kill modes",
      "Full event history",
      "Unlimited API keys",
      "Webhook notifications",
      "White-label option",
      "Priority support",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom plans for large organisations",
    priceMonthlyInr: null,
    priceAnnualInr: null,
    sitesLimit: null,
    features: [
      "Unlimited sites",
      "SSO / SAML",
      "Custom SLAs",
      "Dedicated support",
      "On-premise option",
    ],
  },
];

export const PLAN_SITES_LIMIT: Record<PlanId, number> = {
  FREE: 1,
  STARTER: 5,
  PRO: 20,
  AGENCY: 100,
  ENTERPRISE: 999999,
};

export function getPlan(planId: string): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getPlanAmountPaisa(
  planId: string,
  interval: BillingInterval
): number | null {
  const plan = getPlan(planId);
  if (!plan) return null;

  const inr =
    interval === "annual" ? plan.priceAnnualInr : plan.priceMonthlyInr;
  if (inr == null || inr <= 0) return null;

  return inr * 100;
}

export function getPeriodEnd(interval: BillingInterval): Date {
  const end = new Date();
  if (interval === "annual") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export const PUBLIC_PLANS = PLANS.map(
  ({
    priceMonthlyInr,
    priceAnnualInr,
    ...rest
  }) => ({
    ...rest,
    priceMonthly: priceMonthlyInr,
    priceAnnual: priceAnnualInr,
    currency: "INR" as const,
  })
);
