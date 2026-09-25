import { usd } from "./money";
import { formatDay, formatFullDate, formatTime } from "./time";

// Email wording. Plain text only: nothing here is interpreted as HTML, so client
// names or notes can never inject markup. Each function returns { subject, text }.

export type MessageBooking = {
  client_name: string; project: string; shoot_start: string | null; location: string | null;
  balance_cents: number; due_date: string | null; payment_link_url: string | null; payment_link_cents: number | null;
};
type Studio = { name: string; email: string | null };

const signOff = (s: Studio) => `\n\n— ${s.name}${s.email ? `\n${s.email}` : ""}`;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const payLine = (b: MessageBooking) => b.payment_link_url && b.payment_link_cents === b.balance_cents
  ? `\n\nYou can pay securely here: ${b.payment_link_url}` : "\n\nReply to this email if you need the payment details again.";

export function shootReminder(b: MessageBooking, s: Studio) {
  return {
    subject: `Tomorrow: your ${b.project} shoot`,
    text: `Hi ${firstName(b.client_name)},\n\nJust a reminder that we're shooting tomorrow, ${formatFullDate(b.shoot_start)} at ${formatTime(b.shoot_start)}${b.location ? `, at ${b.location}` : ""}.\n\nIf anything has changed, reply to this email as soon as you can.${signOff(s)}`,
  };
}

export function balanceReminder(b: MessageBooking, s: Studio, overdue: boolean) {
  return overdue
    ? { subject: `Balance past due: ${b.project}`, text: `Hi ${firstName(b.client_name)},\n\nOur records show a balance of ${usd(b.balance_cents)} for ${b.project} that was due ${formatDay(b.due_date)}. If you've already paid, thank you, and please ignore this note.${payLine(b)}${signOff(s)}` }
    : { subject: `Balance due ${formatDay(b.due_date)}: ${b.project}`, text: `Hi ${firstName(b.client_name)},\n\nA friendly reminder that the remaining balance of ${usd(b.balance_cents)} for ${b.project} is due ${formatDay(b.due_date)}.${payLine(b)}${signOff(s)}` };
}

export function adminNewBooking(b: MessageBooking, url: string) {
  return {
    subject: `New booking: ${b.client_name} — ${b.project}`,
    text: `${b.client_name} booked ${b.project}${b.shoot_start ? ` for ${formatFullDate(b.shoot_start)} at ${formatTime(b.shoot_start)}` : ""}.\n\nDeposit pending until payment clears.\n\n${url}`,
  };
}

export function adminPaymentReceived(b: MessageBooking, amount: number, url: string) {
  return {
    subject: `Payment received: ${usd(amount)} from ${b.client_name}`,
    text: `${usd(amount)} received for ${b.project}. Remaining balance: ${usd(b.balance_cents)}.\n\n${url}`,
  };
}
