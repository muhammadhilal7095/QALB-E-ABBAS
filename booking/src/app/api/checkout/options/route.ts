import { availableGateways } from "@/lib/checkout";
import { ok } from "@/lib/http";
import { preflight, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = (req: Request) => preflight(req);

/** GET /api/checkout/options — whether online payment is available ("STRIPE", or "TEST" in development). */
export const GET = async (req: Request) => withCors(req, ok({ gateways: availableGateways() }));
