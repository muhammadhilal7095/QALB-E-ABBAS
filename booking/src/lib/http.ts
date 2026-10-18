import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { BookingError } from "./booking";

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new BookingError("Invalid request body."); }
  return schema.parse(body);
}

/** Wraps an API handler with consistent error handling. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return fail(first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.", 422, { issues: e.issues });
      }
      if (e instanceof BookingError) {
        const status = e.code === "SLOT_TAKEN" ? 409 : e.code === "NOT_FOUND" ? 404 : e.code === "STATE" ? 409 : 400;
        return fail(e.message, status, { code: e.code });
      }
      if (e instanceof RateLimitError) return fail(e.message, 429);
      console.error(e);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

export class RateLimitError extends Error {}

/** Fixed-window rate limiter stored in PostgreSQL (works across multiple server instances). */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSec}) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSec}) THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit) throw new RateLimitError("Too many attempts. Please wait a few minutes and try again.");
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string | null, data?: Prisma.InputJsonValue, ip?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId: entityId ?? null, data, ip } });
}
