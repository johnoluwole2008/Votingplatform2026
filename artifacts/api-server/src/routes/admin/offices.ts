import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, officesTable, candidatesTable } from "@workspace/db";
import { logAuditEvent } from "../../lib/audit";
import {
  CreateOfficeBody,
  UpdateOfficeBody,
  UpdateOfficeParams,
  DeleteOfficeParams,
  CreateCandidateBody,
  UpdateCandidateBody,
  UpdateCandidateParams,
  DeleteCandidateParams,
} from "@workspace/api-zod";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  return true;
}

function requireEditor(req: any, res: any): boolean {
  if (!requireAdmin(req, res)) return false;
  if (req.session.adminRole === "observer") {
    res.status(403).json({ error: "Observers cannot make changes." }); return false;
  }
  return true;
}

function formatOffice(office: any, candidates: any[]) {
  return {
    id: office.id,
    title: office.title,
    description: office.description ?? null,
    displayOrder: office.displayOrder,
    candidates: candidates
      .filter((c) => c.officeId === office.id)
      .map((c) => ({
        id: c.id,
        officeId: c.officeId,
        fullName: c.fullName,
        bio: c.bio ?? null,
        photoUrl: c.photoUrl ?? null,
        level: c.level ?? null,
      })),
  };
}

router.get("/admin/offices", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const offices = await db.select().from(officesTable).orderBy(officesTable.displayOrder);
  const candidates = await db.select().from(candidatesTable);

  res.json(offices.map((o) => formatOffice(o, candidates)));
});

router.post("/admin/offices", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const parsed = CreateOfficeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [office] = await db.insert(officesTable).values(parsed.data).returning();

  await logAuditEvent({
    eventType: "office_created",
    description: `Admin created office: ${office.title}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.status(201).json(formatOffice(office, []));
});

router.put("/admin/offices/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateOfficeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [office] = await db.update(officesTable).set(parsed.data).where(eq(officesTable.id, id)).returning();
  if (!office) { res.status(404).json({ error: "Office not found" }); return; }

  const candidates = await db.select().from(candidatesTable).where(eq(candidatesTable.officeId, id));

  await logAuditEvent({
    eventType: "office_updated",
    description: `Admin updated office: ${office.title}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json(formatOffice(office, candidates));
});

router.delete("/admin/offices/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db.delete(officesTable).where(eq(officesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Office not found" }); return; }

  await logAuditEvent({
    eventType: "office_deleted",
    description: `Admin deleted office: ${deleted.title}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ success: true, message: "Office deleted" });
});

// ── Candidates ────────────────────────────────────────────────────────────────

router.post("/admin/candidates", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const parsed = CreateCandidateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [candidate] = await db.insert(candidatesTable).values(parsed.data).returning();

  await logAuditEvent({
    eventType: "candidate_created",
    description: `Admin added candidate: ${candidate.fullName}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.status(201).json({
    id: candidate.id,
    officeId: candidate.officeId,
    fullName: candidate.fullName,
    bio: candidate.bio ?? null,
    photoUrl: candidate.photoUrl ?? null,
    level: candidate.level ?? null,
  });
});

router.put("/admin/candidates/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateCandidateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [candidate] = await db.update(candidatesTable).set(parsed.data).where(eq(candidatesTable.id, id)).returning();
  if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }

  res.json({
    id: candidate.id,
    officeId: candidate.officeId,
    fullName: candidate.fullName,
    bio: candidate.bio ?? null,
    photoUrl: candidate.photoUrl ?? null,
    level: candidate.level ?? null,
  });
});

router.delete("/admin/candidates/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [deleted] = await db.delete(candidatesTable).where(eq(candidatesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Candidate not found" }); return; }

  await logAuditEvent({
    eventType: "candidate_deleted",
    description: `Admin deleted candidate: ${deleted.fullName}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ success: true, message: "Candidate deleted" });
});

export default router;
