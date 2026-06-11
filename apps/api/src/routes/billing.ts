import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Readable } from "stream";
import Stripe from "stripe";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Stripe client
// ─────────────────────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-04-10" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan catalogue
// This is the single source of truth — keep in sync with your Stripe dashboard
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = [
  {
    id: "FREE",
    name: "Free",
    description: "Perfect for personal projects",
    priceMonthly: 0,
    priceAnnual: 0,
    sitesLimit: 1,
    features: [
      "1 site",
      "All kill modes",
      "Event history (last 10)",
      "Community support",
    ],
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
  },
  {
    id: "STARTER",
    name: "Starter",
    description: "For small teams and indie developers",
    priceMonthly: 9,
    priceAnnual: 90,
    sitesLimit: 5,
    features: [
      "5 sites",
      "All kill modes",
      "Full event history",
      "API key access",
      "Email support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? null,
  },
  {
    id: "PRO",
    name: "Pro",
    description: "For growing businesses",
    priceMonthly: 29,
    priceAnnual: 290,
    sitesLimit: 20,
    features: [
      "20 sites",
      "All kill modes",
      "Full event history",
      "API key access",
      "Webhook notifications",
      "Priority support",
    ],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? null,
  },
  {
    id: "AGENCY",
    name: "Agency",
    description: "For agencies managing client sites",
    priceMonthly: 79,
    priceAnnual: 790,
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
    stripePriceIdMonthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY ?? null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_AGENCY_ANNUAL ?? null,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom plans for large organisations",
    priceMonthly: null,
    priceAnnual: null,
    sitesLimit: null,
    features: [
      "Unlimited sites",
      "SSO / SAML",
      "Custom SLAs",
      "Dedicated support",
      "On-premise option",
    ],
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
  },
] as const;

// Map plan id -> sites limit (mirrors DB default logic)
const PLAN_SITES_LIMIT: Record<string, number> = {
  FREE: 1,
  STARTER: 5,
  PRO: 20,
  AGENCY: 100,
  ENTERPRISE: 999999,
};

// ─────────────────────────────────────────────────────────────────────────────
// Webhook event handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  if (!userId || !planId) return;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const stripe = getStripe();
  let currentPeriodEnd: Date | undefined;
  if (stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    currentPeriodEnd = new Date(sub.current_period_end * 1000);
  }

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: planId as any,
      status: "ACTIVE",
      stripeSubscriptionId: stripeSubscriptionId ?? null,
      currentPeriodEnd: currentPeriodEnd ?? null,
      sitesLimit: PLAN_SITES_LIMIT[planId] ?? 1,
    },
    update: {
      plan: planId as any,
      status: "ACTIVE",
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
      currentPeriodEnd: currentPeriodEnd ?? undefined,
      sitesLimit: PLAN_SITES_LIMIT[planId] ?? 1,
    },
  });

  // Keep stripeCustomerId in sync
  if (session.customer) {
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const existingSub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
  });
  if (!existingSub) return;

  // Derive plan from price metadata if available
  const priceId = sub.items.data[0]?.price.id;
  const allPlans = PLANS.filter((p) => p.stripePriceIdMonthly || p.stripePriceIdAnnual);
  const matched = allPlans.find(
    (p) => p.stripePriceIdMonthly === priceId || p.stripePriceIdAnnual === priceId
  );
  const newPlan = (matched?.id as any) ?? existingSub.plan;

  await prisma.subscription.update({
    where: { id: existingSub.id },
    data: {
      plan: newPlan,
      status: sub.status.toUpperCase().replace(/-/g, "_") as any,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      sitesLimit: PLAN_SITES_LIMIT[newPlan] ?? existingSub.sitesLimit,
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      plan: "FREE",
      status: "CANCELED",
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      sitesLimit: 1,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────

export async function billingRoutes(app: FastifyInstance) {
  // ── GET /billing/plans ────────────────────────────────────────────────────────
  // Public — no auth required

  app.get(
    "/plans",
    {
      schema: {
        description: "Retrieve available subscription plans and pricing",
        tags: ["billing"],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Strip sensitive Stripe price IDs from the public response
      const publicPlans = PLANS.map(({ stripePriceIdMonthly, stripePriceIdAnnual, ...rest }) => rest);
      return reply.code(200).send({ plans: publicPlans });
    }
  );

  // ── POST /billing/checkout ────────────────────────────────────────────────────
  // Requires auth

  app.post(
    "/checkout",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a Stripe Checkout session to upgrade the plan",
        tags: ["billing"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["planId"],
          properties: {
            planId: { type: "string", enum: ["STARTER", "PRO", "AGENCY"] },
            interval: { type: "string", enum: ["monthly", "annual"], default: "monthly" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, email } = request.jwtUser;
      const { planId, interval = "monthly" } = request.body as {
        planId: string;
        interval?: "monthly" | "annual";
      };

      // Resolve plan config
      const plan = PLANS.find((p) => p.id === planId);
      if (!plan || planId === "FREE" || planId === "ENTERPRISE") {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid plan selected for checkout.",
        });
      }

      const priceId =
        interval === "annual" ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
      if (!priceId) {
        return reply.code(503).send({
          statusCode: 503,
          error: "Service Unavailable",
          message: "Stripe price IDs are not configured for this plan.",
        });
      }

      const stripe = getStripe();
      const user = await prisma.user.findUnique({ where: { id: userId } });

      // Reuse existing Stripe customer if present
      let customerId = user?.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { userId },
        });
        customerId = customer.id;
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      }

      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { userId, planId },
        success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/billing/cancel`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { userId, planId },
        },
      });

      return reply.code(200).send({ url: session.url, sessionId: session.id });
    }
  );

  // ── POST /billing/portal ──────────────────────────────────────────────────────

  app.post(
    "/portal",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a Stripe Customer Portal session for subscription management",
        tags: ["billing"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.stripeCustomerId) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "No Stripe customer record found. Please purchase a plan first.",
        });
      }

      const stripe = getStripe();
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${appUrl}/billing`,
      });

      return reply.code(200).send({ url: portalSession.url });
    }
  );

  // ── POST /billing/webhook ─────────────────────────────────────────────────────
  // Public — verified via Stripe signature. Must receive raw body.

  app.post(
    "/webhook",
    {
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks);
        (request as unknown as { rawBody: Buffer }).rawBody = raw;
        return Readable.from(raw);
      },
      schema: {
        description: "Stripe webhook receiver",
        tags: ["billing"],
        // No security — Stripe signs the request
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        app.log.error("STRIPE_WEBHOOK_SECRET is not set");
        return reply.code(500).send({ error: "Webhook secret not configured" });
      }

      const signature = request.headers["stripe-signature"];
      if (!signature) {
        return reply.code(400).send({ error: "Missing stripe-signature header" });
      }

      const stripe = getStripe();
      let event: Stripe.Event;

      try {
        const rawBody: Buffer =
          (request as unknown as { rawBody?: Buffer }).rawBody ??
          Buffer.from(JSON.stringify(request.body));
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature as string,
          webhookSecret
        );
      } catch (err: any) {
        app.log.warn(`Stripe webhook signature verification failed: ${err.message}`);
        return reply.code(400).send({ error: `Webhook error: ${err.message}` });
      }

      app.log.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
            break;

          case "customer.subscription.updated":
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const subId =
              typeof invoice.subscription === "string"
                ? invoice.subscription
                : invoice.subscription?.id;
            if (subId) {
              await prisma.subscription.updateMany({
                where: { stripeSubscriptionId: subId },
                data: { status: "PAST_DUE" },
              });
            }
            break;
          }

          default:
            app.log.debug(`Unhandled Stripe event type: ${event.type}`);
        }
      } catch (handlerErr: any) {
        app.log.error({ err: handlerErr, eventType: event.type }, "Webhook handler error");
        // Return 200 to prevent Stripe retries for application-level errors
        // (retrying would not fix them). Return 500 only for transient DB failures.
        return reply.code(200).send({ received: true, warning: "Handler error logged" });
      }

      return reply.code(200).send({ received: true });
    }
  );
}
