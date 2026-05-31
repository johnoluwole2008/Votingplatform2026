import { db, electionSettingsTable } from "@workspace/db";

export type ElectionPhase =
  | "setup"
  | "registration"
  | "voting"
  | "results"
  | "audit";

export interface ElectionPhaseInfo {
  phase: ElectionPhase;
  registrationOpen: boolean;
  votingOpen: boolean;
}

export async function getElectionPhase(): Promise<ElectionPhaseInfo> {
  const [settings] = await db.select().from(electionSettingsTable).limit(1);

  if (!settings) {
    return { phase: "setup", registrationOpen: false, votingOpen: false };
  }

  const now = new Date();

  const registrationOpen =
    settings.registrationStart != null &&
    settings.registrationEnd != null &&
    now >= settings.registrationStart &&
    now <= settings.registrationEnd;

  const votingOpen =
    settings.votingStart != null &&
    settings.votingEnd != null &&
    now >= settings.votingStart &&
    now <= settings.votingEnd;

  let phase: ElectionPhase = "setup";
  if (
    settings.registrationStart == null &&
    settings.votingStart == null
  ) {
    phase = "setup";
  } else if (settings.registrationStart != null && now < settings.registrationStart) {
    phase = "setup";
  } else if (registrationOpen) {
    phase = "registration";
  } else if (votingOpen) {
    phase = "voting";
  } else if (
    settings.votingEnd != null &&
    now > settings.votingEnd
  ) {
    phase = "results";
  } else if (
    settings.registrationEnd != null &&
    now > settings.registrationEnd &&
    (settings.votingStart == null || now < settings.votingStart)
  ) {
    phase = "setup";
  } else {
    phase = "setup";
  }

  return { phase, registrationOpen, votingOpen };
}

export async function getOrCreateSettings() {
  const [existing] = await db.select().from(electionSettingsTable).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(electionSettingsTable)
    .values({
      electionName: "Faculty of Pharmaceutical Sciences Student Elections",
      showLiveResults: false,
      totalExpectedVoters: 900,
    })
    .returning();
  return created;
}
