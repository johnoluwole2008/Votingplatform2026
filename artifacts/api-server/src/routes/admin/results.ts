import { Router } from "express";
import { count } from "drizzle-orm";
import { db, officesTable, candidatesTable, votesTable } from "@workspace/db";
import PDFDocument from "pdfkit";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  return true;
}

async function buildResults() {
  const offices = await db.select().from(officesTable).orderBy(officesTable.displayOrder);
  const candidates = await db.select().from(candidatesTable);
  const voteCounts = await db
    .select({ candidateId: votesTable.candidateId, count: count() })
    .from(votesTable)
    .groupBy(votesTable.candidateId);

  return offices.map((office) => {
    const officeCandidates = candidates.filter((c) => c.officeId === office.id);
    const officeVotes = officeCandidates.map((c) => {
      const vc = voteCounts.find((v) => v.candidateId === c.id);
      return { candidateId: c.id, candidateName: c.fullName, voteCount: Number(vc?.count ?? 0) };
    });
    const total = officeVotes.reduce((s, v) => s + v.voteCount, 0);
    const max = Math.max(...officeVotes.map((v) => v.voteCount), 0);
    const winners = officeVotes.filter((v) => v.voteCount === max && max > 0);
    const isTie = winners.length > 1;

    return {
      officeId: office.id,
      officeTitle: office.title,
      totalVotes: total,
      candidates: officeVotes.map((v) => ({
        candidateId: v.candidateId,
        candidateName: v.candidateName,
        voteCount: v.voteCount,
        percentage: total > 0 ? Math.round((v.voteCount / total) * 1000) / 10 : 0,
        isWinner: !isTie && v.voteCount === max && max > 0,
        isTie: isTie && v.voteCount === max && max > 0,
      })),
    };
  });
}

router.get("/admin/results", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  res.json(await buildResults());
});

router.get("/admin/results/export", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const results = await buildResults();
  const format = (req.query.format as string) ?? "csv";

  if (format === "pdf") {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="results-export.pdf"');
    doc.pipe(res);

    doc.fontSize(20).font("Helvetica-Bold").text("Election Results", { align: "center" });
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(`Generated ${new Date().toLocaleString("en-NG")}`, { align: "center" });
    doc.moveDown(1.5);

    for (const office of results) {
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111").text(office.officeTitle);
      doc.fontSize(9).font("Helvetica").fillColor("#888").text(`${office.totalVotes} total votes`);
      doc.moveDown(0.4);

      const sorted = [...office.candidates].sort((a, b) => b.voteCount - a.voteCount);
      for (const c of sorted) {
        const label = c.isWinner ? " ★ WINNER" : c.isTie ? " (TIE)" : "";
        const line = `${c.candidateName}${label}`;
        const right = `${c.voteCount} votes (${c.percentage}%)`;

        doc.fontSize(10).font(c.isWinner ? "Helvetica-Bold" : "Helvetica").fillColor(c.isWinner ? "#1a6b3e" : "#222");

        const y = doc.y;
        doc.text(line, 50, y, { continued: false });
        doc.fontSize(10).font("Helvetica").fillColor("#444").text(right, 50, y, { align: "right" });

        const barW = 400;
        const filled = Math.round(barW * (c.percentage / 100));
        doc.rect(50, doc.y + 2, barW, 6).fillColor("#e5e7eb").fill();
        if (filled > 0) {
          doc.rect(50, doc.y - 4, filled, 6).fillColor(c.isWinner ? "#16a34a" : "#2563eb").fill();
        }
        doc.moveDown(0.8);
      }

      doc.moveDown(0.8);
      if (doc.y > 720) doc.addPage();
    }

    doc.end();
    return;
  }

  const header = "Office,Candidate,Votes,Percentage,Winner\n";
  const rows = results
    .flatMap((office) =>
      office.candidates.map((c) =>
        [
          `"${office.officeTitle}"`,
          `"${c.candidateName}"`,
          c.voteCount,
          `${c.percentage}%`,
          c.isWinner ? "Yes" : c.isTie ? "Tie" : "No",
        ].join(","),
      ),
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="results-export.csv"');
  res.send(header + rows);
});

export default router;
