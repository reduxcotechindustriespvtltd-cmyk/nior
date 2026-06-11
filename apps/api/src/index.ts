import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

import { authRoutes } from "./routes/auth";
import { sitesRoutes } from "./routes/sites";
import { billingRoutes } from "./routes/billing";
import { keysRoutes } from "./routes/keys";
import { publicRoutes } from "./routes/public";

// ─────────────────────────────────────────────────────────────────────────────
// Environment helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton clients (attached to the Fastify instance via decorators)
// ─────────────────────────────────────────────────────────────────────────────

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "warn", "error"]
      : ["warn", "error"],
});

let redis: Redis | null = null

try {
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  })
  redis.on("error", () => { redis = null })
} catch {
  redis = null
}

// ─────────────────────────────────────────────────────────────────────────────
// Fastify type augmentation
// ─────────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis | null;
  }
  interface FastifyRequest {
    // Populated by the authenticate preHandler
    jwtUser: {
      userId: string;
      email: string;
      plan: string;
    };
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      plan: string;
    };
    user: {
      userId: string;
      email: string;
      plan: string;
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build application
// ─────────────────────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  });

  // ── Decorators ──────────────────────────────────────────────────────────────
  app.decorate("prisma", prisma);
  app.decorate("redis", redis);

  // ── Plugins ─────────────────────────────────────────────────────────────────

  await app.register(cookie)

  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: requireEnv("JWT_SECRET"),
    sign: { expiresIn: "15m" },
    cookie: {
      cookieName: "refreshToken",
      signed: false,
    },
  });

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (request) =>
      request.headers["x-forwarded-for"]?.toString() ??
      request.ip ??
      "unknown",
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${context.after}.`,
    }),
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Specter API",
        description: "Specter SaaS — Kill-switch management backend",
        version: "1.0.0",
      },
      servers: [
        {
          url: process.env.API_BASE_URL ?? "http://localhost:4000",
          description: process.env.NODE_ENV === "production" ? "Production" : "Local",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // ── Route groups ─────────────────────────────────────────────────────────────

  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(sitesRoutes, { prefix: "/api/v1/sites" });
  await app.register(billingRoutes, { prefix: "/api/v1/billing" });
  await app.register(keysRoutes, { prefix: "/api/v1/keys" });
  await app.register(publicRoutes, { prefix: "/api/v1" }); // /js and /status/:token

  // ── Health check ─────────────────────────────────────────────────────────────

  app.get(
    "/health",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        description: "Health check",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      try {
        await prisma.user.findFirst({ select: { id: true } })
      } catch {
        reply.code(503).send({ status: "unhealthy", error: "database unreachable" })
        return
      }
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }
    }
  );

  // ── Global error handler ──────────────────────────────────────────────────────

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, "Unhandled error");

    // Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Validation failed",
        details: error.validation,
      });
    }

    // JWT errors
    if (error.name === "UnauthorizedError" || error.statusCode === 401) {
      return reply.code(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: error.message,
      });
    }

    // Known HTTP errors (thrown with reply.code(...).send or fastify.httpErrors)
    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({
      statusCode,
      error: statusCode === 500 ? "Internal Server Error" : error.name,
      message:
        statusCode === 500 && process.env.NODE_ENV === "production"
          ? "An unexpected error occurred."
          : error.message,
    });
  });

  // ── 404 handler ───────────────────────────────────────────────────────────────

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: "Not Found",
      message: "Route not found.",
    });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  // Connect Redis if available (optional — falls back to in-memory rate limiting)
  if (redis) {
    await redis.connect().catch(() => {
      app.log.warn("Redis unavailable — rate limiting using in-memory store")
    })
  }

  // Start server
  await app.listen({ port, host });
  app.log.info(`Specter API listening on ${host}:${port}`);

  // ── Graceful shutdown ─────────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully shutting down…`);
    await app.close();
    await prisma.$disconnect();
    if (redis) await redis.quit()
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    app.log.error({ err }, "Uncaught exception");
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    app.log.error({ reason }, "Unhandled promise rejection");
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
