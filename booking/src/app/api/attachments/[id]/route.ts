import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/uploads";

/** Serves an attachment to staff, or to the booking owner (account or manage token). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await prisma.attachment.findUnique({ where: { id }, include: { booking: { include: { client: true } } } });
  if (!a || !a.booking) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  const token = new URL(req.url).searchParams.get("token");
  const allowed = isStaff(user) || (user && a.booking.client.userId === user.id) || (token && token === a.booking.manageToken);
  if (!allowed) return new Response("Not found", { status: 404 });
  const data = await readFile(path.join(UPLOAD_DIR, path.basename(a.storedName)));
  return new Response(data, { headers: { "Content-Type": a.mime, "Content-Disposition": `attachment; filename="${a.filename.replace(/"/g, "")}"`, "Cache-Control": "private, no-store" } });
}
