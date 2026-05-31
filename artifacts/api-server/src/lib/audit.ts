import { db, auditLogsTable } from "@workspace/db";

type ActorType = "student" | "admin" | "system";

interface AuditEntry {
  eventType: string;
  description: string;
  actorId?: string;
  actorType?: ActorType;
  ipAddress?: string;
  metadata?: string;
}

export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      eventType: entry.eventType,
      description: entry.description,
      actorId: entry.actorId ?? null,
      actorType: entry.actorType ?? "system",
      ipAddress: entry.ipAddress ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch {
    // audit log failures should never crash the main request
  }
}
