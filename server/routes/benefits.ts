import express, { type Request, type Response } from "express";
import { and, eq, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { benefitsPrograms, benefitsScreeningResponses } from "../../shared/schema.js";
import {
  BENEFITS_COUNTRIES,
  BENEFITS_LIVING_SITUATIONS,
  localizeBenefitsText,
  matchesBenefitsProgram,
  type BenefitsCountry,
  type BenefitsProgramRecord,
  type BenefitsProgramResult,
} from "../../shared/benefits.js";
import { normalizeAppLanguage } from "../../shared/language.js";

const router = express.Router();

const screeningSchema = z.object({
  country: z.enum(BENEFITS_COUNTRIES),
  region: z.string().trim().max(120).optional().default(""),
  age: z.coerce.number().int().min(18).max(120),
  livingSituation: z.enum(BENEFITS_LIVING_SITUATIONS),
  currentBenefits: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

function requestLanguage(req: Request) {
  const queryLanguage = typeof req.query.lang === "string" ? req.query.lang : undefined;
  return normalizeAppLanguage(queryLanguage ?? req.get("x-vyva-language"), "en");
}

function askInesStarter(language: ReturnType<typeof requestLanguage>, programName: string) {
  if (language === "es") return `¿Puedes explicarme ${programName} y ayudarme a confirmar si podría cumplir los requisitos?`;
  if (language === "de") return `Kannst du mir ${programName} erklären und mir helfen zu prüfen, ob ich die Voraussetzungen erfüllen könnte?`;
  return `Can you explain ${programName} and help me confirm whether I may qualify?`;
}

router.post("/screenings", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const parsed = screeningSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please complete every required question." });

  const answers = parsed.data;
  const language = requestLanguage(req);
  try {
    const regionFilter = answers.region
      ? or(isNull(benefitsPrograms.region), eq(benefitsPrograms.region, answers.region))
      : isNull(benefitsPrograms.region);
    const [savedRows, rows] = await Promise.all([
      db.insert(benefitsScreeningResponses).values({ user_id: userId, answers }).returning({ id: benefitsScreeningResponses.id }),
      db.select().from(benefitsPrograms).where(and(
        eq(benefitsPrograms.is_active, true),
        eq(benefitsPrograms.country, answers.country),
        regionFilter,
      )),
    ]);
    const results: BenefitsProgramResult[] = rows
      .map((row): BenefitsProgramRecord => ({
        id: row.id,
        country: row.country as BenefitsCountry,
        region: row.region,
        name: row.name,
        description: row.description,
        eligibilityRules: row.eligibility_rules,
        isActive: row.is_active,
      }))
      .filter((program) => matchesBenefitsProgram(program, answers))
      .map((program) => {
        const name = localizeBenefitsText(program.name, language);
        return {
          id: program.id,
          country: program.country,
          region: program.region,
          name,
          description: localizeBenefitsText(program.description, language),
          askInesStarter: askInesStarter(language, name),
        };
      });
    return res.status(201).json({ screeningId: savedRows[0]?.id ?? null, results });
  } catch (error) {
    console.error("[benefits] screening failed", error);
    return res.status(503).json({ error: "Benefits screening is temporarily unavailable." });
  }
});

export default router;
