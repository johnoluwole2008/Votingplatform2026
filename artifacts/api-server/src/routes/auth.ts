import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  studentRecordsTable,
} from "@workspace/db";
import {
  hashPassword,
  verifyPassword,
  isAccountLocked,
  recordLoginAttempt,
  getClientIp,
} from "../lib/auth";
import { logAuditEvent } from "../lib/audit";
import { getElectionPhase } from "../lib/election";
import { LoginVoterBody, RegisterVoterBody } from "@workspace/api-zod";

const router = Router();

// ── Register ──────────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration details." });
    return;
  }

  const { matricNumber, email, fullName, level, password } = parsed.data;

  const { registrationOpen } = await getElectionPhase();
  if (!registrationOpen) {
    res.status(403).json({ error: "Voter registration is not currently open." });
    return;
  }

  const normalizedMatric = matricNumber.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();

  const [student] = await db
    .select()
    .from(studentRecordsTable)
    .where(
      and(
        eq(studentRecordsTable.matricNumber, normalizedMatric),
        eq(studentRecordsTable.email, normalizedEmail),
      ),
    )
    .limit(1);

  if (!student) {
    res.status(404).json({
      error: "No matching student record found. Check your matric number and school email address, or contact the Electoral Committee.",
    });
    return;
  }

  if (student.personalCodeHash) {
    res.status(409).json({
      error: "You have already registered. Use the Login page to access the ballot.",
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(studentRecordsTable)
    .set({ personalCodeHash: passwordHash })
    .where(eq(studentRecordsTable.id, student.id));

  await logAuditEvent({
    eventType: "voter_registered",
    description: `Voter registered: ${student.fullName} (${normalizedMatric})`,
    actorId: normalizedMatric,
    actorType: "student",
    ipAddress: getClientIp(req),
  });

  res.status(201).json({ success: true, message: "Registration successful. You can now log in on Election Day." });
});

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
