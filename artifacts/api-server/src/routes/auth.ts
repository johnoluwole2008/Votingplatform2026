import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, voterRegistrationsTable } from "@workspace/db";
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

  const [existing] = await db
    .select()
    .from(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.matricNumber, normalizedMatric))
    .limit(1);

  if (existing) {
    if (!existing.passwordHash) {
      if (existing.email !== normalizedEmail) {
        res.status(409).json({
          error: "Your matric number is on the import list but the email doesn't match. Contact the Electoral Committee.",
        });
        return;
      }
      const passwordHash = await hashPassword(password);
      await db
        .update(voterRegistrationsTable)
        .set({ passwordHash, personalCode: password, fullName, level: level as never })
        .where(eq(voterRegistrationsTable.id, existing.id));

      await logAuditEvent({
        eventType: "voter_registered",
        description: `Voter activated imported account: ${fullName} (${normalizedMatric})`,
        actorId: normalizedMatric,
        actorType: "student",
        ipAddress: getClientIp(req),
      });

      res.status(200).json({ success: true, message: "Registration successful. You can now log in on Election Day." });
      return;
    }

    res.status(409).json({ error: "You have already registered. Use the Login page to access the ballot." });
    return;
  }

  const [emailConflict] = await db
    .select()
    .from(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.email, normalizedEmail))
    .limit(1);

  if (emailConflict) {
    res.status(409).json({ error: "This email address is already registered. Use the Login page." });
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.insert(voterRegistrationsTable).values({
    matricNumber: normalizedMatric,
    email: normalizedEmail,
    fullName,
    level: level as never,
    passwordHash,
    personalCode: password,
    ipAddress: getClientIp(req) ?? null,
  });

  await logAuditEvent({
    eventType: "voter_registered",
    description: `Voter registered: ${fullName} (${normalizedMatric})`,
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
      error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
    });
    return;
  }

  const [voter] = await db
    .select()
    .from(voterRegistrationsTable)
    .where(
      and(
        eq(voterRegistrationsTable.matricNumber, matricNumber.toUpperCase()),
        eq(voterRegistrationsTable.email, email.toLowerCase()),
      ),
    )
    .limit(1);

  if (!voter) {
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

  if (!voter.passwordHash) {
    await recordLoginAttempt(matricNumber.toUpperCase(), ip, false);
    res.status(401).json({
      error: "Your account hasn't been activated yet. Please complete your registration on the registration page to set a password.",
    });
    return;
  }

  const valid = await verifyPassword(personalCode, voter.passwordHash);
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

// ── Session ───────────────────────────────────────────────────────────────────

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
