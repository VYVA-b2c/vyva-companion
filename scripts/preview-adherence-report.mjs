import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const baseUrl = process.argv[2] || "http://127.0.0.1:5000";
const outArg = process.argv[3] || "adherence-report-preview-latest.png";
const outPath = path.isAbsolute(outArg) ? outArg : path.join(repoRoot, outArg);

const today = new Date("2026-05-05T09:00:00");
const sevenDayDates = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(today);
  date.setDate(today.getDate() - (6 - index));
  return date.toISOString().slice(0, 10);
});

const reportPayload = {
  hasLogs: true,
  weekPct: 78,
  monthPct: 86,
  sevenDayDates,
  perMedication: [
    {
      name: "Metformin",
      dosage: "500mg twice daily",
      taken: 11,
      scheduled: 14,
      streak: 4,
      dailyStatus: ["taken", "taken", "missed", "taken", "taken", "missed", "none"],
    },
    {
      name: "Lisinopril",
      dosage: "10mg every morning",
      taken: 7,
      scheduled: 7,
      streak: 7,
      dailyStatus: ["taken", "taken", "taken", "taken", "taken", "taken", "taken"],
    },
    {
      name: "Aspirin",
      dosage: "75mg every evening",
      taken: 6,
      scheduled: 7,
      streak: 2,
      dailyStatus: ["taken", "missed", "taken", "taken", "taken", "taken", "none"],
    },
  ],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 430, height: 1200 },
  deviceScaleFactor: 2,
});

await mkdir(path.dirname(outPath), { recursive: true });

await page.route("**/api/meds/adherence-report", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(reportPayload),
  });
});

await page.goto(`${baseUrl}/meds/adherence-report`, {
  waitUntil: "networkidle",
  timeout: 30000,
});

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log(outPath);
