import { availableGateways } from "@/lib/payments";
import { handle, ok } from "@/lib/http";
import { preflight, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = (req: Request) => preflight(req);

/** GET /api/orders/options — payment methods the cart can offer. */
export const GET = async (req: Request) => withCors(req, await handle(async () => ok({ gateways: await availableGateways() }))());
