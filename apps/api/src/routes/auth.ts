import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../index";

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function issueTokens(
  app: FastifyInstance,
  payload: { userId: string; email: string; plan: string }
) {
  const accessToken = app.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = app.jwt.sign(
    { userId: payload.userId, tokenType: "refresh" },
    { expiresIn: REFRESH_TOKEN_TTL }
  );
  return { accessToken, refreshToken };
}

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // ── POST /register ───────────────────────────────────────────────────────────

  app.post(
    "/register",
    {
      schema: {
        description: "Create a new Specter account",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  plan: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // 1. Validate body
      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: parsed.error.errors[0].message,
          details: parsed.error.errors,
        });
      }
      const { name, email, password } = parsed.data;

      // 2. Check for duplicate email
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.code(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "An account with this email already exists.",
        });
      }

      // 3. Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // 4. Create user + free subscription atomically
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          subscription: {
            create: {
              plan: "FREE",
              status: "ACTIVE",
              sitesLimit: 1,
            },
          },
        },
        include: { subscription: true },
      });

      // 5. Issue tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        plan: user.subscription!.plan,
      };
      const { accessToken, refreshToken } = issueTokens(app, tokenPayload);
      setRefreshCookie(reply, refreshToken);

      return reply.code(201).send({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          plan: user.subscription!.plan,
        },
      });
    }
  );

  // ── POST /login ──────────────────────────────────────────────────────────────

  app.post(
    "/login",
    {
      schema: {
        description: "Authenticate and receive access + refresh tokens",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  plan: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // 1. Validate
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: parsed.error.errors[0].message,
        });
      }
      const { email, password } = parsed.data;

      // 2. Find user
      const user = await prisma.user.findUnique({
        where: { email },
        include: { subscription: true },
      });

      // 3. Constant-time password check (even if user not found, run compare to avoid timing attacks)
      const dummyHash =
        "$2b$12$invalidhashusedtopreventimingtattacks000000000000000000";
      const passwordMatch = await bcrypt.compare(
        password,
        user?.passwordHash ?? dummyHash
      );

      if (!user || !passwordMatch) {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid email or password.",
        });
      }

      // 4. Issue tokens
      const plan = user.subscription?.plan ?? "FREE";
      const tokenPayload = { userId: user.id, email: user.email, plan };
      const { accessToken, refreshToken } = issueTokens(app, tokenPayload);
      setRefreshCookie(reply, refreshToken);

      return reply.code(200).send({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          plan,
        },
      });
    }
  );

  // ── POST /refresh ────────────────────────────────────────────────────────────

  app.post(
    "/refresh",
    {
      schema: {
        description: "Use the httpOnly refresh-token cookie to obtain a new access token",
        tags: ["auth"],
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Read token from httpOnly cookie
      const rawCookie = (request.cookies as Record<string, string | undefined>)[
        "refreshToken"
      ];
      if (!rawCookie) {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Refresh token not found.",
        });
      }

      // Verify the refresh token
      let decoded: { userId: string; tokenType?: string };
      try {
        decoded = app.jwt.verify(rawCookie) as typeof decoded;
      } catch {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid or expired refresh token.",
        });
      }

      if (decoded.tokenType !== "refresh") {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Token type mismatch.",
        });
      }

      // Fetch up-to-date user info (plan may have changed since token was issued)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { subscription: true },
      });
      if (!user) {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "User not found.",
        });
      }

      const plan = user.subscription?.plan ?? "FREE";
      const accessToken = app.jwt.sign(
        { userId: user.id, email: user.email, plan },
        { expiresIn: ACCESS_TOKEN_TTL }
      );

      return reply.code(200).send({ accessToken });
    }
  );

  // ── POST /logout ─────────────────────────────────────────────────────────────

  app.post(
    "/logout",
    {
      schema: {
        description: "Clear the refresh token cookie",
        tags: ["auth"],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.clearCookie("refreshToken", {
        path: "/api/v1/auth",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return reply.code(200).send({ message: "Logged out successfully." });
    }
  );

  // ── PATCH /me ─────────────────────────────────────────────────────────────────

  app.patch(
    "/me",
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); req.jwtUser = req.user as any }
        catch { rep.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid token." }) }
      }],
      schema: { description: "Update user profile", tags: ["auth"] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser
      const body = request.body as any
      const name = typeof body?.name === "string" ? body.name.trim() : null
      if (!name || name.length === 0 || name.length > 100) {
        return reply.code(400).send({ statusCode: 400, error: "Bad Request", message: "Invalid name." })
      }
      const user = await prisma.user.update({ where: { id: userId }, data: { name } })
      return reply.code(200).send({ user: { id: user.id, name: user.name, email: user.email } })
    }
  );

  // ── PATCH /password ───────────────────────────────────────────────────────────

  app.patch(
    "/password",
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); req.jwtUser = req.user as any }
        catch { rep.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid token." }) }
      }],
      schema: { description: "Change password", tags: ["auth"] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser
      const body = request.body as any
      const { currentPassword, newPassword } = body ?? {}
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return reply.code(400).send({ statusCode: 400, error: "Bad Request", message: "New password must be at least 8 characters." })
      }
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) return reply.code(404).send({ statusCode: 404, error: "Not Found", message: "User not found." })
      const match = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!match) return reply.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Current password is incorrect." })
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
      return reply.code(200).send({ message: "Password changed successfully." })
    }
  );

  // ── GET /api-keys ─────────────────────────────────────────────────────────────

  app.get(
    "/api-keys",
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); req.jwtUser = req.user as any }
        catch { rep.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid token." }) }
      }],
      schema: { description: "List API keys", tags: ["auth"] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser
      const keys = await prisma.apiKey.findMany({
        where: { userId },
        select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: "desc" },
      })
      return reply.code(200).send({ keys })
    }
  );

  // ── POST /api-keys ────────────────────────────────────────────────────────────

  app.post(
    "/api-keys",
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); req.jwtUser = req.user as any }
        catch { rep.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid token." }) }
      }],
      schema: { description: "Create an API key", tags: ["auth"] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser
      const body = request.body as any
      const name = typeof body?.name === "string" ? body.name.trim() : null
      if (!name || name.length === 0 || name.length > 80) {
        return reply.code(400).send({ statusCode: 400, error: "Bad Request", message: "Key name is required (max 80 chars)." })
      }
      const count = await prisma.apiKey.count({ where: { userId } })
      if (count >= 20) {
        return reply.code(403).send({ statusCode: 403, error: "Limit Reached", message: "Maximum 20 API keys per account." })
      }
      const rawKey = `sp_${nanoid(40)}`
      const prefix = rawKey.slice(0, 10)
      const keyHash = await bcrypt.hash(rawKey, 10)
      const apiKey = await prisma.apiKey.create({
        data: { userId, name, prefix, keyHash },
        select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
      })
      return reply.code(201).send({ apiKey, key: rawKey })
    }
  );

  // ── DELETE /api-keys/:id ──────────────────────────────────────────────────────

  app.delete(
    "/api-keys/:id",
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); req.jwtUser = req.user as any }
        catch { rep.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid token." }) }
      }],
      schema: { description: "Delete an API key", tags: ["auth"] },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = request.jwtUser
      const { id } = request.params
      const key = await prisma.apiKey.findFirst({ where: { id, userId } })
      if (!key) return reply.code(404).send({ statusCode: 404, error: "Not Found", message: "API key not found." })
      await prisma.apiKey.delete({ where: { id } })
      return reply.code(200).send({ message: "API key deleted." })
    }
  );

  // ── GET /me ──────────────────────────────────────────────────────────────────

  app.get(
    "/me",
    {
      preHandler: [async (req, rep) => {
        try { await req.jwtVerify(); req.jwtUser = req.user as any }
        catch { rep.code(401).send({ statusCode: 401, error: "Unauthorized", message: "Invalid token." }) }
      }],
      schema: { description: "Get current user profile", tags: ["auth"] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      })
      if (!user) return reply.code(404).send({ statusCode: 404, error: "Not Found", message: "User not found." })
      return reply.code(200).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          plan: user.subscription?.plan ?? "FREE",
          sitesLimit: user.subscription?.sitesLimit ?? 1,
          subscriptionStatus: user.subscription?.status ?? "ACTIVE",
          currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
        }
      })
    }
  );
}
