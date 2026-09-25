// Display labels for database enums. Order matters: it is the pipeline order.
export const BOOKING_STATUSES = [
  ["new_inquiry", "New inquiry"], ["deposit_pending", "Deposit pending"], ["deposit_paid", "Deposit paid"],
  ["confirmed", "Confirmed"], ["pre_production", "Pre-production"], ["shoot_scheduled", "Shoot scheduled"],
  ["shoot_completed", "Shoot completed"], ["editing", "Editing"], ["client_review", "Client review"],
  ["revision", "Revision"], ["final_payment_due", "Final payment due"], ["paid", "Paid"],
  ["delivered", "Delivered"], ["archived", "Archived"], ["canceled", "Canceled"],
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number][0];

export const PAYMENT_STATES = {
  unpaid: "Unpaid", partially_paid: "Partially paid", deposit_paid: "Deposit paid", paid: "Paid in full",
  overdue: "Overdue", refunded: "Refunded", canceled: "Canceled",
} as const;
export type PaymentState = keyof typeof PAYMENT_STATES;

export const PAYMENT_STATUSES = { pending: "Pending", succeeded: "Paid", failed: "Failed", refunded: "Refunded", partially_refunded: "Partially refunded" } as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUSES;
export const PAYMENT_TYPES = { deposit: "Deposit", partial: "Partial payment", final: "Final payment", other: "Other" } as const;
export type PaymentType = keyof typeof PAYMENT_TYPES;
export const PAYMENT_METHODS = { stripe: "Stripe", cash: "Cash", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", bank_transfer: "Bank transfer", check: "Check", other: "Other" } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const LEAD_SOURCES = {
  instagram: "Instagram", google: "Google", website: "Website", referral: "Referral", repeat_client: "Repeat client",
  tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", direct_outreach: "Direct outreach", other: "Other",
} as const;
export type LeadSource = keyof typeof LEAD_SOURCES;

export const CLIENT_TYPES = {
  artist: "Artist", brand: "Brand", business: "Business", restaurant: "Restaurant", barbershop: "Barbershop",
  real_estate_agent: "Real estate agent", event_client: "Event client", agency: "Agency", other: "Other",
} as const;
export type ClientType = keyof typeof CLIENT_TYPES;

export const SERVICE_CATEGORIES = { content: "Social content", music: "Music videos", brand: "Brand films", events: "Event coverage", estate: "Real estate", custom: "Custom" } as const;
export type ServiceCategory = keyof typeof SERVICE_CATEGORIES;

export const EXPENSE_CATEGORIES = {
  gear: "Gear", gear_rental: "Gear rental", transportation: "Transportation", gas: "Gas", parking: "Parking",
  location: "Location", talent: "Talent", crew: "Crew", editing_software: "Editing software", subscriptions: "Subscriptions",
  music_licensing: "Music licensing", props: "Props", food: "Food", marketing: "Marketing", advertising: "Advertising",
  insurance: "Insurance", website: "Website", taxes: "Taxes", contractors: "Contractors", other: "Other",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const statusLabel = (s: string) => BOOKING_STATUSES.find(([id]) => id === s)?.[1] ?? s;
export const statusRank = (s: string) => BOOKING_STATUSES.findIndex(([id]) => id === s);
export const keysOf = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[];
