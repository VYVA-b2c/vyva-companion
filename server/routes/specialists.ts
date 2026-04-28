import { Router } from "express";
import { z } from "zod";
import { recommendSpecialists } from "../services/specialistFinder.js";

const router = Router();

const specialistSearchSchema = z.object({
  condition: z.string().trim().min(2),
  location: z.string().trim().optional(),
  language: z.string().trim().optional(),
  urgency: z.enum(["routine", "soon", "urgent"]).optional(),
  insurancePreference: z.string().trim().optional(),
});

router.post("/recommendations", async (req, res) => {
  const parsed = specialistSearchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "condition is required" });
  }

  try {
    const result = await recommendSpecialists(parsed.data);
    return res.json(result);
  } catch (err) {
    console.error("[specialists/recommendations]", err);
    return res.status(500).json({ error: "Failed to find specialists" });
  }
});

export default router;
