import { Router } from "express";
import nodemailer from "nodemailer";
import { eq, sql } from "drizzle-orm";
import { db, electionSettingsTable, studentRecordsTable, voterRegistrationsTable } from "@workspace/db";
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

function applyMergeTags(text: string, student: { full_name: string; email: string; matric_number?: string }): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : process.env.APP_URL ?? "";
  return text
    .replace(/\[Name\]/gi, student.full_name)
    .replace(/\[Email\]/gi, student.email)
    .replace(/\[Matric\]/gi, student.matric_number ?? "")
    .replace(/\[VotingLink\]/gi, `${domain}/login`);
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

    // Step 1: verify the connection before attempting to send
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      res.status(500).json({
        error: `Connection failed: ${verifyErr.message}. Check your SMTP host, port, username, and password.`,
      });
      return;
    }

    // Step 2: send the test message
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
      to: testEmail,
      subject: "PharmSci E-Voting — SMTP Test",
      text: "This is a test email from the PharmSci E-Voting admin panel.\n\nIf you received this, your SMTP settings are working correctly.",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#0f766e;margin-top:0">SMTP Test Successful</h2>
        <p style="color:#374151">This is a test email from the <strong>PharmSci E-Voting</strong> admin panel.</p>
        <p style="color:#374151">If you received this, your SMTP settings are configured correctly.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
        <p style="color:#6b7280;font-size:12px">Sent from ${cfg.host}:${cfg.port}</p>
      </div>`,
    });

    // Step 3: check if the address was rejected by the SMTP server
    const rejected: string[] = (info as any).rejected ?? [];
    if (rejected.length > 0) {
      res.status(500).json({ error: `SMTP server rejected the address: ${rejected.join(", ")}` });
      return;
    }

    res.json({
      success: true,
      message: `Test email delivered to ${testEmail}. If it doesn't appear in a few minutes, check your spam/junk folder.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: `SMTP error: ${err.message}` });
  }
});

// GET /admin/email/jobs
router.get("/admin/email/jobs", async (req, res): Promise<void> => {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const jobs = await db.execute(sql`
      SELECT * FROM email_jobs ORDER BY created_at DESC LIMIT 50
    `);
    res.json({ jobs: jobs.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load email jobs." });
  }
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

  try {
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const result = await db.execute(sql`
      INSERT INTO email_jobs (subject, body, recipient_group, scheduled_at, status, created_by_admin_id)
      VALUES (${subject}, ${body}, ${recipientGroup}, ${scheduledAt ? new Date(scheduledAt).toISOString() : null}, ${isScheduled ? "scheduled" : "pending"}, ${req.session.adminId})
      RETURNING *
    `);
    const job = (result.rows?.[0] ?? result) as any;

    if (!isScheduled) {
      sendEmailJob(job).catch((err) => console.error("Email job failed:", err));
    }

    await logAuditEvent({
      eventType: isScheduled ? "email_job_scheduled" : "email_job_queued",
      description: `Bulk email ${isScheduled ? "scheduled" : "queued"}: "${subject}" → ${recipientGroup}`,
      actorId: String(req.session.adminId), actorType: "admin",
    });

    res.json({ success: true, scheduled: isScheduled, message: isScheduled ? `Email scheduled for ${new Date(scheduledAt).toLocaleString()}` : "Email is being sent now." });
  } catch (err: any) {
    console.error("Email send error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to queue email job." });
  }
});

// POST /admin/email/notify-phase — sends a voting open/closed notification to registered voters
router.post("/admin/email/notify-phase", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;
  const { phase } = req.body;
  if (phase !== "voting_open" && phase !== "voting_closed") {
    res.status(400).json({ error: "phase must be 'voting_open' or 'voting_closed'" }); return;
  }

  try {
    const settings = await getOrCreateSettings() as any;
    const electionName = settings.electionName ?? "Faculty Student Elections";

    let subject: string;
    let body: string;

    if (phase === "voting_open") {
      subject = `🗳️ Voting is now open — ${electionName}`;
      body = `Dear [Name],

Voting for the ${electionName} is now officially open!

Log in with your matric number and personal code to cast your ballot:
https://${process.env.REPLIT_DEV_DOMAIN ?? "your-election-site.com"}/login

Voting closes soon — every vote counts. Make your voice heard.

— PharmSci E-Voting Team`;
    } else {
      subject = `Voting has closed — ${electionName}`;
      body = `Dear [Name],

Voting for the ${electionName} has now closed. Thank you for participating in this election.

Results will be announced soon.

— PharmSci E-Voting Team`;
    }

    const result = await db.execute(sql`
      INSERT INTO email_jobs (subject, body, recipient_group, scheduled_at, status, created_by_admin_id)
      VALUES (${subject}, ${body}, 'registered_voters', null, 'pending', ${req.session.adminId})
      RETURNING *
    `);
    const job = (result.rows?.[0] ?? result) as any;

    sendEmailJob(job).catch((err) => console.error("Phase notification email job failed:", err));

    await logAuditEvent({
      eventType: "email_phase_notification",
      description: `Phase notification sent: ${phase} → registered_voters`,
      actorId: String(req.session.adminId), actorType: "admin",
    });

    res.json({ success: true, message: `Sending ${phase === "voting_open" ? "voting open" : "voting closed"} notification to all registered voters.` });
  } catch (err: any) {
    console.error("Notify-phase error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to send phase notification." });
  }
});

