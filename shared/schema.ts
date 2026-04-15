import { pgTable, text, integer, boolean, real, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  full_name: text("full_name"),
  date_of_birth: text("date_of_birth"),
  language: text("language").notNull().default("en"),
  deployment: text("deployment").notNull().default("standard"),
  mem0_user_id: text("mem0_user_id"),
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  subscription_status: text("subscription_status").notNull().default("trial"),
  subscription_tier: text("subscription_tier").notNull().default("free"),
  trial_ends_at: timestamp("trial_ends_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ created_at: true, updated_at: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export const sessionState = pgTable("session_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
  session_id: text("session_id").notNull().unique(),
  current_agent: text("current_agent").notNull().default("companion"),
  last_agent: text("last_agent"),
  last_intent: text("last_intent"),
  last_activity_at: timestamp("last_activity_at", { withTimezone: true }),
  turn_count: integer("turn_count").notNull().default(0),
  next_agent_override: text("next_agent_override"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionStateSchema = createInsertSchema(sessionState).omit({ id: true, created_at: true, updated_at: true });
export type InsertSessionState = z.infer<typeof insertSessionStateSchema>;
export type SessionState = typeof sessionState.$inferSelect;

export const sessionExchanges = pgTable("session_exchanges", {
  id: uuid("id").primaryKey().defaultRandom(),
  session_id: text("session_id").notNull(),
  user_id: text("user_id").notNull(),
  speaker: text("speaker").notNull(),
  message: text("message").notNull(),
  agent_used: text("agent_used"),
  intent_classified: text("intent_classified"),
  intent_confidence: real("intent_confidence"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionExchangeSchema = createInsertSchema(sessionExchanges).omit({ id: true, created_at: true });
export type InsertSessionExchange = z.infer<typeof insertSessionExchangeSchema>;
export type SessionExchange = typeof sessionExchanges.$inferSelect;

export const agentDifficulty = pgTable("agent_difficulty", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
  agent_name: text("agent_name").notNull(),
  difficulty_level: integer("difficulty_level").notNull().default(1),
  sessions_at_level: integer("sessions_at_level").notNull().default(0),
  last_score: real("last_score"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentDifficultySchema = createInsertSchema(agentDifficulty).omit({ id: true, updated_at: true });
export type InsertAgentDifficulty = z.infer<typeof insertAgentDifficultySchema>;
export type AgentDifficulty = typeof agentDifficulty.$inferSelect;

export const caregiverAlerts = pgTable("caregiver_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
  alert_type: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  sent_to: text("sent_to").array(),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  resolved_by: text("resolved_by"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCaregiverAlertSchema = createInsertSchema(caregiverAlerts).omit({ id: true, created_at: true });
export type InsertCaregiverAlert = z.infer<typeof insertCaregiverAlertSchema>;
export type CaregiverAlert = typeof caregiverAlerts.$inferSelect;

export const medicationAdherence = pgTable("medication_adherence", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
  medication_name: text("medication_name").notNull(),
  scheduled_time: text("scheduled_time").notNull(),
  status: text("status").notNull(),
  confirmed_by: text("confirmed_by").notNull().default("user"),
  confirmed_taken_at: timestamp("confirmed_taken_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationAdherenceSchema = createInsertSchema(medicationAdherence).omit({ id: true, created_at: true });
export type InsertMedicationAdherence = z.infer<typeof insertMedicationAdherenceSchema>;
export type MedicationAdherence = typeof medicationAdherence.$inferSelect;

export const userMedications = pgTable("user_medications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").notNull(),
  medication_name: text("medication_name").notNull(),
  dosage: text("dosage"),
  frequency: text("frequency"),
  scheduled_times: text("scheduled_times").array(),
  active: boolean("active").notNull().default(true),
  added_by: text("added_by").notNull().default("user"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserMedicationSchema = createInsertSchema(userMedications).omit({ id: true, created_at: true });
export type InsertUserMedication = z.infer<typeof insertUserMedicationSchema>;
export type UserMedication = typeof userMedications.$inferSelect;
