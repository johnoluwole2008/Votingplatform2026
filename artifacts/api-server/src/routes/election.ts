import { Router } from "express";
import { db, electionSettingsTable } from "@workspace/db";
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

export default router;
