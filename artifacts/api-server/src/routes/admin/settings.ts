import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, electionSettingsTable } from "@workspace/db";
import { logAuditEvent } from "../../lib/audit";
import { getOrCreateSettings } from "../../lib/election";
import { UpdateElectionSettingsBody } from "@workspace/api-zod";

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

function formatSettings(s: any) {
  return {
    id: s.id,
    electionName: s.electionName,
    registrationStart: s.registrationStart?.toISOString() ?? null,
    registrationEnd: s.registrationEnd?.toISOString() ?? null,
    votingStart: s.votingStart?.toISOString() ?? null,
    votingEnd: s.votingEnd?.toISOString() ?? null,
    showLiveResults: s.showLiveResults,
    totalExpectedVoters: s.totalExpectedVoters,
  };
}

router.get("/admin/settings", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const settings = await getOrCreateSettings();
  res.json(formatSettings(settings));
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;

  const parsed = UpdateElectionSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await getOrCreateSettings();

  const updates: Record<string, unknown> = {
    electionName: parsed.data.electionName,
    showLiveResults: parsed.data.showLiveResults,
    totalExpectedVoters: parsed.data.totalExpectedVoters,
    registrationStart: parsed.data.registrationStart ? new Date(parsed.data.registrationStart) : null,
    registrationEnd: parsed.data.registrationEnd ? new Date(parsed.data.registrationEnd) : null,
    votingStart: parsed.data.votingStart ? new Date(parsed.data.votingStart) : null,
    votingEnd: parsed.data.votingEnd ? new Date(parsed.data.votingEnd) : null,
  };

  const [updated] = await db
    .update(electionSettingsTable)
    .set(updates)
    .where(eq(electionSettingsTable.id, existing.id))
    .returning();

  await logAuditEvent({
    eventType: "settings_updated",
    description: `Admin updated election settings`,
    actorId: String(req.session.adminId),
    actorType: "admin",
    metadata: JSON.stringify(parsed.data),
  });

  res.json(formatSettings(updated ?? existing));
});

export default router;
