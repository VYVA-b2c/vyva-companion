export type UtilityType = "electricity" | "gas" | "dual";
export type UtilityConfidence = "high" | "medium" | "low";

export interface NormalizedUtilityInput {
  country: "ES";
  utility_type: UtilityType;
  postcode: string;
  cups: string;
  provider: string;
  tariff_name: string;
  power_kw: number | null;
  consumption_kwh: number | null;
  billing_period_days: number | null;
  total_cost: number | null;
  has_social_bonus: boolean | null;
  confidence: number;
  missing_fields: string[];
}

export interface UtilityComparisonResult {
  provider: string;
  tariff_name: string;
  estimated_monthly_cost: number | null;
  estimated_annual_cost: number | null;
  estimated_monthly_savings: number | null;
  contract_type: string;
  permanence: string;
  price_stability: string;
  green_energy: boolean | null;
  source: "CNMC" | "Fallback";
  confidence: UtilityConfidence;
  notes: string[];
}

export interface CnmcComparisonResponse {
  source_used: "CNMC" | "Fallback";
  source_status: "success" | "fallback" | "failed";
  results: UtilityComparisonResult[];
  explanation: string;
}

function monthlyBaseline(input: NormalizedUtilityInput): number {
  if (input.total_cost && input.billing_period_days && input.billing_period_days > 0) {
    return Math.max(0, (input.total_cost / input.billing_period_days) * 30.4);
  }
  if (input.total_cost) return input.total_cost;
  if (input.consumption_kwh) return Math.max(0, input.consumption_kwh * 0.22);
  return 75;
}

function buildFallbackResults(input: NormalizedUtilityInput): UtilityComparisonResult[] {
  const current = monthlyBaseline(input);
  const utilityLabel = input.utility_type === "gas" ? "Gas" : input.utility_type === "dual" ? "Luz + gas" : "Luz";
  const options = [
    {
      provider: "Comparacion orientativa VYVA",
      tariff_name: `${utilityLabel} - opcion recomendada`,
      factor: 0.84,
      contract_type: "Mercado libre / revisar condiciones",
      permanence: "Comprobar antes de contratar",
      price_stability: "Precio orientativo con datos parciales",
      green_energy: null,
      notes: ["CNMC no respondio a tiempo; esta opcion usa una estimacion orientativa.", "Conviene confirmar precio final en el comparador oficial."],
    },
    {
      provider: "Tarifa economica estimada",
      tariff_name: `${utilityLabel} - mas economica`,
      factor: 0.79,
      contract_type: "Comparacion secundaria",
      permanence: "Puede variar",
      price_stability: "Menos estable; revisar letra pequena",
      green_energy: null,
      notes: ["Prioriza ahorro estimado, no simplicidad.", "No es una recomendacion comercial."],
    },
    {
      provider: "Tarifa estable estimada",
      tariff_name: `${utilityLabel} - mas estable`,
      factor: 0.90,
      contract_type: "Precio estable / sencilla",
      permanence: "Comprobar permanencia",
      price_stability: "Mas estable y facil de entender",
      green_energy: null,
      notes: ["Prioriza claridad y estabilidad sobre maximo ahorro.", "Resultado orientativo."],
    },
  ];

  return options.map((option) => {
    const monthly = Number((current * option.factor).toFixed(2));
    return {
      provider: option.provider,
      tariff_name: option.tariff_name,
      estimated_monthly_cost: monthly,
      estimated_annual_cost: Number((monthly * 12).toFixed(2)),
      estimated_monthly_savings: Number(Math.max(0, current - monthly).toFixed(2)),
      contract_type: option.contract_type,
      permanence: option.permanence,
      price_stability: option.price_stability,
      green_energy: option.green_energy,
      source: "Fallback" as const,
      confidence: "low" as const,
      notes: option.notes,
    };
  });
}

function scoreResult(result: UtilityComparisonResult): number {
  const saving = result.estimated_monthly_savings ?? 0;
  const savingsScore = Math.min(45, saving * 2);
  const confidenceScore = result.confidence === "high" ? 25 : result.confidence === "medium" ? 16 : 8;
  const simplicityScore = /sin permanencia|estable|sencilla|facil/i.test(`${result.permanence} ${result.price_stability}`) ? 20 : 12;
  const stabilityScore = /estable|fijo|regulado/i.test(result.price_stability) ? 10 : 5;
  return savingsScore + confidenceScore + simplicityScore + stabilityScore;
}

