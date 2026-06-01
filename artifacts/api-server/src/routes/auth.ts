import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  studentRecordsTable,
} from "@workspace/db";
import {
  verifyPassword,
  isAccountLocked,
  recordLoginAttempt,
  getClientIp,
} from "../lib/auth";
import { logAuditEvent } from "../lib/audit";
import { getElectionPhase } from "../lib/election";
import { LoginVoterBody } from "@workspace/api-zod";

const router = Router();

// ── Login ─────────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { matricNumber, email, personalCode } = parsed.data;
  const ip = getClientIp(req);

  const { votingOpen } = await getElectionPhase();
  if (!votingOpen) {
    res.status(403).json({ error: "Voting is not currently open." });
    return;
  }

  if (await isAccountLocked(matricNumber.toUpperCase())) {
    res.status(401).json({
      error:
        "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
    });
    return;
  }

  const [student] = await db
    .select()
    .from(studentRecordsTable)
    .where(
      and(
        eq(studentRecordsTable.matricNumber, matricNumber.toUpperCase()),
        eq(studentRecordsTable.email, email.toLowerCase()),
      ),
    )
    .limit(1);

  if (!student) {
    await recordLoginAttempt(matricNumber.toUpperCase(), ip, false);
    await logAuditEvent({
      eventType: "login_failed",
      description: `Failed login — matric/email not found: ${matricNumber}`,
      actorId: matricNumber,
      actorType: "student",
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid matric number, email, or personal code." });
    return;
  }

  if (!student.personalCodeHash) {
    await recordLoginAttempt(matricNumber.toUpperCase(), ip, false);
    res.status(401).json({
      error: "No personal code set for this account. Contact the Electoral Committee.",
    });
    return;
  }

  const valid = await verifyPassword(personalCode, student.personalCodeHash);
  if (!valid) {
    await recordLoginAttempt(matricNumber.toUpperCase(), ip, false);
    await logAuditEvent({
      eventType: "login_failed",
      description: `Failed login — wrong personal code for ${matricNumber}`,
      actorId: matricNumber,
      actorType: "student",
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid matric number, email, or personal code." });
    return;
  }

  await recordLoginAttempt(matricNumber.toUpperCase(), ip, true);

  req.session.voterId = student.id;
  req.session.matricNumber = student.matricNumber;

  await logAuditEvent({
    eventType: "login_success",
    description: `Student ${student.fullName} logged in`,
    actorId: student.matricNumber,
    actorType: "student",
    ipAddress: ip,
  });

  res.json({
    id: student.id,
    matricNumber: student.matricNumber,
    fullName: student.fullName,
    level: student.level,
    hasVoted: student.hasVoted,
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// ── Session ────────────────────────────────────────────────────────────────────

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.voterId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentRecordsTable)
    .where(eq(studentRecordsTable.id, req.session.voterId))
    .limit(1);

  if (!student) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json({
    id: student.id,
    matricNumber: student.matricNumber,
    fullName: student.fullName,
    level: student.level,
    hasVoted: student.hasVoted,
  });
});

export default router;
