import { Router } from "express";
import { count } from "drizzle-orm";
import { db, officesTable, candidatesTable, votesTable } from "@workspace/db";

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
