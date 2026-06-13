import { Router } from "express";
import nodemailer from "nodemailer";
import { eq, and, lte, sql } from "drizzle-orm";
import { db, electionSettingsTable, studentRecordsTable } from "@workspace/db";
import { logAuditEvent } from "../../lib/audit";
import { getOrCreateSettings } from "../../lib/election";

const router = Router();

function requireEditor(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (req.session.adminRole === "observer") { res.status(403).json({ error: "Observers cannot send emails." }); return false; }
  return true;
}

function requireSuperAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (req.session.adminRole !== "super_admin") { res.status(403).json({ error: "Super admin required." }); return false; }
  return true;
}

async function getSmtpConfig() {
  const settings = await getOrCreateSettings() as any;
  return {
    host: settings.smtpHost ?? null,
    port: settings.smtpPort ?? 587,
    user: settings.smtpUser ?? null,
    pass: settings.smtpPass ?? null,
    from: settings.smtpFrom ?? null,
    fromName: settings.smtpFromName ?? "PharmSci E-Voting",
  };
}

function createTransporter(cfg: { host: string; port: number; user: string; pass: string }) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  });
}

// GET /admin/email/settings
router.get("/admin/email/settings", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const cfg = await getSmtpConfig();
  res.json({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    from: cfg.from,
    fromName: cfg.fromName,
    configured: !!(cfg.host && cfg.user && cfg.pass),
  });
});

// POST /admin/email/settings
router.post("/admin/email/settings", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const { host, port, user, pass, from, fromName } = req.body;
  const settings = await getOrCreateSettings();
  await db.update(electionSettingsTable)
    .set({
      smtpHost: host || null,
      smtpPort: port ? parseInt(port, 10) : 587,
      smtpUser: user || null,
      smtpPass: pass || null,
      smtpFrom: from || null,
      smtpFromName: fromName || "PharmSci E-Voting",
    } as any)
    .where(eq(electionSettingsTable.id, settings.id));
  await logAuditEvent({ eventType: "smtp_settings_updated", description: "SMTP settings updated", actorId: String(req.session.adminId), actorType: "admin" });
  res.json({ success: true });
});

// POST /admin/email/test
router.post("/admin/email/test", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    res.status(400).json({ error: "SMTP not configured. Save settings first." }); return;
  }
  const { testEmail } = req.body;
  if (!testEmail) { res.status(400).json({ error: "Provide a test email address." }); return; }
  try {
    const transporter = createTransporter({ host: cfg.host!, port: cfg.port, user: cfg.user!, pass: cfg.pass! });
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
      to: testEmail,
      subject: "PharmSci E-Voting — SMTP Test",
      text: "This is a test email to confirm your SMTP settings are working correctly.",
      html: "<p>This is a test email to confirm your SMTP settings are working correctly.</p>",
    });
    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } catch (err: any) {
    res.status(500).json({ error: `SMTP error: ${err.message}` });
  }
});

// GET /admin/email/jobs
router.get("/admin/email/jobs", async (req, res): Promise<void> => {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const jobs = await db.execute(sql`
    SELECT * FROM email_jobs ORDER BY created_at DESC LIMIT 50
  `);
  res.json({ jobs: jobs.rows });
});

// POST /admin/email/send
router.post("/admin/email/send", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;
  const { subject, body, recipientGroup = "all_students", scheduledAt } = req.body;
  if (!subject || !body) { res.status(400).json({ error: "Subject and body are required." }); return; }

  const validGroups = ["all_students", "registered_voters", "unregistered_only"];
  if (!validGroups.includes(recipientGroup)) {
    res.status(400).json({ error: "Invalid recipient group." }); return;
  }

  const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

  const [job] = await db.execute(sql`
    INSERT INTO email_jobs (subject, body, recipient_group, scheduled_at, status, created_by_admin_id)
    VALUES (${subject}, ${body}, ${recipientGroup}, ${scheduledAt ? new Date(scheduledAt).toISOString() : null}, ${isScheduled ? "scheduled" : "pending"}, ${req.session.adminId})
    RETURNING *
  `) as any;

  if (!isScheduled) {
    sendEmailJob((job as any).rows?.[0] ?? job).catch((err) => console.error("Email job failed:", err));
  }

  await logAuditEvent({
    eventType: isScheduled ? "email_job_scheduled" : "email_job_queued",
    description: `Bulk email ${isScheduled ? "scheduled" : "queued"}: "${subject}" → ${recipientGroup}`,
    actorId: String(req.session.adminId), actorType: "admin",
  });

  res.json({ success: true, scheduled: isScheduled, message: isScheduled ? `Email scheduled for ${new Date(scheduledAt).toLocaleString()}` : "Email is being sent now." });
});

// DELETE /admin/email/jobs/:id
router.delete("/admin/email/jobs/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;
  const id = parseInt(req.params.id, 10);
  await db.execute(sql`UPDATE email_jobs SET status = 'cancelled' WHERE id = ${id} AND status IN ('pending', 'scheduled')`);
  res.json({ success: true });
});

export async function sendEmailJob(job: any): Promise<void> {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    await db.execute(sql`UPDATE email_jobs SET status = 'failed', error = 'SMTP not configured' WHERE id = ${job.id}`);
    return;
  }

  let whereClause;
  if (job.recipient_group === "registered_voters") {
    whereClause = sql`personal_code_hash IS NOT NULL`;
  } else if (job.recipient_group === "unregistered_only") {
    whereClause = sql`personal_code_hash IS NULL`;
  } else {
    whereClause = sql`1=1`;
  }

  const recipients = await db.execute(sql`SELECT email, full_name FROM student_records WHERE ${whereClause}`);
  const rows = recipients.rows as { email: string; full_name: string }[];

  if (rows.length === 0) {
    await db.execute(sql`UPDATE email_jobs SET status = 'sent', sent_count = 0 WHERE id = ${job.id}`);
    return;
  }

  await db.execute(sql`UPDATE email_jobs SET status = 'sending' WHERE id = ${job.id}`);

  const transporter = createTransporter({ host: cfg.host!, port: cfg.port, user: cfg.user!, pass: cfg.pass! });
  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
        to: `"${row.full_name}" <${row.email}>`,
        subject: job.subject,
        html: job.body.replace(/\n/g, "<br>"),
        text: job.body,
      });
      sent++;
    } catch (err: any) {
      errors.push(`${row.email}: ${err.message}`);
    }
  }

  await db.execute(sql`
    UPDATE email_jobs SET status = ${errors.length > 0 && sent === 0 ? "failed" : "sent"},
    sent_count = ${sent}, error = ${errors.length > 0 ? errors.slice(0, 5).join("; ") : null}
    WHERE id = ${job.id}
  `);
}

export async function processScheduledEmailJobs(): Promise<void> {
  const due = await db.execute(sql`
    SELECT * FROM email_jobs WHERE status = 'scheduled' AND scheduled_at <= NOW()
  `);
  for (const job of (due.rows as any[])) {
    await sendEmailJob(job).catch(() => {});
  }
}

export default router;
