import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  studentRecordsTable,
  voterRegistrationsTable,
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
import { RegisterVoterBody, LoginVoterBody } from "@workspace/api-zod";

const router = Router();

// ── Register ─────────────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { matricNumber, email, password, fullName, level } = parsed.data;
  const ip = getClientIp(req);

  const { registrationOpen } = await getElectionPhase();
  if (!registrationOpen) {
    res.status(403).json({ error: "Registration is not currently open." });
    return;
  }

  // Validate matric-email pair against official records
  const [record] = await db
    .select()
    .from(studentRecordsTable)
    .where(eq(studentRecordsTable.matricNumber, matricNumber.toUpperCase()))
    .limit(1);

  if (!record) {
    await logAuditEvent({
      eventType: "registration_failed",
      description: `Registration attempt with unknown matric number: ${matricNumber}`,
      actorId: matricNumber,
      actorType: "student",
      ipAddress: ip,
    });
    res.status(400).json({
      error: "Matric number not found in official student records.",
    });
    return;
  }

  if (record.email.toLowerCase() !== email.toLowerCase()) {
    await logAuditEvent({
      eventType: "registration_failed",
      description: `Email-matric mismatch for matric number: ${matricNumber}`,
      actorId: matricNumber,
      actorType: "student",
      ipAddress: ip,
    });
    res.status(400).json({
      error:
        "The email address does not match the one on record for this matric number.",
    });
    return;
  }

  // Check for duplicate registration
  const [existing] = await db
    .select({ id: voterRegistrationsTable.id })
    .from(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.matricNumber, matricNumber.toUpperCase()))
    .limit(1);

  if (existing) {
    res.status(409).json({
      error: "This matric number has already been registered.",
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  const [voter] = await db
    .insert(voterRegistrationsTable)
    .values({
      matricNumber: matricNumber.toUpperCase(),
      email: email.toLowerCase(),
      fullName,
      level: level as never,
      passwordHash,
      ipAddress: ip ?? null,
    })
    .returning();

  await logAuditEvent({
    eventType: "registration_success",
    description: `Student ${fullName} (${matricNumber}) registered successfully`,
    actorId: matricNumber,
    actorType: "student",
    ipAddress: ip,
  });

  res.status(201).json({
    success: true,
    message: "Registration successful. You can now vote on Election Day.",
    matricNumber: voter.matricNumber,
    fullName: voter.fullName,
    level: voter.level,
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginVoterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { matricNumber, password } = parsed.data;
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

  const [voter] = await db
    .select()
    .from(voterRegistrationsTable)
    .where(
      eq(voterRegistrationsTable.matricNumber, matricNumber.toUpperCase()),
    )
    .limit(1);

  if (!voter) {
    await recordLoginAttempt(matricNumber.toUpperCase(), ip, false);
    await logAuditEvent({
      eventType: "login_failed",
      description: `Failed login attempt — matric number not registered: ${matricNumber}`,
      actorId: matricNumber,
      actorType: "student",
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid matric number or password." });
    return;
  }

  const valid = await verifyPassword(password, voter.passwordHash);
  if (!valid) {
    await recordLoginAttempt(matricNumber.toUpperCase(), ip, false);
    await logAuditEvent({
      eventType: "login_failed",
      description: `Failed login attempt for ${matricNumber}`,
      actorId: matricNumber,
      actorType: "student",
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid matric number or password." });
    return;
  }

  await recordLoginAttempt(matricNumber.toUpperCase(), ip, true);

  req.session.voterId = voter.id;
  req.session.matricNumber = voter.matricNumber;

  await logAuditEvent({
    eventType: "login_success",
    description: `Student ${voter.fullName} logged in`,
    actorId: voter.matricNumber,
    actorType: "student",
    ipAddress: ip,
  });

  res.json({
    id: voter.id,
    matricNumber: voter.matricNumber,
    fullName: voter.fullName,
    level: voter.level,
    hasVoted: voter.hasVoted,
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

  const [voter] = await db
    .select()
    .from(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.id, req.session.voterId))
    .limit(1);

  if (!voter) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json({
    id: voter.id,
    matricNumber: voter.matricNumber,
    fullName: voter.fullName,
    level: voter.level,
    hasVoted: voter.hasVoted,
  });
});

export default router;
