import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KEY_PREFIX = "spk_";   // Specter API Key prefix (easy to spot in logs)
const KEY_LENGTH = 40;        // chars of the random portion
const KEY_HASH_ROUNDS = 10;   // cheaper than password hashing — keys are long

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
});

// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────

export async function keysRoutes(app: FastifyInstance) {
  // All routes require a valid JWT
  app.addHook("preHandler", authenticate);

  // ── GET /keys ─────────────────────────────────────────────────────────────────

  app.get(
    "/",
    {
      schema: {
        description: "List all API keys for the authenticated user (hashes never returned)",
        tags: ["api-keys"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser;

      const keys = await prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          lastUsedAt: true,
          createdAt: true,
          // keyHash is intentionally excluded
        },
      });

      return reply.code(200).send({ keys });
    }
  );

  // ── POST /keys ────────────────────────────────────────────────────────────────

  app.post(
    "/",
    {
      schema: {
        description: "Create a new API key. The full key is only returned once — store it securely.",
        tags: ["api-keys"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser;

      // Validate
      const parsed = CreateKeySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: parsed.error.errors[0].message,
        });
      }
      const { name } = parsed.data;

      // Enforce a reasonable per-user key cap
      const keyCount = await prisma.apiKey.count({ where: { userId } });
      if (keyCount >= 20) {
        return reply.code(403).send({
          statusCode: 403,
          error: "Limit Reached",
          message: "Maximum of 20 API keys per account. Delete an existing key first.",
        });
      }

      // Generate key and hash
      const rawKey = `${KEY_PREFIX}${nanoid(KEY_LENGTH)}`;
      const prefix = rawKey.slice(0, 10);
      const keyHash = await bcrypt.hash(rawKey, KEY_HASH_ROUNDS);

      const apiKey = await prisma.apiKey.create({
        data: { userId, name, prefix, keyHash },
        select: { id: true, name: true, prefix: true, createdAt: true },
      });

      return reply.code(201).send({
        key: rawKey,   // Returned ONCE — not stored in plaintext anywhere
        id: apiKey.id,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        warning: "Save this key now. It will not be shown again.",
      });
    }
  );

  // ── DELETE /keys/:id ──────────────────────────────────────────────────────────

  app.delete(
    "/:id",
    {
      schema: {
        description: "Revoke an API key",
        tags: ["api-keys"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = request.jwtUser;
      const { id } = request.params;

      const apiKey = await prisma.apiKey.findFirst({ where: { id, userId } });
      if (!apiKey) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "API key not found.",
        });
      }

      await prisma.apiKey.delete({ where: { id } });
      return reply.code(200).send({ message: "API key revoked successfully." });
    }
  );

  // ── POST /keys/verify ─────────────────────────────────────────────────────────
  // Internal/programmatic endpoint — verifies a raw key and returns the associated userId.
  // Intended for the edge worker or other internal services.

  app.post(
    "/verify",
    {
      schema: {
        description: "Verify a raw API key and return the owner's userId (internal use)",
        tags: ["api-keys"],
        body: {
          type: "object",
          required: ["key"],
          properties: {
            key: { type: "string" },
          },
        },
      },
      // Only allow calls from internal services
      config: { rateLimit: { max: 200, timeWindow: "1 minute" } },
    },
    async (request: FastifyRequest<{ Body: { key: string } }>, reply: FastifyReply) => {
      const internalSecret = process.env.INTERNAL_API_SECRET;
      if (internalSecret) {
        const provided = request.headers["x-internal-secret"];
        if (provided !== internalSecret) {
          return reply.code(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "Invalid internal secret.",
          });
        }
      }

      const { key } = request.body;
      if (!key?.startsWith(KEY_PREFIX)) {
        return reply.code(400).send({ valid: false, message: "Invalid key format." });
      }

      // Load all keys for prefix-matching — in production, store a fast-lookup index
      // (e.g. first 8 chars as a separate column) to avoid full-table comparison.
      const allKeys = await prisma.apiKey.findMany({
        select: { id: true, userId: true, keyHash: true },
      });

      for (const record of allKeys) {
        const match = await bcrypt.compare(key, record.keyHash);
        if (match) {
          // Update lastUsedAt without awaiting (fire and forget)
          prisma.apiKey
            .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
            .catch(() => {});
          return reply.code(200).send({ valid: true, userId: record.userId });
        }
      }

      return reply.code(200).send({ valid: false });
    }
  );
}
