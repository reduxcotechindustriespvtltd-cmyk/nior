import { FastifyRequest, FastifyReply } from "fastify";
import { Plan } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Plan hierarchy — used by requirePlan to compare levels
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  AGENCY: 3,
  ENTERPRISE: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// authenticate
// Verify the Bearer JWT and attach the decoded payload to request.jwtUser.
// Usage: add as a preHandler on any route that needs authentication.
// ─────────────────────────────────────────────────────────────────────────────

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // jwtVerify populates request.user via @fastify/jwt
    await request.jwtVerify();
    // Mirror to the explicit jwtUser field so routes have a typed reference
    request.jwtUser = request.user as {
      userId: string;
      email: string;
      plan: string;
    };
  } catch (err) {
    reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or expired token.",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// requirePlan
// Factory that returns a preHandler enforcing a minimum subscription plan.
// Must be used AFTER authenticate (relies on request.jwtUser.plan).
//
// Usage:
//   preHandler: [authenticate, requirePlan("PRO")]
// ─────────────────────────────────────────────────────────────────────────────

export function requirePlan(minimumPlan: Plan) {
  return async function planGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const userPlan = (request.jwtUser?.plan ?? "FREE") as Plan;
    const userRank = PLAN_RANK[userPlan] ?? 0;
    const requiredRank = PLAN_RANK[minimumPlan] ?? 0;

    if (userRank < requiredRank) {
      reply.code(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: `This feature requires the ${minimumPlan} plan or higher. Your current plan: ${userPlan}.`,
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers exported for route use
// ─────────────────────────────────────────────────────────────────────────────

export { PLAN_RANK };
