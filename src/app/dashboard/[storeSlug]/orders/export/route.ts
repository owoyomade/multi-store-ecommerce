import { getCurrentUser } from "@/server/auth/session";
import {
  consumeRateLimit,
  RATE_LIMITS,
  RateLimitedError,
} from "@/server/rate-limit";
import { roleHasPermission } from "@/server/permissions/roles";
import { exportOrdersCsv } from "@/server/services/reports";
import { getStoreContextForUser } from "@/server/tenancy/store-context";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-01" → midnight UTC that day, or null if it isn't a real date. */
function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// GET /dashboard/<store>/orders/export?from=2026-10-01&to=2026-10-31
// Both days are included. Defaults to the last 30 days.
export async function GET(
  request: Request,
  { params }: RouteContext<"/dashboard/[storeSlug]/orders/export">,
) {
  const { storeSlug } = await params;
  const user = await getCurrentUser();
  // Same answer for "not signed in", "not a member" and "no such store", so
  // the URL can't be used to discover which stores exist.
  const context = user
    ? await getStoreContextForUser(user.id, storeSlug)
    : null;
  if (!context) return new Response("Not found", { status: 404 });
  if (!roleHasPermission(context.role, "reports:view"))
    return new Response("Forbidden", { status: 403 });

  try {
    await consumeRateLimit(
      `export:${context.userId}`,
      RATE_LIMITS.ordersExport,
    );
  } catch (error) {
    if (error instanceof RateLimitedError)
      return new Response(error.message, { status: 429 });
    throw error;
  }

  const search = new URL(request.url).searchParams;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const lastDay = parseDay(search.get("to")) ?? today;
  const from =
    parseDay(search.get("from")) ?? new Date(lastDay.getTime() - 29 * DAY_MS);
  if (from > lastDay)
    return new Response("The start date must be on or before the end date.", {
      status: 400,
    });

  const csv = await exportOrdersCsv(context, {
    from,
    to: new Date(lastDay.getTime() + DAY_MS),
  });
  const fileName = `${storeSlug}-orders-${from.toISOString().slice(0, 10)}-to-${lastDay.toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // Customer emails are in here, so browsers and proxies must not keep a copy.
      "Cache-Control": "no-store",
    },
  });
}
