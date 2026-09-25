import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nyDay } from "../time";
import { buildDemoData, type DemoTables } from "./data";

// DEVELOPMENT ONLY. An in-memory stand-in for the Supabase client, used when the
// login bypass is on and no database is connected. It implements just the
// PostgREST features the admin uses, and computes booking_ledger / client_summary
// with the same rules as the SQL views. Data lives in memory and resets when the
// dev server restarts.

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

const g = globalThis as unknown as { __vizualDemo?: DemoTables };
const tables = () => (g.__vizualDemo ??= buildDemoData());

const COLLECTED = new Set(["succeeded", "partially_refunded", "refunded"]);
function ledger(t: DemoTables): Row[] {
  const today = nyDay(new Date());
  return t.bookings.map((b) => {
    const c = t.clients.find((x) => x.id === b.client_id) ?? {};
    const pays = t.payments.filter((p) => p.booking_id === b.id);
    const paid = pays.filter((p) => COLLECTED.has(p.status as string)).reduce((s, p) => s + (p.amount_cents as number) - (p.refunded_cents as number), 0);
    const refunded = pays.reduce((s, p) => s + (p.refunded_cents as number), 0);
    const total = (b.package_price_cents as number) + (b.addons_cents as number) + (b.adjustment_cents as number);
    const balance = b.status === "canceled" ? 0 : Math.max(total - paid, 0);
    const due = (b.balance_due_date as string | null) ?? (b.shoot_start ? nyDay(b.shoot_start as string) : null);
    const state = b.status === "canceled" ? (refunded > 0 ? "refunded" : "canceled")
      : total > 0 && paid >= total ? "paid" : balance > 0 && due && due < today ? "overdue"
      : paid === 0 ? (refunded > 0 ? "refunded" : "unpaid") : paid >= (b.deposit_required_cents as number) ? "deposit_paid" : "partially_paid";
    return { ...b, total_cents: total, client_name: c.name, client_email: c.email, client_phone: c.phone, client_company: c.company, paid_cents: paid, refunded_cents: refunded, balance_cents: balance, due_date: due, payment_state: state };
  });
}
function clientSummary(t: DemoTables): Row[] {
  const rows = ledger(t);
  return t.clients.map((c) => {
    const mine = rows.filter((b) => b.client_id === c.id);
    const created = mine.map((b) => b.created_at as string).sort();
    const upcoming = mine.filter((b) => b.shoot_start && Date.parse(b.shoot_start) > Date.now() && b.status !== "canceled").map((b) => b.shoot_start as string).sort();
    return {
      ...c, booking_count: mine.filter((b) => b.status !== "canceled").length, first_booking_at: created[0] ?? null, last_booking_at: created.at(-1) ?? null,
      lifetime_revenue_cents: mine.reduce((s, b) => s + b.paid_cents, 0),
      booked_value_cents: mine.filter((b) => !["canceled", "new_inquiry"].includes(b.status)).reduce((s, b) => s + b.total_cents, 0),
      outstanding_cents: mine.reduce((s, b) => s + b.balance_cents, 0), next_shoot_at: upcoming.at(-1) ?? null,
    };
  });
}

const cmp = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
const same = (a: unknown, b: unknown) => a !== null && a !== undefined && String(a) === String(b);
const like = (value: unknown, pattern: string) => value != null && String(value).toLowerCase().includes(pattern.replace(/%/g, "").toLowerCase());

