import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";

export class UserError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<output<S>> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new UserError("Invalid request body."); }
  return schema.parse(body);
}

/** Wraps an API handler with consistent error handling. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return fail(e.issues[0]?.message || "Please check the form and try again.", 422);
      if (e instanceof UserError) return fail(e.message, e.status);
      console.error(e);
      return fail("Something went wrong. Please try again or contact us.", 500);
    }
  };
}

// Simple in-memory rate limit (per server instance) to slow down abuse of the public endpoints.
const hits = new Map<string, { n: number; t: number }>();
export function rateLimit(req: Request, key: string, limit: number, windowSec: number) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
  const k = `${key}:${ip}`, now = Date.now();
  const h = hits.get(k);
  if (!h || now - h.t > windowSec * 1000) { hits.set(k, { n: 1, t: now }); return; }
  if (++h.n > limit) throw new UserError("Too many attempts. Please wait a few minutes and try again.", 429);
}
