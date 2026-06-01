import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import crypto from "crypto";
import {
  db,
  officesTable,
  candidatesTable,
  votesTable,
  studentRecordsTable,
} from "@workspace/db";
import { logAuditEvent } from "../lib/audit";
import { getElectionPhase } from "../lib/election";
import { SubmitBallotBody } from "@workspace/api-zod";

const router = Router();

function requireVoterSession(req: any, res: any): boolean {
  if (!req.session.voterId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

router.get("/ballot", async (req, res): Promise<void> => {
  if (!requireVoterSession(req, res)) return;

  const { votingOpen } = await getElectionPhase();
  if (!votingOpen) {
    res.status(403).json({ error: "Voting is not currently open." });
    return;
  }

  const [student] = await db
    .select()
    .from(studentRecordsTable)
    .where(eq(studentRecordsTable.id, req.session.voterId!))
    .limit(1);

  if (!student) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  if (student.hasVoted) {
    res.status(403).json({ error: "You have already cast your vote." });
    return;
  }

  const offices = await db
    .select()
    .from(officesTable)
    .orderBy(officesTable.displayOrder);

  const candidates = await db.select().from(candidatesTable);

  const ballot = offices.map((office) => ({
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
  }));

  res.json({
    offices: ballot,
    voterName: student.fullName,
    voterLevel: student.level,
  });
});

router.post("/ballot/submit", async (req, res): Promise<void> => {
  if (!requireVoterSession(req, res)) return;

  const { votingOpen } = await getElectionPhase();
  if (!votingOpen) {
    res.status(403).json({ error: "Voting is not currently open." });
    return;
  }

  const parsed = SubmitBallotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const studentId = req.session.voterId!;

  const [student] = await db
    .select()
    .from(studentRecordsTable)
    .where(eq(studentRecordsTable.id, studentId))
    .limit(1);

  if (!student) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  if (student.hasVoted) {
    res.status(403).json({ error: "You have already cast your vote." });
    return;
  }

  const offices = await db.select().from(officesTable);
  const officeIds = offices.map((o) => o.id);
  const { votes } = parsed.data;

  const votedOfficeIds = votes.map((v) => v.officeId);
  const missingOffices = officeIds.filter((id) => !votedOfficeIds.includes(id));
  if (missingOffices.length > 0) {
    res.status(400).json({
      error: "You must cast a vote for every office on the ballot.",
    });
    return;
  }

  const candidateIds = votes.map((v) => v.candidateId);
  const validCandidates = await db
    .select()
    .from(candidatesTable)
    .where(inArray(candidatesTable.id, candidateIds));

  for (const vote of votes) {
    const candidate = validCandidates.find((c) => c.id === vote.candidateId);
    if (!candidate || candidate.officeId !== vote.officeId) {
      res.status(400).json({ error: "Invalid ballot — candidate mismatch." });
      return;
    }
  }

  await db
    .update(studentRecordsTable)
    .set({ hasVoted: true, voteTimestamp: new Date() })
    .where(eq(studentRecordsTable.id, studentId));

  const sessionToken = req.sessionID;
  for (const vote of votes) {
    const voteHash = crypto
      .createHash("sha256")
      .update(`${sessionToken}:${vote.officeId}:${vote.candidateId}:${Date.now()}`)
      .digest("hex");

    await db.insert(votesTable).values({
      officeId: vote.officeId,
      candidateId: vote.candidateId,
      voteHash,
    });
  }

  req.session.destroy(() => {});

  await logAuditEvent({
    eventType: "vote_cast",
    description: `Vote cast for ${votes.length} offices`,
    actorId: student.matricNumber,
    actorType: "student",
    ipAddress: undefined,
    metadata: JSON.stringify({ officeCount: votes.length }),
  });

  res.json({ success: true, message: "Your vote has been recorded." });
});

export default router;
