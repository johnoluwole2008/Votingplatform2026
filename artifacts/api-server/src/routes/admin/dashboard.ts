import { Router } from "express";
import { eq, count, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  voterRegistrationsTable,
  votesTable,
  officesTable,
  candidatesTable,
  electionSettingsTable,
} from "@workspace/db";
import { getElectionPhase, getOrCreateSettings } from "../../lib/election";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

router.get("/admin/dashboard", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const settings = await getOrCreateSettings();
  const { phase, registrationOpen, votingOpen } = await getElectionPhase();

  const [totalRegistered] = await db
    .select({ count: count() })
    .from(voterRegistrationsTable);

  const [totalVoted] = await db
    .select({ count: count() })
    .from(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.hasVoted, true));

  const levelBreakdown = await db
    .select({
      level: voterRegistrationsTable.level,
      total: count(),
      voted: sql<number>`sum(case when ${voterRegistrationsTable.hasVoted} then 1 else 0 end)`,
    })
    .from(voterRegistrationsTable)
    .groupBy(voterRegistrationsTable.level);

  const levels = ["100L", "200L", "300L", "400L", "500L", "600L"];
  const byLevel = levels.map((level) => {
    const row = levelBreakdown.find((r) => r.level === level);
    return {
      level,
      registered: Number(row?.total ?? 0),
      voted: Number(row?.voted ?? 0),
    };
  });

  const reg = Number((totalRegistered as unknown as Array<{ count: number }>)[0]?.count ?? 0);
  const voted = Number((totalVoted as unknown as Array<{ count: number }>)[0]?.count ?? 0);
  const total = settings.totalExpectedVoters;

  res.json({
    totalRegistered: reg,
    totalVoted: voted,
    totalExpected: total,
    registrationRate: total > 0 ? Math.round((reg / total) * 100 * 10) / 10 : 0,
    turnoutRate: reg > 0 ? Math.round((voted / reg) * 100 * 10) / 10 : 0,
    byLevel,
    phase,
    registrationOpen,
    votingOpen,
  });
});

router.get("/admin/dashboard/turnout-timeline", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const rows = await db
    .select({
      hour: sql<string>`to_char(date_trunc('hour', ${voterRegistrationsTable.voteTimestamp}), 'HH24:00')`,
      count: count(),
    })
    .from(voterRegistrationsTable)
    .where(eq(voterRegistrationsTable.hasVoted, true))
    .groupBy(sql`date_trunc('hour', ${voterRegistrationsTable.voteTimestamp})`)
    .orderBy(sql`date_trunc('hour', ${voterRegistrationsTable.voteTimestamp})`);

  let cumulative = 0;
  const timeline = rows.map((r) => {
    const delta = Number(r.count);
    cumulative += delta;
    return { hour: r.hour ?? "N/A", cumulative, delta };
  });

  res.json(timeline);
});

router.get("/admin/dashboard/results-preview", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const offices = await db
    .select()
    .from(officesTable)
    .orderBy(officesTable.displayOrder);

  const candidates = await db.select().from(candidatesTable);

  const voteCounts = await db
    .select({ candidateId: votesTable.candidateId, count: count() })
    .from(votesTable)
    .groupBy(votesTable.candidateId);

  const results = offices.map((office) => {
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
        percentage: total > 0 ? Math.round((v.voteCount / total) * 100 * 10) / 10 : 0,
        isWinner: !isTie && v.voteCount === max && max > 0,
        isTie: isTie && v.voteCount === max && max > 0,
      })),
    };
  });

  res.json(results);
});

export default router;
