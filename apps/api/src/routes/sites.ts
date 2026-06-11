import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { KillMode } from "@prisma/client";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreateSiteSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z
    .string()
    .min(1)
    .max(253)
    .regex(
      /^(?!https?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
      "Provide a bare domain like example.com (no protocol)"
    ),
});

const KillSwitchSchema = z.object({
  mode: z.nativeEnum(KillMode),
  config: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan site limits
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_SITE_LIMITS: Record<string, number> = {
  FREE: 1,
  STARTER: 5,
  PRO: 20,
  AGENCY: 100,
  ENTERPRISE: Infinity,
};

// ─────────────────────────────────────────────────────────────────────────────
// Snippet generator
// ─────────────────────────────────────────────────────────────────────────────

function generateSnippet(siteToken: string, apiBase: string): { tag: string; swStub: string } {
  return {
    tag: `<script src="${apiBase}/api/v1/js" data-token="${siteToken}" async></script>`,
    swStub: `importScripts('${apiBase}/api/v1/sw.js');`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────

export async function sitesRoutes(app: FastifyInstance) {
  // All routes in this plugin require a valid JWT
  app.addHook("preHandler", authenticate);

  // ── GET /sites ────────────────────────────────────────────────────────────────

  app.get(
    "/",
    {
      schema: {
        description: "List all sites for the authenticated user",
        tags: ["sites"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.jwtUser;

      const sites = await prisma.site.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          domain: true,
          siteToken: true,
          killMode: true,
          isKilled: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { events: true } },
        },
      });

      return reply.code(200).send({ sites });
    }
  );

  // ── POST /sites ───────────────────────────────────────────────────────────────

  app.post(
    "/",
    {
      schema: {
        description: "Create a new site (plan limit enforced)",
        tags: ["sites"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "domain"],
          properties: {
            name: { type: "string" },
            domain: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, plan } = request.jwtUser;

      // 1. Validate body
      const parsed = CreateSiteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: parsed.error.errors[0].message,
          details: parsed.error.errors,
        });
      }
      const { name, domain } = parsed.data;

      // 2. Enforce plan limit
      const siteCount = await prisma.site.count({ where: { userId } });
      const limit = PLAN_SITE_LIMITS[plan] ?? 1;
      if (siteCount >= limit) {
        return reply.code(403).send({
          statusCode: 403,
          error: "Plan Limit Reached",
          message: `Your ${plan} plan allows up to ${limit} site(s). Upgrade to add more.`,
        });
      }

      // 3. Check domain uniqueness per user
      const duplicate = await prisma.site.findFirst({
        where: { userId, domain },
      });
      if (duplicate) {
        return reply.code(409).send({
          statusCode: 409,
          error: "Conflict",
          message: "You already have a site registered with this domain.",
        });
      }

      // 4. Generate unique siteToken (collision-safe with DB check)
      let siteToken: string;
      let attempts = 0;
      do {
        siteToken = nanoid(24);
        const collision = await prisma.site.findUnique({ where: { siteToken } });
        if (!collision) break;
        attempts++;
      } while (attempts < 5);

      // 5. Create site
      const site = await prisma.site.create({
        data: {
          userId,
          name,
          domain,
          siteToken,
          killMode: "none",
          isKilled: false,
        },
      });

      const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
      const snippet = generateSnippet(site.siteToken, apiBase);

      return reply.code(201).send({ site, tag: snippet.tag, swStub: snippet.swStub });
    }
  );

  // ── GET /sites/:id ────────────────────────────────────────────────────────────

  app.get(
    "/:id",
    {
      schema: {
        description: "Get a single site with its current kill state",
        tags: ["sites"],
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

      const site = await prisma.site.findFirst({
        where: { id, userId },
        include: {
          events: {
            orderBy: { activatedAt: "desc" },
            take: 5,
          },
        },
      });

      if (!site) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Site not found.",
        });
      }

      return reply.code(200).send({ site });
    }
  );

  // ── DELETE /sites/:id ─────────────────────────────────────────────────────────

  app.delete(
    "/:id",
    {
      schema: {
        description: "Delete a site and all associated data",
        tags: ["sites"],
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

      const site = await prisma.site.findFirst({ where: { id, userId } });
      if (!site) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Site not found.",
        });
      }

      await prisma.site.delete({ where: { id } });
      return reply.code(200).send({ message: "Site deleted successfully." });
    }
  );

  // ── POST /sites/:id/kill ──────────────────────────────────────────────────────

  app.post(
    "/:id/kill",
    {
      schema: {
        description: "Activate the kill switch for a site",
        tags: ["sites"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["mode"],
          properties: {
            mode: { type: "string" },
            config: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { userId } = request.jwtUser;
      const { id } = request.params;

      // 1. Validate body
      const parsed = KillSwitchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: parsed.error.errors[0].message,
          details: parsed.error.errors,
        });
      }
      const { mode, config } = parsed.data;

      // 2. Ownership check
      const site = await prisma.site.findFirst({ where: { id, userId } });
      if (!site) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Site not found.",
        });
      }

      // 3. Mode-specific validation
      if (mode === "redirect" && !config?.url) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "redirect mode requires config.url",
        });
      }

      // 4. Update site kill state
      const killState = config ? (config as Record<string, unknown>) : {};
      const updatedSite = await prisma.site.update({
        where: { id },
        data: {
          isKilled: true,
          killMode: mode,
          killState: killState as any,
        },
      });

      // 5. Create KillEvent record
      const event = await prisma.killEvent.create({
        data: {
          siteId: id,
          triggeredBy: "user",
          mode,
          config: (config ?? {}) as any,
        },
      });

      // 6. Notify edge worker (fire-and-forget; never fail the user request if edge is down)
      const edgeUrl = process.env.EDGE_WORKER_URL;
      if (edgeUrl) {
        fetch(`${edgeUrl}/internal/invalidate/${site.siteToken}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": process.env.EDGE_INTERNAL_SECRET ?? "",
          },
          body: JSON.stringify({
            isKilled: true,
            killMode: mode,
            config: config ?? {},
          }),
        }).catch((err) =>
          app.log.warn({ err }, `Edge invalidation failed for site ${site.siteToken}`)
        );
      }

      return reply.code(200).send({
        message: "Kill switch activated.",
        site: updatedSite,
        event,
      });
    }
  );

  // ── POST /sites/:id/restore ───────────────────────────────────────────────────

  app.post(
    "/:id/restore",
    {
      schema: {
        description: "Deactivate the kill switch and restore normal operation",
        tags: ["sites"],
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

      const site = await prisma.site.findFirst({ where: { id, userId } });
      if (!site) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Site not found.",
        });
      }

      if (!site.isKilled) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Kill switch is not currently active for this site.",
        });
      }

      // Update site — keep killMode/killState so they are available as defaults for next kill
      const updatedSite = await prisma.site.update({
        where: { id },
        data: { isKilled: false },
      });

      // Close the latest open KillEvent
      await prisma.killEvent.updateMany({
        where: { siteId: id, deactivatedAt: null },
        data: { deactivatedAt: new Date() },
      });

      // Notify edge worker
      const edgeUrl = process.env.EDGE_WORKER_URL;
      if (edgeUrl) {
        fetch(`${edgeUrl}/internal/invalidate/${site.siteToken}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": process.env.EDGE_INTERNAL_SECRET ?? "",
          },
          body: JSON.stringify({ isKilled: false }),
        }).catch((err) =>
          app.log.warn({ err }, `Edge invalidation failed for site ${site.siteToken}`)
        );
      }

      return reply.code(200).send({
        message: "Kill switch deactivated. Site restored.",
        site: updatedSite,
      });
    }
  );

  // ── GET /sites/:id/events ─────────────────────────────────────────────────────

  app.get(
    "/:id/events",
    {
      schema: {
        description: "Retrieve kill event history for a site",
        tags: ["sites"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { limit?: number; offset?: number };
      }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.jwtUser;
      const { id } = request.params;
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      const site = await prisma.site.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!site) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Site not found.",
        });
      }

      const [events, total] = await Promise.all([
        prisma.killEvent.findMany({
          where: { siteId: id },
          orderBy: { activatedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.killEvent.count({ where: { siteId: id } }),
      ]);

      return reply.code(200).send({ events, total, limit, offset });
    }
  );

  // ── GET /sites/:id/snippet ────────────────────────────────────────────────────

  app.get(
    "/:id/snippet",
    {
      schema: {
        description: "Get the HTML snippet to embed in your site's <head>",
        tags: ["sites"],
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

      const site = await prisma.site.findFirst({
        where: { id, userId },
        select: { siteToken: true, domain: true, name: true },
      });
      if (!site) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Site not found.",
        });
      }

      const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
      const snippet = generateSnippet(site.siteToken, apiBase);

      return reply.code(200).send({
        siteToken: site.siteToken,
        tag: snippet.tag,
        swStub: snippet.swStub,
      });
    }
  );
}
