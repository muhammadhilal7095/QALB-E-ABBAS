import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** A Prisma client or an interactive-transaction client. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Statuses that occupy a time slot (mirrors the booking_no_overlap DB constraint). */
export const ACTIVE_STATUSES = ["HELD", "PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "COMPLETED"] as const;

/** True when a database error came from the double-booking exclusion constraint. */
export function isOverlapError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("booking_no_overlap") || msg.includes("23P01");
}
