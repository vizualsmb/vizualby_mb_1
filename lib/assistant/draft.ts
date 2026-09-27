import "server-only";
import type { PaymentOption } from "@/data/booking";

// Pre-fill data handed from the assistant to the existing booking widget. It is
// never itself a booking: the customer still reviews it, accepts terms, and
// completes payment through the unchanged /api/booking/session + Cal.com flow.
export type AssistantDraft = {
  clientId: string;
  packageId: string;
  addonIds: string[];
  paymentOption: PaymentOption;
  promoCode: string;
  promotionId: string | null;
  selectedSlot: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  location: string;
  project: string;
  referral: string;
  createdAt: string;
};

export type AssistantDraftLink = { reference: string; clientId: string };

export const ASSISTANT_DRAFT_COOKIE = "mb-assistant-draft";

export const draftKey = (token: string) => `assistant:draft:${token}`;
export const draftReferenceKey = (token: string) => `assistant:draft-reference:${token}`;
