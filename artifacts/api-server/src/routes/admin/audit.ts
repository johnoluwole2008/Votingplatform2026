import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  return true;
}

router.get("/admin/audit-logs", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { event, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, parseInt(limit, 10) || 50);
  const offset = (pageNum - 1) * limitNum;

  const whereClause = event ? eq(auditLogsTable.eventType, event) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(auditLogsTable).where(whereClause);

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(whereClause)
    .orderBy(auditLogsTable.createdAt)
    .limit(limitNum)
    .offset(offset);

  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      eventType: l.eventType,
      description: l.description,
      actorId: l.actorId ?? null,
      actorType: l.actorType,
      ipAddress: l.ipAddress ?? null,
      createdAt: l.createdAt.toISOString(),
      metadata: l.metadata ?? null,
    })),
    total: Number(totalResult?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/admin/audit-logs/export", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const logs = await db.select().from(auditLogsTable).orderBy(auditLogsTable.createdAt);

  const header = "ID,Event Type,Description,Actor,Actor Type,IP Address,Timestamp\n";
  const rows = logs
    .map((l) =>
      [
        l.id,
        l.eventType,
        `"${l.description.replace(/"/g, '""')}"`,
        l.actorId ?? "",
        l.actorType,
        l.ipAddress ?? "",
        l.createdAt.toISOString(),
      ].join(","),
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-log-export.csv"');
  res.send(header + rows);
});

export default router;
