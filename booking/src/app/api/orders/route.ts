import { z } from "zod";
import { createOrder, startOrderCheckout } from "@/lib/orders";
import { handle, ok, parseJson, rateLimit } from "@/lib/http";
import { clientIp } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";
import { MAX_QTY } from "@/lib/catalog";

const schema = z.object({
  items: z.array(z.object({ sku: z.string().min(1).max(80), quantity: z.number().int().min(1).max(MAX_QTY) })).min(1).max(40),
  customer: z.object({
    name: z.string().trim().min(2, "Please enter your name").max(120),
    email: z.string().trim().email("Please enter a valid email address").max(200),
    phone: z.string().trim().max(40).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  }),
  gateway: z.enum(["STRIPE", "BANK_TRANSFER", "MOCK"]),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the terms to continue" }) }),
});

export const OPTIONS = (req: Request) => preflight(req);

/** POST /api/orders — creates an order from the website cart and starts payment. */
export const POST = async (req: Request) => withCors(req, await handle(async () => {
  await rateLimit(`order:${await clientIp()}`, 15, 600);
  const body = await parseJson(req, schema);
  const order = await createOrder(body.items, body.customer);
  const { redirectUrl } = await startOrderCheckout(order, body.gateway);
  return ok({ reference: order.reference, redirectUrl });
})());