class Query implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean; nullsFirst: boolean }[] = [];
  private window: [number, number] | null = null;
  private max: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private counting = false;
  private embedBookings = false;
  private singleMode: "single" | "maybe" | null = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(private table: string) {}

  select(cols = "*", opts?: { count?: string }) {
    if (this.mode !== "select") this.returning = true;
    this.counting = opts?.count === "exact";
    this.embedBookings = cols.includes("bookings!inner");
    return this;
  }
  insert(v: Row | Row[]) { this.mode = "insert"; this.payload = v; return this; }
  update(v: Row) { this.mode = "update"; this.payload = v; return this; }
  upsert(v: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { this.mode = "upsert"; this.payload = v; this.upsertOptions = opts; return this; }
  delete() { this.mode = "delete"; return this; }

  private where(f: (r: Row) => boolean) { this.filters.push(f); return this; }
  eq(c: string, v: unknown) { return this.where((r) => same(r[c], v)); }
  neq(c: string, v: unknown) { return this.where((r) => r[c] != null && !same(r[c], v)); }
  gt(c: string, v: unknown) { return this.where((r) => r[c] != null && cmp(r[c], v) > 0); }
  gte(c: string, v: unknown) { return this.where((r) => r[c] != null && cmp(r[c], v) >= 0); }
  lt(c: string, v: unknown) { return this.where((r) => r[c] != null && cmp(r[c], v) < 0); }
  lte(c: string, v: unknown) { return this.where((r) => r[c] != null && cmp(r[c], v) <= 0); }
  in(c: string, list: unknown[]) { return this.where((r) => list.some((v) => same(r[c], v))); }
  ilike(c: string, p: string) { return this.where((r) => like(r[c], p)); }
  not(c: string, op: string, v: unknown) {
    if (op === "is") return this.where((r) => r[c] != null);
    const list = String(v).replace(/^\(|\)$/g, "").split(",");
    return this.where((r) => r[c] != null && !list.includes(String(r[c])));
  }
  or(expr: string) {
    const parts = expr.split(",").map((p) => { const [col, op, ...rest] = p.split("."); return { col, op, value: rest.join(".") }; });
    return this.where((r) => parts.some(({ col, op, value }) => (op === "ilike" ? like(r[col], value) : same(r[col], value))));
  }
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const asc = opts.ascending !== false;
    this.orders.push({ col, asc, nullsFirst: opts.nullsFirst ?? !asc });
    return this;
  }
  range(from: number, to: number) { this.window = [from, to]; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((r: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }

  private base() {
    const t = tables();
    if (this.table === "booking_ledger") return ledger(t);
    if (this.table === "client_summary") return clientSummary(t);
    return (t[this.table as keyof DemoTables] ??= []);
  }

  private run(): Result {
    const t = tables();
    let rows: Row[];
    if (this.mode === "select") rows = this.base().filter((r) => this.filters.every((f) => f(r)));
    else rows = this.write(t);
    const count = rows.length;
    for (const o of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[o.col], y = b[o.col];
        if (x == null || y == null) return x == null && y == null ? 0 : (x == null) === o.nullsFirst ? -1 : 1;
        return o.asc ? cmp(x, y) : cmp(y, x);
      });
    }
    if (this.window) rows = rows.slice(this.window[0], this.window[1] + 1);
    if (this.max !== null) rows = rows.slice(0, this.max);
    if (this.embedBookings) rows = rows.map((p) => {
      const b = t.bookings.find((x) => x.id === p.booking_id) ?? {};
      return { ...p, bookings: { id: b.id, project_title: b.project_title, package_name: b.package_name, clients: { name: t.clients.find((c) => c.id === b.client_id)?.name } } };
    });
    const data = this.mode !== "select" && !this.returning ? null : rows;
    if (this.singleMode) {
      if (this.singleMode === "single" && rows.length !== 1) return { data: null, error: { message: "Expected one row", code: "PGRST116" } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data, error: null, count: this.counting ? count : null };
  }

  private write(t: DemoTables): Row[] {
    const table = (t[this.table as keyof DemoTables] ??= []);
    const now = new Date().toISOString();
    const input = Array.isArray(this.payload) ? this.payload : this.payload ? [this.payload] : [];
    if (this.mode === "insert" || this.mode === "upsert") {
      const out: Row[] = [];
      for (const v of input) {
        const key = this.upsertOptions.onConflict;
        const existing = key ? table.find((r) => same(r[key], v[key])) : undefined;
        if (existing) { if (!this.upsertOptions.ignoreDuplicates) { Object.assign(existing, v, { updated_at: now }); out.push(existing); } continue; }
        const row = this.withDefaults(v, now, t);
        table.push(row); out.push(row);
        this.afterInsert(row, t);
      }
      return out;
    }
    const matched = table.filter((r) => this.filters.every((f) => f(r)));
    if (this.mode === "delete") { for (const r of matched) table.splice(table.indexOf(r), 1); return matched; }
    for (const r of matched) {
      const before = r.status;
      Object.assign(r, this.payload, "updated_at" in r ? { updated_at: now } : {});
      if (this.table === "bookings" && before !== r.status) t.booking_events.push({ id: t.booking_events.length + 1000, booking_id: r.id, kind: "status_changed", from_status: before, to_status: r.status, detail: null, actor: "admin", occurred_at: now });
    }
    return matched;
  }

  private withDefaults(v: Row, now: string, t: DemoTables): Row {
    const numericId = ["booking_events", "notifications", "audit_logs"].includes(this.table);
    const base: Row = numericId ? { id: t[this.table as keyof DemoTables].length + 1000 } : this.table === "booking_addons" ? {} : { id: crypto.randomUUID() };
    const defaults: Record<string, Row> = {
      bookings: { status: "new_inquiry", source: "manual", addons_cents: 0, adjustment_cents: 0, deposit_required_cents: 0, reference: null, cal_uid: null, payment_link_url: null, payment_link_cents: null, created_at: now, updated_at: now },
      clients: { client_type: "other", created_at: now, updated_at: now },
      payments: { refunded_cents: 0, currency: "usd", created_at: now, updated_at: now },
      expenses: { receipt_path: null, created_at: now, updated_at: now },
      booking_events: { actor: "system", occurred_at: now },
      notifications: { status: "sending", created_at: now },
      audit_logs: { created_at: now },
    };
    return { ...base, ...(defaults[this.table] ?? {}), ...v };
  }

  // Mirrors the database triggers: timeline entries, and Final payment due → Paid.
  private afterInsert(row: Row, t: DemoTables) {
    const event = (booking_id: unknown, kind: string, detail: string | null, extra: Row = {}) =>
      t.booking_events.push({ id: t.booking_events.length + 1000, booking_id, kind, from_status: null, to_status: null, detail, actor: "admin", occurred_at: new Date().toISOString(), ...extra });
    if (this.table === "bookings") event(row.id, "created", "Added manually", { to_status: row.status });
    if (this.table === "payments" && row.status === "succeeded") {
      event(row.booking_id, "payment_received", `${String(row.type)[0].toUpperCase()}${String(row.type).slice(1)} payment of $${(row.amount_cents / 100).toFixed(2)}`);
      const booking = t.bookings.find((b) => b.id === row.booking_id);
      const l = ledger(t).find((b) => b.id === row.booking_id);
      if (booking && l && booking.status === "final_payment_due" && l.balance_cents === 0) {
        booking.status = "paid";
        event(booking.id, "status_changed", null, { from_status: "final_payment_due", to_status: "paid" });
      }
    }
  }
}

const demoStorage = { from: () => ({
  upload: async () => ({ data: null, error: { message: "Receipts are not stored in demo mode." } }),
  remove: async () => ({ data: [], error: null }),
  createSignedUrl: async () => ({ data: null, error: { message: "Demo mode" } }),
}) };

export function createDemoClient() {
  return { from: (table: string) => new Query(table), storage: demoStorage } as unknown as SupabaseClient;
}