// DELETE /admin/email/jobs/:id
router.delete("/admin/email/jobs/:id", async (req, res): Promise<void> => {
  if (!requireEditor(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    await db.execute(sql`UPDATE email_jobs SET status = 'cancelled' WHERE id = ${id} AND status IN ('pending', 'scheduled')`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to cancel job." });
  }
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

  const recipients = await db.execute(sql`SELECT email, full_name, matric_number FROM student_records WHERE ${whereClause}`);
  const rows = recipients.rows as { email: string; full_name: string; matric_number: string }[];

  if (rows.length === 0) {
    await db.execute(sql`UPDATE email_jobs SET status = 'sent', sent_count = 0 WHERE id = ${job.id}`);
    return;
  }

  await db.execute(sql`UPDATE email_jobs SET status = 'sending' WHERE id = ${job.id}`);

  const transporter = createTransporter({ host: cfg.host!, port: cfg.port, user: cfg.user!, pass: cfg.pass! });
  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const personalizedSubject = applyMergeTags(job.subject, row);
    const personalizedBody = applyMergeTags(job.body, row);
    try {
      await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
        to: `"${row.full_name}" <${row.email}>`,
        subject: personalizedSubject,
        html: personalizedBody.replace(/\n/g, "<br>"),
        text: personalizedBody,
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

export async function sendVoterReceiptEmail(voter: {
  email: string;
  fullName: string;
  matricNumber: string;
  voteTimestamp: Date;
}): Promise<void> {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return;

  const settings = await getOrCreateSettings() as any;
  const electionName = settings.electionName ?? "Faculty Student Elections";
  const formattedTime = voter.voteTimestamp.toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" });

  const subject = `✅ Your voting receipt — ${electionName}`;

  const textBody = `Dear ${voter.fullName},

Your vote has been successfully recorded in the ${electionName}.

Matric Number: ${voter.matricNumber}
Time of vote:  ${formattedTime}

Your ballot is completely anonymous — no record links your identity to your specific choices.

Thank you for participating in this election!

— PharmSci E-Voting Team`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#0f766e;padding:28px 32px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">🗳️</div>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600">Vote Confirmed</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:14px">${electionName}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Dear <strong>${voter.fullName}</strong>,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">
              Your vote has been <strong style="color:#0f766e">successfully recorded</strong> in the ${electionName}.
            </p>

            <!-- Receipt box -->
            <table width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px">
              <tr>
                <td style="padding:20px 24px">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Voting Receipt</p>
                  <table width="100%" style="margin-top:12px">
                    <tr>
                      <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%">Matric Number</td>
                      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${voter.matricNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#6b7280;font-size:13px">Time of Vote</td>
                      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">${formattedTime}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#6b7280;font-size:13px">Status</td>
                      <td style="padding:6px 0">
                        <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px">Recorded ✓</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Anonymity note -->
            <table width="100%" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px">
              <tr>
                <td style="padding:14px 18px">
                  <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5">
                    🔒 <strong>Your ballot is anonymous.</strong> No record links your identity to your specific choices. Only you know who you voted for.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">
              Thank you for participating in this election. Your voice matters!
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center">
            <p style="margin:0;color:#9ca3af;font-size:12px">
              — PharmSci E-Voting Team<br>
              <span style="color:#d1d5db">Faculty of Pharmaceutical Sciences</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const transporter = createTransporter({ host: cfg.host!, port: cfg.port, user: cfg.user!, pass: cfg.pass! });
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.from || cfg.user}>`,
      to: `"${voter.fullName}" <${voter.email}>`,
      subject,
      html: htmlBody,
      text: textBody,
    });
  } catch {
    // Fire-and-forget — don't block vote submission if email fails
  }
}

export default router;
