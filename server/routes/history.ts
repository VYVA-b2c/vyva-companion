import type { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { woundScans, homeScans, scamChecks } from "../../shared/schema.js";

export async function scanHistoryHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id: string } }).user!.id;

  try {
    const [wounds, homes, scams] = await Promise.all([
      db
        .select()
        .from(woundScans)
        .where(eq(woundScans.user_id, userId))
        .orderBy(desc(woundScans.scanned_at)),
      db
        .select()
        .from(homeScans)
        .where(eq(homeScans.user_id, userId))
        .orderBy(desc(homeScans.scanned_at)),
      db
        .select()
        .from(scamChecks)
        .where(eq(scamChecks.user_id, userId))
        .orderBy(desc(scamChecks.checked_at)),
    ]);

    const merged = [
      ...wounds.map((r) => ({
        id: r.id,
        scan_type: "wound" as const,
        result_title: r.result_title,
        level: r.severity,
        advice: r.advice,
        explanation: null as string | null,
        hazards: null as string[] | null,
        steps: null as string[] | null,
        image_data: r.image_data ?? null,
        date: r.scanned_at,
      })),
      ...homes.map((r) => ({
        id: r.id,
        scan_type: "home" as const,
        result_title: r.result_title,
        level: r.risk_level,
        advice: r.advice,
        explanation: null as string | null,
        hazards: r.hazards,
        steps: null as string[] | null,
        image_data: r.image_data ?? null,
        date: r.scanned_at,
      })),
      ...scams.map((r) => ({
        id: r.id,
        scan_type: "scam" as const,
        result_title: r.result_title,
        level: r.risk_level,
        advice: null as string | null,
        explanation: r.explanation,
        hazards: null as string[] | null,
        steps: r.steps,
        image_data: r.image_data ?? null,
        date: r.checked_at,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json(merged);
  } catch (err) {
    console.error("[history] scan history fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch scan history" });
  }
}
