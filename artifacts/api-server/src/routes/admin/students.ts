import { Router } from "express";
import { eq, count, and, sql } from "drizzle-orm";
import { db, studentRecordsTable } from "@workspace/db";
import { logAuditEvent } from "../../lib/audit";
import { ImportStudentRecordsBody } from "@workspace/api-zod";
import { hashPassword } from "../../lib/auth";

const router = Router();

function requireEditor(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (req.session.adminRole === "observer") {
    res.status(403).json({ error: "Observers cannot make changes." }); return false;
  }
  return true;
}

function requireAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  return true;
}

router.get("/admin/student-records", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { search, level, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, parseInt(limit, 10) || 50);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (level) conditions.push(eq(studentRecordsTable.level, level as never));
  if (search) {
    conditions.push(
      sql`(${studentRecordsTable.fullName} ilike ${"%" + search + "%"} or ${studentRecordsTable.matricNumber} ilike ${"%" + search + "%"})`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(studentRecordsTable).where(whereClause);

  const records = await db
    .select()
    .from(studentRecordsTable)
    .where(whereClause)
    .orderBy(studentRecordsTable.matricNumber)
    .limit(limitNum)
    .offset(offset);

  res.json({
    students: records.map((r) => ({
      id: r.id,
      matricNumber: r.matricNumber,
      email: r.email,
      fullName: r.fullName,
      level: r.level,
      hasVoted: r.hasVoted,
    })),
    total: Number(totalResult?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/admin/student-records", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const parsed = ImportStudentRecordsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { records } = parsed.data;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      let personalCodeHash: string | undefined;
      if (record.personalCode && record.personalCode.trim().length > 0) {
        personalCodeHash = await hashPassword(record.personalCode.trim());
      }

      const values: any = {
        matricNumber: record.matricNumber.toUpperCase(),
        email: record.email.toLowerCase(),
        fullName: record.fullName,
        level: record.level as never,
      };

      if (personalCodeHash) {
        values.personalCodeHash = personalCodeHash;
      }

      await db
        .insert(studentRecordsTable)
        .values(values)
        .onConflictDoUpdate({
          target: studentRecordsTable.matricNumber,
          set: {
            email: record.email.toLowerCase(),
            fullName: record.fullName,
            level: record.level as never,
            ...(personalCodeHash ? { personalCodeHash } : {}),
          },
        });
      imported++;
    } catch {
      errors++;
    }
  }

  await logAuditEvent({
    eventType: "student_records_imported",
    description: `Admin imported ${imported} student records (${skipped} skipped, ${errors} errors)`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({
    imported,
    skipped,
    errors,
    message: `Successfully imported ${imported} records.`,
  });
});

export default router;
