import { Router } from "express";
import { db, voterRegistrationsTable } from "@workspace/db";
import { logAuditEvent } from "../../lib/audit";

const router = Router();

const VALID_LEVELS = ["100L", "200L", "300L", "400L", "500L", "600L"];

function requireEditorOrAbove(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (req.session.adminRole === "observer") {
    res.status(403).json({ error: "Observer access cannot import data." }); return false;
  }
  return true;
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cols: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cols.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += ch;
        }
      }
      cols.push(current.trim().replace(/^"|"$/g, ""));
      return cols;
    });
}

router.post("/admin/voter-import/preview", async (req, res): Promise<void> => {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { csv, columnMap, hasHeader } = req.body as {
    csv: string;
    columnMap: { matric: number; fullName: number; email: number; level: number };
    hasHeader: boolean;
  };

  if (!csv || typeof csv !== "string") {
    res.status(400).json({ error: "No CSV content provided." }); return;
  }

  const allRows = parseCsv(csv);
  const rows = hasHeader ? allRows.slice(1) : allRows;
  if (rows.length === 0) { res.status(400).json({ error: "No data rows found." }); return; }

  const { matric, fullName, email, level } = columnMap;
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const lvl = row[level]?.trim();
    if (!row[matric]?.trim()) errors.push(`Row ${i + 1}: missing matric number`);
    if (!row[email]?.trim()) errors.push(`Row ${i + 1}: missing email`);
    if (!lvl || !VALID_LEVELS.includes(lvl)) errors.push(`Row ${i + 1}: invalid level "${lvl ?? ""}"`);
  });

  const preview = rows.slice(0, 5).map((row) => ({
    matric: row[matric]?.trim().toUpperCase() ?? "",
    fullName: row[fullName]?.trim() ?? "",
    email: row[email]?.trim().toLowerCase() ?? "",
    level: row[level]?.trim() ?? "",
  }));

  res.json({ totalRows: rows.length, preview, errors: errors.slice(0, 20) });
});

router.post("/admin/voter-import/csv", async (req, res): Promise<void> => {
  if (!requireEditorOrAbove(req, res)) return;

  const { csv, columnMap, hasHeader } = req.body as {
    csv: string;
    columnMap: { matric: number; fullName: number; email: number; level: number };
    hasHeader: boolean;
  };

  if (!csv || typeof csv !== "string") {
    res.status(400).json({ error: "No CSV content provided." }); return;
  }

  const allRows = parseCsv(csv);
  const rows = hasHeader ? allRows.slice(1) : allRows;
  if (rows.length === 0) { res.status(400).json({ error: "No data rows found." }); return; }

  const { matric, fullName, email, level } = columnMap;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const matricVal = row[matric]?.trim().toUpperCase();
    const nameVal = row[fullName]?.trim();
    const emailVal = row[email]?.trim().toLowerCase();
    const levelVal = row[level]?.trim();

    if (!matricVal || !nameVal || !emailVal || !levelVal || !VALID_LEVELS.includes(levelVal)) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: invalid or missing fields — skipped`);
      skipped++;
      continue;
    }

    try {
      const result = await db
        .insert(voterRegistrationsTable)
        .values({
          matricNumber: matricVal,
          fullName: nameVal,
          email: emailVal,
          level: levelVal as never,
          passwordHash: null,
        })
        .onConflictDoNothing()
        .returning({ id: voterRegistrationsTable.id });

      if (result.length > 0) {
        imported++;
      } else {
        skipped++;
        errors.push(`Row ${i + (hasHeader ? 2 : 1)}: ${matricVal} already exists — skipped`);
      }
    } catch (err: any) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: ${matricVal} — error: ${err.message}`);
      skipped++;
    }
  }

  await logAuditEvent({
    eventType: "voter_import_csv",
    description: `Admin imported ${imported} voter records from CSV (${skipped} skipped)`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ success: true, imported, skipped, errors: errors.slice(0, 30) });
});

export default router;