function rankAndTrim(results: UtilityComparisonResult[]): UtilityComparisonResult[] {
  return [...results].sort((a, b) => scoreResult(b) - scoreResult(a)).slice(0, 3);
}

function parseMoney(text: string): number | null {
  const match = text.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function attemptCnmcAutomation(input: NormalizedUtilityInput): Promise<UtilityComparisonResult[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ locale: "es-ES" });
    await page.goto("https://comparador.cnmc.gob.es/", { waitUntil: "domcontentloaded", timeout: 30000 });

    const bodyText = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 8000);
    const hasComparator = /comparador|electricidad|gas|ofertas|tarifa/i.test(bodyText);
    if (!hasComparator) throw new Error("CNMC comparator page did not expose expected text");

    const inputs = await page.locator("input").count();
    for (let i = 0; i < inputs; i += 1) {
      const inputEl = page.locator("input").nth(i);
      const attrs = `${await inputEl.getAttribute("name").catch(() => "")} ${await inputEl.getAttribute("id").catch(() => "")} ${await inputEl.getAttribute("placeholder").catch(() => "")}`;
      if (/postal|cp|codigo/i.test(attrs)) await inputEl.fill(input.postcode).catch(() => undefined);
      if (/consumo|kwh/i.test(attrs) && input.consumption_kwh != null) await inputEl.fill(String(Math.round(input.consumption_kwh))).catch(() => undefined);
      if (/potencia|kw/i.test(attrs) && input.power_kw != null) await inputEl.fill(String(input.power_kw).replace(".", ",")).catch(() => undefined);
    }

    const clickable = page.getByRole("button", { name: /comparar|buscar|calcular|simular|siguiente/i }).first();
    if (await clickable.count()) {
      await clickable.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
    }

    const resultText = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 12000);
    const lines = resultText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const moneyLines = lines.filter((line) => parseMoney(line) != null);
    if (moneyLines.length < 2) throw new Error("CNMC did not expose parseable tariff results");

    const current = monthlyBaseline(input);
    const parsed = moneyLines.slice(0, 6).map((line, index): UtilityComparisonResult => {
      const amount = parseMoney(line);
      const monthly = amount && amount > 250 ? amount / 12 : amount;
      const nearby = lines.slice(Math.max(0, lines.indexOf(line) - 2), lines.indexOf(line) + 3).join(" ");
      return {
        provider: nearby.split(/\s+-\s+|:/)[0]?.slice(0, 80) || `Resultado CNMC ${index + 1}`,
        tariff_name: nearby.slice(0, 120) || `Tarifa CNMC ${index + 1}`,
        estimated_monthly_cost: monthly ? Number(monthly.toFixed(2)) : null,
        estimated_annual_cost: monthly ? Number((monthly * 12).toFixed(2)) : null,
        estimated_monthly_savings: monthly ? Number(Math.max(0, current - monthly).toFixed(2)) : null,
        contract_type: "Comparador oficial CNMC",
        permanence: /permanencia/i.test(nearby) ? "Revisar permanencia indicada" : "No detectada automaticamente",
        price_stability: /fijo|estable/i.test(nearby) ? "Precio estable indicado" : "Revisar estabilidad del precio",
        green_energy: /verde|renovable/i.test(nearby) ? true : null,
        source: "CNMC",
        confidence: "medium",
        notes: ["Extraido del comparador oficial CNMC mediante automatizacion."],
      };
    });

    return rankAndTrim(parsed);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function compareWithCnmc(input: NormalizedUtilityInput): Promise<CnmcComparisonResponse> {
  try {
    const cnmcResults = await attemptCnmcAutomation(input);
    if (cnmcResults.length > 0) {
      return {
        source_used: "CNMC",
        source_status: "success",
        results: cnmcResults,
        explanation: "He comparado con el comparador oficial de la CNMC usando los datos normalizados de la factura.",
      };
    }
  } catch (err) {
    console.warn("[utilities/cnmc] Falling back after CNMC automation issue:", err instanceof Error ? err.message : err);
  }

  return {
    source_used: "Fallback",
    source_status: "fallback",
    results: rankAndTrim(buildFallbackResults(input)),
    explanation: "No he podido completar la comparacion oficial de la CNMC ahora. Muestro una estimacion orientativa con menor confianza.",
  };
}
