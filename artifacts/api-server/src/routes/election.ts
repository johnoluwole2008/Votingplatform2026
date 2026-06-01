import { Router } from "express";
import { count } from "drizzle-orm";
import {
  db,
  officesTable,
  candidatesTable,
  votesTable,
} from "@workspace/db";
import { getElectionPhase, getOrCreateSettings } from "../lib/election";

const router = Router();

router.get("/election/status", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  const { phase, registrationOpen, votingOpen } = await getElectionPhase();

  res.json({
    phase,
    registrationOpen,
    votingOpen,
    registrationStart: settings.registrationStart?.toISOString() ?? null,
    registrationEnd: settings.registrationEnd?.toISOString() ?? null,
    votingStart: settings.votingStart?.toISOString() ?? null,
    votingEnd: settings.votingEnd?.toISOString() ?? null,
    electionName: settings.electionName,
    totalStudents: settings.totalExpectedVoters,
  });
});

// Public results — only returned when showLiveResults is enabled AND voting has ended
router.get("/election/results", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  const { phase } = await getElectionPhase();

  if (!settings.showLiveResults) {
    res.status(403).json({ error: "Results are not yet public." });
    return;
  }

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
      return {
        candidateId: c.id,
        candidateName: c.fullName,
        bio: c.bio ?? null,
        level: c.level ?? null,
        voteCount: Number(vc?.count ?? 0),
      };
    });
    const total = officeVotes.reduce((s, v) => s + v.voteCount, 0);
    const max = Math.max(...officeVotes.map((v) => v.voteCount), 0);
    const winners = officeVotes.filter((v) => v.voteCount === max && max > 0);
    const isTie = winners.length > 1;

    return {
      officeId: office.id,
      officeTitle: office.title,
      description: office.description ?? null,
      totalVotes: total,
      candidates: officeVotes
        .sort((a, b) => b.voteCount - a.voteCount)
        .map((v) => ({
          ...v,
          percentage: total > 0 ? Math.round((v.voteCount / total) * 1000) / 10 : 0,
          isWinner: !isTie && v.voteCount === max && max > 0,
          isTie: isTie && v.voteCount === max && max > 0,
        })),
    };
  });

  res.json({ phase, electionName: settings.electionName, results });
});

export default router;
