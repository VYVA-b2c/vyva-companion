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
  source_url?: string;
  provider_url?: string;
  action_label?: string;
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

const CNMC_COMPARATOR_URL = "https://comparador.cnmc.gob.es/";

interface CandidateLink {
  text: string;
  href: string;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanResultLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyUtilityProvider(value: string): boolean {
  const text = normalizeForMatch(value);
  if (text.length < 3 || text.length > 90) return false;
  if (parseMoney(value) != null) return false;
  if (/comparador|cnmc|resultado|importe|precio|ahorro|condicion|permanencia|detalle|ver oferta|contratar|electricidad|gas natural|codigo postal|consumo|potencia/.test(text)) {
    return false;
  }
  return /energia|energy|luz|gas|endesa|iberdrola|naturgy|repsol|totalenergies|octopus|holaluz|factor|pepeenergy|lucera|plenitude|curenergia|comercializadora|energiaxxi|chc|gana|alcanzia|audax|nexus|som energia|fenie|watium|bonarea|electra/.test(text)
    || /^[a-z0-9][a-z0-9 ]{2,50}$/.test(text);
}

function extractResultIdentity(lines: string[], moneyLine: string, fallbackIndex: number): { provider: string; tariff: string; nearby: string } {
  const moneyIndex = lines.indexOf(moneyLine);
  const windowLines = lines
    .slice(Math.max(0, moneyIndex - 5), moneyIndex + 6)
    .map(cleanResultLine)
    .filter(Boolean);
  const provider = windowLines.find(isLikelyUtilityProvider) ?? `Resultado CNMC ${fallbackIndex + 1}`;
  const tariff = windowLines
    .find((line) => line !== provider && /tarifa|plan|precio|fijo|variable|discriminacion|2\.0|3\.0|luz|gas/i.test(line))
    ?? windowLines.filter((line) => line !== provider).slice(0, 3).join(" ").slice(0, 140)
    ?? `Tarifa CNMC ${fallbackIndex + 1}`;
  return {
    provider: provider.slice(0, 80),
    tariff: tariff.slice(0, 140),
    nearby: windowLines.join(" "),
  };
}

function toAbsoluteUrl(href: string, baseUrl: string): string {
  if (!href || /^javascript:|^#/.test(href)) return "";
  try {
    return new URL(href, baseUrl || CNMC_COMPARATOR_URL).toString();
  } catch {
    return "";
  }
}

function matchProviderUrl(provider: string, tariff: string, links: CandidateLink[], pageUrl: string): string {
  const providerKey = normalizeForMatch(provider);
  const tariffKey = normalizeForMatch(tariff);
  let best: { href: string; score: number } | null = null;

  for (const link of links) {
    const text = normalizeForMatch(link.text);
    const href = toAbsoluteUrl(link.href, pageUrl);
    if (!href) continue;
    let score = 0;
    if (providerKey && text.includes(providerKey)) score += 4;
    if (tariffKey && text.includes(tariffKey.slice(0, 24))) score += 3;
    if (/contratar|oferta|detalle|ver|mas informacion|web/.test(text)) score += 2;
    if (/comparador\.cnmc\.gob\.es/.test(href)) score += 1;
    if (score > (best?.score ?? 0)) best = { href, score };
  }

  return best && best.score >= 4 ? best.href : "";
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
      source_url: CNMC_COMPARATOR_URL,
      action_label: "Abrir comparador oficial",
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
    const links = await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => ({
      text: anchor.textContent ?? "",
      href: anchor.getAttribute("href") ?? "",
    }))).catch(() => [] as CandidateLink[]);
    const pageUrl = page.url();

    const current = monthlyBaseline(input);
    const parsed = moneyLines.slice(0, 6).map((line, index): UtilityComparisonResult => {
      const amount = parseMoney(line);
      const monthly = amount && amount > 250 ? amount / 12 : amount;
      const details = extractResultIdentity(lines, line, index);
      const providerUrl = matchProviderUrl(details.provider, details.tariff, links, pageUrl);
      return {
        provider: details.provider,
        tariff_name: details.tariff,
        estimated_monthly_cost: monthly ? Number(monthly.toFixed(2)) : null,
        estimated_annual_cost: monthly ? Number((monthly * 12).toFixed(2)) : null,
        estimated_monthly_savings: monthly ? Number(Math.max(0, current - monthly).toFixed(2)) : null,
        contract_type: "Comparador oficial CNMC",
        permanence: /permanencia/i.test(details.nearby) ? "Revisar permanencia indicada" : "No detectada automaticamente",
        price_stability: /fijo|estable/i.test(details.nearby) ? "Precio estable indicado" : "Revisar estabilidad del precio",
        green_energy: /verde|renovable/i.test(details.nearby) ? true : null,
        source: "CNMC",
        source_url: CNMC_COMPARATOR_URL,
        provider_url: providerUrl || undefined,
        action_label: providerUrl ? "Ver tarifa" : "Ver en CNMC",
        confidence: providerUrl ? "high" : "medium",
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
