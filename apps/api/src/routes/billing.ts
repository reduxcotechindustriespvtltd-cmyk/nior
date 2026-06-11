import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import {
  PUBLIC_PLANS,
  getPlan,
  getPlanAmountPaisa,
  getPeriodEnd,
  PLAN_SITES_LIMIT,
  type BillingInterval,
  type PlanId,
} from "../lib/plans";
import {
  createMerchantOrderId,
  createPhonePePayment,
  getPhonePeOrderStatus,
} from "../services/phonepe";

async function activateSubscription(
  userId: string,
  planId: PlanId,
  interval: BillingInterval
) {
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: planId,
      status: "ACTIVE",
      currentPeriodEnd: getPeriodEnd(interval),
      sitesLimit: PLAN_SITES_LIMIT[planId] ?? 1,
    },
    update: {
      plan: planId,
      status: "ACTIVE",
      currentPeriodEnd: getPeriodEnd(interval),
      sitesLimit: PLAN_SITES_LIMIT[planId] ?? 1,
    },
  });
}

export async function billingRoutes(app: FastifyInstance) {
  // ── GET /billing/plans ──────────────────────────────────────────────────────

  app.get(
    "/plans",
    {
      schema: {
        description: "Retrieve available subscription plans and pricing (INR)",
        tags: ["billing"],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({ plans: PUBLIC_PLANS });
    }
  );

  // ── POST /billing/checkout ────────────────────────────────────────────────────

  app.post(
    "/checkout",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a PhonePe checkout session to upgrade the plan",
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
      const { userId } = request.jwtUser;
      const { planId, interval = "monthly" } = request.body as {
        planId: string;
        interval?: BillingInterval;
      };

      const plan = getPlan(planId);
      if (!plan || planId === "FREE" || planId === "ENTERPRISE") {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Invalid plan selected for checkout.",
        });
      }

      const amountPaisa = getPlanAmountPaisa(planId, interval);
      if (!amountPaisa) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "This plan cannot be purchased online.",
        });
      }

      const merchantOrderId = createMerchantOrderId(userId);
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const redirectUrl = `${appUrl}/dashboard/billing/success?orderId=${encodeURIComponent(merchantOrderId)}`;

      await prisma.payment.create({
        data: {
          userId,
          merchantOrderId,
          planId: planId as PlanId,
          interval,
          amountPaisa,
          status: "PENDING",
        },
      });

      try {
        const session = await createPhonePePayment({
          merchantOrderId,
          amountPaisa,
          redirectUrl,
          metaInfo: {
            udf1: userId,
            udf2: planId,
            udf3: interval,
          },
        });

        await prisma.payment.update({
          where: { merchantOrderId },
          data: { phonePeOrderId: session.orderId },
        });

        return reply.code(200).send({
          url: session.redirectUrl,
          merchantOrderId,
          orderId: session.orderId,
        });
      } catch (err: unknown) {
        await prisma.payment.update({
          where: { merchantOrderId },
          data: { status: "FAILED" },
        });
        const message = err instanceof Error ? err.message : "Payment initiation failed";
        app.log.error({ err }, "PhonePe checkout failed");
        return reply.code(502).send({
          statusCode: 502,
          error: "Bad Gateway",
          message,
        });
      }
    }
  );

  // ── POST /billing/verify ──────────────────────────────────────────────────────

  app.post(
    "/verify",
    {
      preHandler: [authenticate],
      schema: {
        description: "Verify PhonePe payment and activate subscription",
        tags: ["billing"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["merchantOrderId"],
          properties: {
            merchantOrderId: { type: "string" },
            mock: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser;
      const { merchantOrderId, mock } = request.body as {
        merchantOrderId: string;
        mock?: boolean;
      };

      const payment = await prisma.payment.findUnique({
        where: { merchantOrderId },
      });

      if (!payment || payment.userId !== userId) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Payment not found.",
        });
      }

      if (payment.status === "COMPLETED") {
        return reply.code(200).send({
          status: "COMPLETED",
          plan: payment.planId,
          message: "Subscription already active.",
        });
      }

      let orderState: string;

      if (process.env.PHONEPE_MOCK === "true" || mock) {
        orderState = "COMPLETED";
      } else {
        const status = await getPhonePeOrderStatus(merchantOrderId);
        orderState = status.state;
      }

      if (orderState === "COMPLETED") {
        await prisma.payment.update({
          where: { merchantOrderId },
          data: { status: "COMPLETED" },
        });

        await activateSubscription(
          userId,
          payment.planId as PlanId,
          payment.interval as BillingInterval
        );

        return reply.code(200).send({
          status: "COMPLETED",
          plan: payment.planId,
          message: "Payment successful. Your plan is now active.",
        });
      }

      if (orderState === "FAILED") {
        await prisma.payment.update({
          where: { merchantOrderId },
          data: { status: "FAILED" },
        });
        return reply.code(402).send({
          status: "FAILED",
          message: "Payment failed. Please try again.",
        });
      }

      return reply.code(202).send({
        status: orderState,
        message: "Payment is still processing. Please wait a moment and refresh.",
      });
    }
  );

  // ── GET /billing/payments ─────────────────────────────────────────────────────

  app.get(
    "/payments",
    {
      preHandler: [authenticate],
      schema: {
        description: "List recent payments for the authenticated user",
        tags: ["billing"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser;

      const payments = await prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          merchantOrderId: true,
          planId: true,
          interval: true,
          amountPaisa: true,
          status: true,
          createdAt: true,
        },
      });

      return reply.code(200).send({ payments });
    }
  );
}
