import { z } from "zod";
import { isValidTimeZone } from "./tz";

const text = (max: number) => z.string().trim().max(max);
const required = (label: string, min: number, max: number) =>
  z.string().trim().min(min, `${label} is required (at least ${min} characters).`).max(max, `${label} is too long.`);
const optional = (max: number) => text(max).optional().nullable().transform((v) => (v ? v : null));

export const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Enter the phone number with country code, e.g. +447862605011.");

export const PLATFORMS = ["Google Meet", "Zoom", "Microsoft Teams", "Phone call", "WhatsApp call", "No preference"] as const;
export const COMM_METHODS = ["Email", "Phone", "WhatsApp"] as const;

export const holdSchema = z.object({
  serviceId: z.string().min(1),
  startAt: z.string().datetime({ message: "Choose a valid time slot." }),
  clientTimezone: z.string().refine(isValidTimeZone, "Invalid time zone."),
  couponCode: optional(40),
  title: required("Meeting title", 3, 150),
  purpose: required("Purpose of the meeting", 10, 1000),
  description: required("Description of requirements", 20, 5000),
  questions: optional(3000),
  expectedOutcome: optional(2000),
  notes: optional(2000),
  clientName: required("Full name", 2, 120),
  clientEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  clientPhone: phoneSchema,
  company: optional(150),
  website: z.string().trim().max(300).optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Website must start with http:// or https://"),
  country: required("Country", 2, 80),
  commMethod: z.enum(COMM_METHODS),
  platformPref: z.enum(PLATFORMS),
  additionalInfo: optional(2000),
  draftToken: z.string().max(100).optional().nullable(),
});

export const quoteSchema = z.object({ serviceId: z.string().min(1), couponCode: optional(40) });

export const registerSchema = z.object({
  name: required("Name", 2, 120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const serviceSchema = z.object({
  name: required("Name", 2, 120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/, "Slug: lowercase letters, numbers and dashes."),
  description: required("Description", 10, 2000),
  durationMin: z.coerce.number().int().refine((n) => [15, 30, 45, 60, 90, 120].includes(n), "Duration must be 15, 30, 45, 60, 90 or 120 minutes."),
  price: z.coerce.number().min(0).max(100000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  active: z.coerce.boolean(),
  isCustom: z.coerce.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  paymentRequirement: z.enum(["FULL", "DEPOSIT", "NONE"]),
  depositPercent: z.coerce.number().int().min(1).max(100).default(50),
  cancelNoticeHours: z.coerce.number().int().min(0).max(720),
  rescheduleNoticeHours: z.coerce.number().int().min(0).max(720),
  policyNote: optional(1000),
  assignedToId: z.string().optional().nullable().transform((v) => (v ? v : null)),
});
