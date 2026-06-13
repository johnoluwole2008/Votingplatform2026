import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const academicLevelEnum = pgEnum("academic_level", [
  "100L",
  "200L",
  "300L",
  "400L",
  "500L",
  "600L",
]);

export const adminRoleEnum = pgEnum("admin_role", [
  "super_admin",
  "editor",
  "observer",
]);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "student",
  "admin",
  "system",
]);

// ── Official student records (pre-loaded by admin; serve as auth source) ─────
export const studentRecordsTable = pgTable("student_records", {
  id: serial("id").primaryKey(),
  matricNumber: varchar("matric_number", { length: 50 }).notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  level: academicLevelEnum("level").notNull(),
  personalCodeHash: text("personal_code_hash"),
  hasVoted: boolean("has_voted").notNull().default(false),
  voteTimestamp: timestamp("vote_timestamp", { withTimezone: true }),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertStudentRecordSchema = createInsertSchema(
  studentRecordsTable,
).omit({ id: true, createdAt: true, personalCodeHash: true, hasVoted: true, voteTimestamp: true, ipAddress: true });
export type InsertStudentRecord = z.infer<typeof insertStudentRecordSchema>;
export type StudentRecord = typeof studentRecordsTable.$inferSelect;

// ── Election settings ────────────────────────────────────────────────────────
export const electionSettingsTable = pgTable("election_settings", {
  id: serial("id").primaryKey(),
  electionName: text("election_name").notNull().default("Faculty Elections"),
  registrationStart: timestamp("registration_start", {
    withTimezone: true,
  }),
  registrationEnd: timestamp("registration_end", { withTimezone: true }),
  votingStart: timestamp("voting_start", { withTimezone: true }),
  votingEnd: timestamp("voting_end", { withTimezone: true }),
  showLiveResults: boolean("show_live_results").notNull().default(false),
  totalExpectedVoters: integer("total_expected_voters").notNull().default(900),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ElectionSettings = typeof electionSettingsTable.$inferSelect;

// ── Admin accounts ────────────────────────────────────────────────────────────
export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: adminRoleEnum("role").notNull().default("observer"),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Admin = typeof adminsTable.$inferSelect;

// ── Admin invite tokens ───────────────────────────────────────────────────────
export const adminInviteTokensTable = pgTable("admin_invite_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  role: adminRoleEnum("role").notNull().default("observer"),
  createdByAdminId: integer("created_by_admin_id").references(() => adminsTable.id),
  email: text("email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByEmail: text("used_by_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AdminInviteToken = typeof adminInviteTokensTable.$inferSelect;

// ── Voter registrations ───────────────────────────────────────────────────────
export const voterRegistrationsTable = pgTable("voter_registrations", {
  id: serial("id").primaryKey(),
  matricNumber: varchar("matric_number", { length: 50 }).notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  level: academicLevelEnum("level").notNull(),
  passwordHash: text("password_hash"),
  hasVoted: boolean("has_voted").notNull().default(false),
  ipAddress: text("ip_address"),
  registrationTimestamp: timestamp("registration_timestamp", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  voteTimestamp: timestamp("vote_timestamp", { withTimezone: true }),
});

export type VoterRegistration = typeof voterRegistrationsTable.$inferSelect;

// ── Offices ───────────────────────────────────────────────────────────────────
export const officesTable = pgTable("offices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertOfficeSchema = createInsertSchema(officesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOffice = z.infer<typeof insertOfficeSchema>;
export type Office = typeof officesTable.$inferSelect;

// ── Candidates ────────────────────────────────────────────────────────────────
export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id")
    .notNull()
    .references(() => officesTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  level: text("level"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;

// ── Votes (anonymised — no link between voter identity and choice) ─────────────
export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  officeId: integer("office_id")
    .notNull()
    .references(() => officesTable.id),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidatesTable.id),
  voteHash: text("vote_hash").notNull(),
  votedAt: timestamp("voted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Vote = typeof votesTable.$inferSelect;

// ── Login attempts (for brute-force protection) ───────────────────────────────
export const loginAttemptsTable = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  matricNumber: varchar("matric_number", { length: 50 }).notNull(),
  ipAddress: text("ip_address"),
  success: boolean("success").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Audit logs (append-only) ──────────────────────────────────────────────────
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  actorId: text("actor_id"),
  actorType: auditActorTypeEnum("actor_type").notNull().default("system"),
  ipAddress: text("ip_address"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
