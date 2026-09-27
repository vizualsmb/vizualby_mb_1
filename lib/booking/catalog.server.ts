import "server-only";
import { bookingPackages, depositFor, type BookingCategory, type BookingPackage } from "@/data/booking";
import { createSupabaseService, type AdminSupabaseClient } from "@/lib/supabase/service";

export type PackageRow = {
  package_id: string; category: BookingCategory; name: string; tagline: string; price_cents: number;
  deposit_percent: number; duration_minutes: number; locations: number; location_label: string | null;
  revisions: number; delivery: string; includes: string[]; featured: boolean; inquiry_only: boolean;
  starting_price: boolean; active: boolean; sort_order: number;
};

export function packageFromRow(row: PackageRow, base?: BookingPackage): BookingPackage {
  return {
    id: row.package_id, category: row.category, name: row.name, tagline: row.tagline,
    price: row.price_cents, depositPercent: Number(row.deposit_percent),
    deposit: depositFor(row.price_cents, Number(row.deposit_percent)), minutes: row.duration_minutes,
    locations: row.locations, locationLabel: row.location_label ?? undefined, revisions: row.revisions,
    delivery: row.delivery, includes: row.includes, featured: row.featured, inquiryOnly: row.inquiry_only,
    startingPrice: row.starting_price, addonIds: base?.addonIds,
  };
}

async function loadCatalog(db: AdminSupabaseClient, strict: boolean) {
  const { data, error } = await db.from("service_packages").select("*").order("sort_order").order("created_at");
  if (error) {
    if (strict) throw new Error("Catalog unavailable");
    return bookingPackages;
  }
  const rows = (data ?? []) as PackageRow[];
  const overrides = new Map(rows.map((row) => [row.package_id, row]));
  const fallbackOrder = new Map(bookingPackages.map((pkg, index) => [pkg.id, (index + 1) * 10]));
  const merged = bookingPackages.flatMap((pkg) => {
    const row = overrides.get(pkg.id);
    if (!row) return [pkg];
    overrides.delete(pkg.id);
    return row.active ? [packageFromRow(row, pkg)] : [];
  });
  for (const row of overrides.values()) if (row.active) merged.push(packageFromRow(row));
  const storedOrder = new Map(rows.map((row) => [row.package_id, row.sort_order]));
  return merged.sort((a, b) => (storedOrder.get(a.id) ?? fallbackOrder.get(a.id) ?? 10000) - (storedOrder.get(b.id) ?? fallbackOrder.get(b.id) ?? 10000));
}

export async function catalogPackages(client?: AdminSupabaseClient | null) {
  const db = client === undefined ? createSupabaseService() : client;
  if (!db) return bookingPackages;
  return loadCatalog(db, false);
}

// Checkout paths may use the code catalog when Supabase is intentionally absent,
// but never silently replace an admin-managed catalog during a database outage.
export async function checkoutCatalogPackages() {
  const db = createSupabaseService();
  return db ? loadCatalog(db, true) : bookingPackages;
}

export async function packageRows(client: AdminSupabaseClient) {
  const { data } = await client.from("service_packages").select("*").order("sort_order").order("created_at");
  return (data ?? []) as PackageRow[];
}
