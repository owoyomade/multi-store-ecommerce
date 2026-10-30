import { db } from "@/server/db";

// Used by Docker and the hosting platform to check the app and database are up.
// Returns no internal details, only "ok" or "unavailable".
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
