import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { heroMessages } from "../../shared/schema.js";

const heroMessagesRouter = Router();

function rowToDefinition(row: typeof heroMessages.$inferSelect) {
  return {
    id: row.message_id,
    surface: row.surface,
    reason: row.reason,
    priority: row.priority,
    cooldownHours: row.cooldown_hours,
    periods: row.periods ?? [],
    safetyLevels: row.safety_levels ?? [],
    eventTypes: row.event_types ?? [],
    activityTypes: row.activity_types ?? [],
    copy: row.copy ?? {},
  };
}

heroMessagesRouter.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(heroMessages)
      .where(eq(heroMessages.is_enabled, true))
      .orderBy(desc(heroMessages.priority));

    return res.json({ messages: rows.map(rowToDefinition), source: "admin" });
  } catch {
    return res.json({ messages: [], source: "built_in_fallback" });
  }
});

export default heroMessagesRouter;
