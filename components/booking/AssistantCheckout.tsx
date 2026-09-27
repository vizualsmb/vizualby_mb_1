"use client";

import { BookingPortal } from "./BookingPortal";
import type { BookingPackage, PaymentOption } from "@/data/booking";
import type { PublicPromotion } from "@/lib/booking/promotions";
import type { Intake } from "@/lib/booking/schema";

type Policies = { version: string; cancellation: string; rescheduling: string; balance: string };

export function AssistantCheckout(props: {
    live: boolean; policies: Policies; enabledPackages: string[]; fullPaymentPackages: string[];
  promotions: PublicPromotion[]; packages: BookingPackage[]; initialPackageId: string; initialAddonIds: string[];
  initialSlot: string; initialPaymentOption: PaymentOption; initialPromoCode: string; initialIntake: Partial<Intake>;
}) {
  return <BookingPortal {...props} initialStep={3} />;
}
