import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type AuditEntry = {
  storeId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  // IDs and changed field names only — no personal data.
  metadata?: Prisma.InputJsonValue;
};

/**
 * Writes an audit row inside the caller's transaction, so the log entry and
 * the change it describes are saved together or not at all.
 */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
