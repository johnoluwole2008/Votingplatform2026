import { Router } from "express";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { db, voterRegistrationsTable } from "@workspace/db";
import { logAuditEvent } from "../../lib/audit";
import { UpdateVoterBody, UpdateVoterParams } from "@workspace/api-zod";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

function requireEditor(req: any, res: any): boolean {
  if (!requireAdmin(req, res)) return false;
  if (req.session.adminRole === "observer") {
    res.status(403).json({ error: "Observers cannot make changes." });
    return false;
  }
  return true;
}

router.get("/admin/voters", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { level, voted, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (level) conditions.push(eq(voterRegistrationsTable.level, level as never));
  if (voted === "true") conditions.push(eq(voterRegistrationsTable.hasVoted, true));
  if (voted === "false") conditions.push(eq(voterRegistrationsTable.hasVoted, false));
  if (search) {
    conditions.push(
      sql`(${voterRegistrationsTable.fullName} ilike ${"%" + search + "%"} or ${voterRegistrationsTable.matricNumber} ilike ${"%" + search + "%"})`,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(voterRegistrationsTable)
    .where(whereClause);

  const voters = await db
    .select()
    .from(voterRegistrationsTable)
    .where(whereClause)
    .orderBy(voterRegistrationsTable.registrationTimestamp)
    .limit(limitNum)
    .offset(offset);

  res.json({
    voters: voters.map((v) => ({
      id: v.id,
      matricNumber: v.matricNumber,
      fullName: v.fullName,
      email: v.email,
      level: v.level,
      hasVoted: v.hasVoted,
      registrationTimestamp: v.registrationTimestamp.toISOString(),
      ipAddress: v.ipAddress ?? null,
      voteTimestamp: v.voteTimestamp?.toISOString() ?? null,
    })),
    total: Number(totalResult?.count ?? 0),
    page: pageNum,
    limit: limitNum,
  });
});

router.patch("/admin/voters/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateVoterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.fullName) updates.fullName = parsed.data.fullName;
  if (parsed.data.level) updates.level = parsed.data.level;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(voterRegistrationsTable)
    .set(updates)
    .where(eq(voterRegistrationsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Voter not found" }); return; }

  await logAuditEvent({
    eventType: "voter_record_edited",
    description: `Admin edited voter ${updated.matricNumber}: ${JSON.stringify(updates)}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({
    id: updated.id,
    matricNumber: updated.matricNumber,
    fullName: updated.fullName,
    email: updated.email,
    level: updated.level,
    hasVoted: updated.hasVoted,
    registrationTimestamp: updated.registrationTimestamp.toISOString(),
    ipAddress: updated.ipAddress ?? null,
    voteTimestamp: updated.voteTimestamp?.toISOString() ?? null,
  });
});

router.delete("/admin/voters/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db
    .delete(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Voter not found" }); return; }

  await logAuditEvent({
    eventType: "voter_registration_deleted",
    description: `Admin deleted voter registration for ${deleted.matricNumber}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ success: true, message: "Voter registration deleted" });
});

router.get("/admin/voters/export", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const voters = await db
    .select()
    .from(voterRegistrationsTable)
    .orderBy(voterRegistrationsTable.registrationTimestamp);

  const header = "Full Name,Matric Number,Level,Email,Registration Date,IP Address,Has Voted\n";
  const rows = voters
    .map((v) =>
      [
        `"${v.fullName}"`,
        v.matricNumber,
        v.level,
        v.email,
        v.registrationTimestamp.toISOString(),
        v.ipAddress ?? "",
        v.hasVoted ? "Yes" : "No",
      ].join(","),
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="voters-export.csv"',
  );
  res.send(header + rows);
});

export default router;
