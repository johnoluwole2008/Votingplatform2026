import {
  db,
  adminsTable,
  electionSettingsTable,
  officesTable,
  candidatesTable,
  studentRecordsTable,
  voterRegistrationsTable,
} from "@workspace/db";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // ── Super admin ──────────────────────────────────────────────────────────────
  const existingAdmin = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, "admin@pharmsci.edu.ng"))
    .limit(1);
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash("Admin@12345", 12);
    await db.insert(adminsTable).values({
      email: "admin@pharmsci.edu.ng",
      name: "Electoral Committee",
      passwordHash,
      role: "super_admin",
    });
    console.log(
      "✓ Super admin created — email: admin@pharmsci.edu.ng  password: Admin@12345",
    );
  } else {
    console.log("• Super admin already exists");
  }

  // ── Election settings ────────────────────────────────────────────────────────
  const existingSettings = await db
    .select()
    .from(electionSettingsTable)
    .limit(1);
  if (existingSettings.length === 0) {
    const now = new Date();
    const regStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const regEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const votingStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const votingEnd = new Date(now.getTime() + 22 * 60 * 60 * 1000);

    await db.insert(electionSettingsTable).values({
      electionName:
        "Faculty of Pharmaceutical Sciences Student Elections 2024/2025",
      registrationStart: regStart,
      registrationEnd: regEnd,
      votingStart,
      votingEnd,
      showLiveResults: true,
      totalExpectedVoters: 900,
    });
    console.log("✓ Election settings created (voting is currently OPEN)");
  } else {
    console.log("• Election settings already exist");
  }

  // ── Offices ───────────────────────────────────────────────────────────────────
  const existingOffices = await db.select().from(officesTable).limit(1);
  if (existingOffices.length === 0) {
    const [president] = await db
      .insert(officesTable)
      .values({
        title: "President",
        description: "Overall leader of the Faculty student body",
        displayOrder: 1,
      })
      .returning();
    const [vp] = await db
      .insert(officesTable)
      .values({
        title: "Vice President",
        description: "Deputy leader and internal affairs coordinator",
        displayOrder: 2,
      })
      .returning();
    const [secretary] = await db
      .insert(officesTable)
      .values({
        title: "General Secretary",
        description: "Minutes, communication and administrative records",
        displayOrder: 3,
      })
      .returning();
    const [treasurer] = await db
      .insert(officesTable)
      .values({
        title: "Financial Secretary",
        description: "Dues collection and financial record keeping",
        displayOrder: 4,
      })
      .returning();
    const [pro] = await db
      .insert(officesTable)
      .values({
        title: "Public Relations Officer",
        description: "Media, outreach and public communication",
        displayOrder: 5,
      })
      .returning();
    console.log("✓ 5 offices created");

    await db.insert(candidatesTable).values([
      {
        officeId: president.id,
        fullName: "Adeyemi Boluwatife",
        bio: "Final year student, pioneer of PharmSci Study Groups",
        level: "500L",
      },
      {
        officeId: president.id,
        fullName: "Chinwe Obiageli",
        bio: "Pioneer of the Mental Health Awareness campaign",
        level: "500L",
      },
      {
        officeId: president.id,
        fullName: "Emeka Okonkwo",
        bio: "Former class rep and community service advocate",
        level: "400L",
      },

      {
        officeId: vp.id,
        fullName: "Fatima Al-Hassan",
        bio: "Academic excellence award winner 2023",
        level: "400L",
      },
      {
        officeId: vp.id,
        fullName: "James Adeniyi",
        bio: "Student Union conference delegate",
        level: "400L",
      },

      {
        officeId: secretary.id,
        fullName: "Ngozi Eze",
        bio: "Newsletter editor and documentation lead",
        level: "300L",
      },
      {
        officeId: secretary.id,
        fullName: "Usman Danladi",
        bio: "Departmental coordinator with strong record keeping",
        level: "300L",
      },

      {
        officeId: treasurer.id,
        fullName: "Blessing Okoro",
        bio: "Accounting background with 2 years of dues management",
        level: "400L",
      },
      {
        officeId: treasurer.id,
        fullName: "Olamide Taiwo",
        bio: "Financial literacy advocate and workshop organiser",
        level: "300L",
      },

      {
        officeId: pro.id,
        fullName: "Amaka Nwosu",
        bio: "Social media manager and photographer",
        level: "300L",
      },
      {
        officeId: pro.id,
        fullName: "Seun Adeyinka",
        bio: "Content creator with 5k+ followers on faculty page",
        level: "200L",
      },
    ]);
    console.log("✓ 11 candidates added across 5 offices");
  } else {
    console.log("• Offices already exist — skipping");
  }

  // ── Sample student records ────────────────────────────────────────────────────
  const existingStudents = await db
    .select()
    .from(studentRecordsTable)
    .limit(1);
  if (existingStudents.length === 0) {
    const students = [];
    const levels = ["100L", "200L", "300L", "400L", "500L", "600L"];
    const names = [
      "Adeyemi Tunde",
      "Okonkwo Chima",
      "Bello Fatima",
      "Eze Chioma",
      "Adebayo Korede",
      "Ibrahim Amina",
      "Okafor Emeka",
      "Oluwole Tope",
      "Nwosu Ngozi",
      "Salami Yetunde",
      "Abubakar Hauwa",
      "Danladi Usman",
      "Okoro Blessing",
      "Taiwo Olamide",
      "Adeyinka Seun",
      "Nwosu Amaka",
      "Afolabi Kemi",
      "Musa Halima",
      "Olusegun Biodun",
      "Chukwu Ebele",
      "Olawale Bukola",
      "Garba Rabi",
      "Onyeka Chinonso",
      "Lawal Ridwan",
      "Akintunde Femi",
      "Zubair Halimat",
      "Odoh Precious",
      "Ogundimu Sola",
      "Yusuf Zaynab",
      "Adeleke Dami",
    ];

    for (let i = 0; i < 30; i++) {
      const level = levels[i % 6];
      const year = 2024 - Math.floor(i / 6);
      const num = String(i + 1).padStart(3, "0");
      const matricNumber = `PHA/${year}/${num}`;
      students.push({
        matricNumber,
        email: `student${i + 1}@pharmsci.edu.ng`,
        fullName: names[i],
        level: level as never,
      });
    }

    await db
      .insert(studentRecordsTable)
      .values(students)
      .onConflictDoNothing();
    console.log(`✓ ${students.length} sample student records added`);
  } else {
    console.log("• Student records already exist — skipping");
  }

  // ── Demo voter registrations ──────────────────────────────────────────────────
  // Register first 10 students as voters so the ballot flow can be tested.
  // Password for all: Test@12345
  const existingVoters = await db
    .select()
    .from(voterRegistrationsTable)
    .limit(1);
  if (existingVoters.length === 0) {
    const allStudents = await db
      .select()
      .from(studentRecordsTable)
      .limit(10);

    if (allStudents.length > 0) {
      const voterPasswordHash = await bcrypt.hash("Test@12345", 12);
      const voterRows = allStudents.map((s) => ({
        matricNumber: s.matricNumber,
        email: s.email,
        fullName: s.fullName,
        level: s.level as never,
        passwordHash: voterPasswordHash,
        ipAddress: "127.0.0.1",
      }));
      await db
        .insert(voterRegistrationsTable)
        .values(voterRows)
        .onConflictDoNothing();
      console.log(
        `✓ ${voterRows.length} demo voter registrations created — password: Test@12345`,
      );
      console.log(
        `  Example: matric=PHA/2024/001  email=student1@pharmsci.edu.ng  password=Test@12345`,
      );
    }
  } else {
    console.log("• Voter registrations already exist — skipping");
  }

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
