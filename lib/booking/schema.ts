import { z } from "zod";
export const intakeSchema = z.object({
  packageId: z.string().max(60), addonIds: z.array(z.string().max(60)).max(3),
  promoCode: z.string().trim().max(40).default(""),
  promotionId: z.uuid().optional(),
  selectedSlot: z.iso.datetime({ offset: true }), paymentOption: z.enum(["deposit", "full"]).default("deposit"),
  name: z.string().trim().min(2).max(100), email: z.email().max(160).transform((s) => s.toLowerCase()),
  phone: z.string().trim().min(7).max(30), company: z.string().trim().max(120).default(""),
  location: z.string().trim().max(250).optional(), project: z.string().trim().min(15).max(2000),
  references: z.string().trim().max(600).default(""), terms: z.literal(true), website: z.literal("").optional(),
  social: z.string().trim().max(200).optional(), referral: z.string().trim().max(100).optional(),
  preferredDate: z.string().max(10).optional(), alternativeDate: z.string().max(10).optional(),
  answers: z.record(z.string().max(40), z.string().trim().max(600)).optional(),
});
export type Intake = z.infer<typeof intakeSchema>;
