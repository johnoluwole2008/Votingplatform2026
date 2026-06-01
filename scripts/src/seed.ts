import {
  db,
  adminsTable,
  electionSettingsTable,
  officesTable,
  candidatesTable,
  studentRecordsTable,
} from "@workspace/db";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // ── Super admin ──────────────────────────────────────────────────────────────
  const existingAdmin = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, "johnoluwole2008@gmail.com"))
    .limit(1);
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash("Admin@12345", 12);
    await db.insert(adminsTable).values({
      email: "johnoluwole2008@gmail.com",
      name: "Electoral Committee",
      passwordHash,
      role: "super_admin",
    });
    console.log("✓ Super admin created — email: johnoluwole2008@gmail.com  password: Admin@12345");
  } else {
    console.log("• Super admin already exists");
  }

  // ── Election settings ────────────────────────────────────────────────────────
  const existingSettings = await db.select().from(electionSettingsTable).limit(1);
  if (existingSettings.length === 0) {
    const now = new Date();
    const votingStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const votingEnd = new Date(now.getTime() + 22 * 60 * 60 * 1000);

    await db.insert(electionSettingsTable).values({
      electionName: "Faculty of Pharmaceutical Sciences Student Elections 2024/2025",
      votingStart,
      votingEnd,
      showLiveResults: true,
      totalExpectedVoters: 1000,
    });
    console.log("✓ Election settings created (voting is currently OPEN)");
  } else {
    console.log("• Election settings already exist");
  }

  // ── 17 Offices ────────────────────────────────────────────────────────────────
  const existingOffices = await db.select().from(officesTable).limit(1);
  if (existingOffices.length === 0) {
    const officeData = [
      { title: "President", description: "Overall leader of the Faculty student body", displayOrder: 1 },
      { title: "Vice President", description: "Deputy leader and internal affairs coordinator", displayOrder: 2 },
      { title: "General Secretary", description: "Minutes, communication and administrative records", displayOrder: 3 },
      { title: "Assistant General Secretary", description: "Supports the General Secretary in all duties", displayOrder: 4 },
      { title: "Financial Secretary", description: "Dues collection and financial record keeping", displayOrder: 5 },
      { title: "Treasurer", description: "Custodian of Faculty funds and financial oversight", displayOrder: 6 },
      { title: "Public Relations Officer", description: "Media, outreach and public communication", displayOrder: 7 },
      { title: "Social Director", description: "Events, socials, and student engagement", displayOrder: 8 },
      { title: "Sports Director (Male)", description: "Coordinates male sports activities and competitions", displayOrder: 9 },
      { title: "Sports Director (Female)", description: "Coordinates female sports activities and competitions", displayOrder: 10 },
      { title: "Welfare Officer", description: "Student welfare, counselling and support services", displayOrder: 11 },
      { title: "Academic Director", description: "Academic affairs, tutorials and study groups", displayOrder: 12 },
      { title: "100L Class Representative", description: "Representative for 100 Level students", displayOrder: 13 },
      { title: "200L Class Representative", description: "Representative for 200 Level students", displayOrder: 14 },
      { title: "300L Class Representative", description: "Representative for 300 Level students", displayOrder: 15 },
      { title: "400L Class Representative", description: "Representative for 400 Level students", displayOrder: 16 },
      { title: "500/600L Class Representative", description: "Representative for 500 and 600 Level students", displayOrder: 17 },
    ];

    const offices = await db.insert(officesTable).values(officeData).returning();
    const officeMap: Record<string, number> = {};
    for (const o of offices) officeMap[o.title] = o.id;

    const candidateData = [
      // President (4)
      { officeId: officeMap["President"], fullName: "Adeyemi Boluwatife", bio: "Pioneer of PharmSci Study Groups and final year leader", level: "500L" },
      { officeId: officeMap["President"], fullName: "Chinwe Obiageli", bio: "Mental Health Awareness campaign founder", level: "500L" },
      { officeId: officeMap["President"], fullName: "Emeka Okonkwo", bio: "Former class rep and community service advocate", level: "400L" },
      { officeId: officeMap["President"], fullName: "Rashidat Adunola", bio: "Students' Union conference delegate 2023", level: "500L" },

      // Vice President (3)
      { officeId: officeMap["Vice President"], fullName: "Fatima Al-Hassan", bio: "Academic excellence award winner 2023", level: "400L" },
      { officeId: officeMap["Vice President"], fullName: "James Adeniyi", bio: "Student Union conference delegate and peer mentor", level: "400L" },
      { officeId: officeMap["Vice President"], fullName: "Kemi Afolabi", bio: "Faculty liaison and inter-department coordinator", level: "400L" },

      // General Secretary (3)
      { officeId: officeMap["General Secretary"], fullName: "Ngozi Eze", bio: "Newsletter editor and documentation lead", level: "300L" },
      { officeId: officeMap["General Secretary"], fullName: "Usman Danladi", bio: "Departmental coordinator with strong record keeping", level: "300L" },
      { officeId: officeMap["General Secretary"], fullName: "Chidinma Obi", bio: "Faculty newsletter writer and event planner", level: "300L" },

      // Assistant General Secretary (3)
      { officeId: officeMap["Assistant General Secretary"], fullName: "Biodun Olusegun", bio: "Class secretary for two consecutive years", level: "300L" },
      { officeId: officeMap["Assistant General Secretary"], fullName: "Halima Musa", bio: "Departmental correspondence and filing lead", level: "200L" },
      { officeId: officeMap["Assistant General Secretary"], fullName: "Ridwan Lawal", bio: "Active member of the Faculty communications team", level: "300L" },

      // Financial Secretary (3)
      { officeId: officeMap["Financial Secretary"], fullName: "Blessing Okoro", bio: "2 years of dues management experience", level: "400L" },
      { officeId: officeMap["Financial Secretary"], fullName: "Olamide Taiwo", bio: "Financial literacy advocate and workshop organiser", level: "300L" },
      { officeId: officeMap["Financial Secretary"], fullName: "Femi Akintunde", bio: "Class financial officer and budget tracker", level: "300L" },

      // Treasurer (3)
      { officeId: officeMap["Treasurer"], fullName: "Precious Odoh", bio: "Accounting background and Faculty fund auditor", level: "400L" },
      { officeId: officeMap["Treasurer"], fullName: "Sola Ogundimu", bio: "Transparent financial management advocate", level: "400L" },
      { officeId: officeMap["Treasurer"], fullName: "Zaynab Yusuf", bio: "Departmental budget committee member", level: "300L" },

      // PRO (4)
      { officeId: officeMap["Public Relations Officer"], fullName: "Amaka Nwosu", bio: "Social media manager and photographer", level: "300L" },
      { officeId: officeMap["Public Relations Officer"], fullName: "Seun Adeyinka", bio: "Content creator with 5k+ followers on Faculty page", level: "200L" },
      { officeId: officeMap["Public Relations Officer"], fullName: "Tunde Adeyemi", bio: "Faculty blog writer and graphic designer", level: "300L" },
      { officeId: officeMap["Public Relations Officer"], fullName: "Rabi Garba", bio: "Media coordinator and video editor", level: "300L" },

      // Social Director (3)
      { officeId: officeMap["Social Director"], fullName: "Chima Okonkwo", bio: "Event organiser and cultural week coordinator", level: "200L" },
      { officeId: officeMap["Social Director"], fullName: "Hauwa Abubakar", bio: "Entertainment committee lead and DJ", level: "200L" },
      { officeId: officeMap["Social Director"], fullName: "Yetunde Salami", bio: "Faculty social events planner since 100L", level: "200L" },

      // Sports Director Male (3)
      { officeId: officeMap["Sports Director (Male)"], fullName: "Korede Adebayo", bio: "Faculty football team captain 2023", level: "300L" },
      { officeId: officeMap["Sports Director (Male)"], fullName: "Ebele Chukwu", bio: "Athletics rep and inter-faculty games participant", level: "200L" },
      { officeId: officeMap["Sports Director (Male)"], fullName: "Musa Bello", bio: "Basketball team lead and fitness advocate", level: "200L" },

      // Sports Director Female (3)
      { officeId: officeMap["Sports Director (Female)"], fullName: "Bukola Olawale", bio: "Volleyball captain and inter-faculty medalist", level: "200L" },
      { officeId: officeMap["Sports Director (Female)"], fullName: "Amina Ibrahim", bio: "Table tennis champion and sports organiser", level: "200L" },
      { officeId: officeMap["Sports Director (Female)"], fullName: "Dami Adeleke", bio: "Athletics team member and Faculty games rep", level: "200L" },

      // Welfare Officer (4)
      { officeId: officeMap["Welfare Officer"], fullName: "Chioma Eze", bio: "Peer counsellor and mental health advocate", level: "300L" },
      { officeId: officeMap["Welfare Officer"], fullName: "Tope Oluwole", bio: "Student support lead and bursary advisor", level: "300L" },
      { officeId: officeMap["Welfare Officer"], fullName: "Halimat Zubair", bio: "Welfare desk volunteer and student rights advocate", level: "300L" },
      { officeId: officeMap["Welfare Officer"], fullName: "Bello Fatima", bio: "Counselling society member and outreach volunteer", level: "200L" },

      // Academic Director (3)
      { officeId: officeMap["Academic Director"], fullName: "Emeka Okafor", bio: "Study group organiser and tutorial facilitator", level: "400L" },
      { officeId: officeMap["Academic Director"], fullName: "Adunola Rashidat", bio: "First class student and departmental tutor", level: "400L" },
      { officeId: officeMap["Academic Director"], fullName: "Nwosu Ngozi", bio: "Library committee member and academic mentor", level: "300L" },

      // 100L Rep (4)
      { officeId: officeMap["100L Class Representative"], fullName: "Adesola Kehinde", bio: "Passionate about student welfare from day one", level: "100L" },
      { officeId: officeMap["100L Class Representative"], fullName: "Maryam Kabir", bio: "Organised and dedicated to 100L representation", level: "100L" },
      { officeId: officeMap["100L Class Representative"], fullName: "Chukwuemeka Ibe", bio: "Student voice advocate and class leader", level: "100L" },
      { officeId: officeMap["100L Class Representative"], fullName: "Fatimah Oladele", bio: "Committed to bridging students and administration", level: "100L" },

      // 200L Rep (4)
      { officeId: officeMap["200L Class Representative"], fullName: "Olumide Bankole", bio: "Former 100L class governor, proactive leader", level: "200L" },
      { officeId: officeMap["200L Class Representative"], fullName: "Aisha Suleiman", bio: "Effective communicator and student union member", level: "200L" },
      { officeId: officeMap["200L Class Representative"], fullName: "Chinedu Okeke", bio: "Diligent class rep with strong academic record", level: "200L" },
      { officeId: officeMap["200L Class Representative"], fullName: "Nkechi Okonkwo", bio: "Committed to 200L welfare and academic excellence", level: "200L" },

      // 300L Rep (4)
      { officeId: officeMap["300L Class Representative"], fullName: "Gbenga Adewale", bio: "Two-time class officer with proven track record", level: "300L" },
      { officeId: officeMap["300L Class Representative"], fullName: "Zainab Musa", bio: "Departmental liaison and student advocate", level: "300L" },
      { officeId: officeMap["300L Class Representative"], fullName: "Ifeanyi Obi", bio: "Student union representative and mentor", level: "300L" },
      { officeId: officeMap["300L Class Representative"], fullName: "Taiwo Adeola", bio: "Committed to improving 300L learning conditions", level: "300L" },

      // 400L Rep (4)
      { officeId: officeMap["400L Class Representative"], fullName: "Rotimi Adesanya", bio: "Experienced class rep and industry attachment coordinator", level: "400L" },
      { officeId: officeMap["400L Class Representative"], fullName: "Hadiza Aliyu", bio: "Faculty-industry liaison and academic advocate", level: "400L" },
      { officeId: officeMap["400L Class Representative"], fullName: "Chukwuma Eze", bio: "Vocal advocate for 400L student rights", level: "400L" },
      { officeId: officeMap["400L Class Representative"], fullName: "Yewande Adeyemi", bio: "SIWES coordinator and peer mentor", level: "400L" },

      // 500/600L Rep (3)
      { officeId: officeMap["500/600L Class Representative"], fullName: "Pelumi Adeyinka", bio: "Final year representative and intern coordinator", level: "500L" },
      { officeId: officeMap["500/600L Class Representative"], fullName: "Abubakar Sadiq", bio: "Pharmacy intern advocate and peer counsellor", level: "600L" },
      { officeId: officeMap["500/600L Class Representative"], fullName: "Omotola Owolabi", bio: "Passionate about smooth final year transition", level: "500L" },
    ];

    await db.insert(candidatesTable).values(candidateData);
    console.log(`✓ 17 offices created with ${candidateData.length} candidates`);
  } else {
    console.log("• Offices already exist — skipping");
  }

  // ── Sample student records (with demo personal codes for testing) ─────────────
  const existingStudents = await db.select().from(studentRecordsTable).limit(1);
  if (existingStudents.length === 0) {
    const demoCodeHash = await bcrypt.hash("Test@12345", 12);
    const levels = ["100L", "200L", "300L", "400L", "500L", "600L"] as const;
    const names = [
      "Adeyemi Tunde", "Okonkwo Chima", "Bello Fatima", "Eze Chioma", "Adebayo Korede",
      "Ibrahim Amina", "Okafor Emeka", "Oluwole Tope", "Nwosu Ngozi", "Salami Yetunde",
      "Abubakar Hauwa", "Danladi Usman", "Okoro Blessing", "Taiwo Olamide", "Adeyinka Seun",
      "Nwosu Amaka", "Afolabi Kemi", "Musa Halima", "Olusegun Biodun", "Chukwu Ebele",
      "Olawale Bukola", "Garba Rabi", "Onyeka Chinonso", "Lawal Ridwan", "Akintunde Femi",
      "Zubair Halimat", "Odoh Precious", "Ogundimu Sola", "Yusuf Zaynab", "Adeleke Dami",
    ];

    const students = names.map((fullName, i) => {
      const level = levels[i % 6];
      const year = 2024 - Math.floor(i / 6);
      const num = String(i + 1).padStart(3, "0");
      return {
        matricNumber: `PHA/${year}/${num}`,
        email: `student${i + 1}@pharmsci.edu.ng`,
        fullName,
        level: level as never,
        personalCodeHash: demoCodeHash,
      };
    });

    await db.insert(studentRecordsTable).values(students).onConflictDoNothing();
    console.log(`✓ ${students.length} demo student records added (personalCode: Test@12345)`);
    console.log(`  Example: matric=PHA/2024/001  email=student1@pharmsci.edu.ng  personalCode=Test@12345`);
  } else {
    console.log("• Student records already exist — skipping");
  }

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
