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

function isCnmcResultsUrl(url?: string): boolean {
  return !!url && /^https:\/\/comparador\.cnmc\.gob\.es\/comparador\/listado\//i.test(url);
}

function isNumeric(value: unknown): value is number | string {
  return value !== null && value !== undefined && value !== "" && !Number.isNaN(Number(value));
}

function padNumber(value: unknown, length: number): string {
  return isNumeric(value) ? String(Math.round(Number(value))).padStart(length, "0") : "0".repeat(length);
}

function normalizeCnmcPower(value: unknown): string {
  if (!isNumeric(value)) return "00000";
  const numeric = Number(value);
  const fixed = numeric.toFixed(3).replace(".", "");
  return (numeric >= 10 ? fixed : `0${fixed}`).padEnd(5, "0");
}

function normalizeCnmcPrice(value: unknown): string {
  if (!isNumeric(value)) return "00000000";
  const numeric = Number(value);
  const fixed = numeric.toFixed(2).replace(".", "");
  return (numeric >= 10 ? fixed : `0${fixed}`).padStart(8, "0");
}

function normalizeCnmcAdjustment(value: unknown): string {
  if (!isNumeric(value)) return "000000";
  const numeric = Number(value);
  if (numeric < 0) return `9${Math.abs(numeric).toFixed(2).replace(".", "").padStart(5, "0")}`;
  const fixed = numeric.toFixed(2).replace(".", "");
  if (numeric >= 100) return `0${fixed.padStart(5, "0")}`;
  if (numeric >= 10) return `0${(`0${fixed}`).padStart(5, "0")}`;
  return `0${(`00${fixed}`).padStart(5, "0")}`;
}

function normalizeCnmcAdjustmentUnitPrice(value: unknown): string {
  if (!isNumeric(value)) return "000000";
  const numeric = Number(value);
  const sign = numeric < 0 ? "9" : "0";
  return `${sign}${Math.abs(numeric).toFixed(4).replace(".", "").padStart(5, "0")}`;
}

function normalizeCnmcPowerPrice(value: unknown): string {
  return isNumeric(value) ? Number(value).toFixed(6).replace(".", "").padStart(8, "0") : "00000000";
}

function normalizeCnmcEnergyPrice(value: unknown): string {
  return isNumeric(value) ? Number(value).toFixed(6).replace(".", "").padStart(7, "0") : "0000000";
}

function annualizeConsumption(input: NormalizedUtilityInput, utility: "electricity" | "gas"): number {
  const raw = input.consumption_kwh ?? (utility === "gas" ? 6000 : 2600);
  if (input.billing_period_days && input.billing_period_days > 0 && input.consumption_kwh != null) {
    return Math.max(1, Math.round((raw / input.billing_period_days) * 365));
  }
  return Math.max(1, Math.round(raw));
}

function annualGasConsumption(input: NormalizedUtilityInput, utilityType: "E" | "G" | "C"): number {
  if (utilityType === "E") return 6000;
  if (utilityType === "C") {
    // V1 extracts a single consumption value from most bills. For dual links,
    // treat that value as electricity and use CNMC's common gas default.
    return 6000;
  }
  return annualizeConsumption(input, "gas");
}

function splitAnnualElectricityConsumption(total: number) {
  const first = Math.round(total * 0.2865);
  const second = Math.round(total * 0.2458);
  return {
    first,
    second,
    third: Math.max(0, total - first - second),
  };
}

function cnmcParamsToHex(digits: string): string {
  let hex = BigInt(digits).toString(16).toUpperCase();
  if (hex.length % 2) hex = `0${hex}`;
  return hex;
}

export function buildCnmcResultsUrl(input: NormalizedUtilityInput): string {
  const postcode = input.postcode?.replace(/\D/g, "").slice(0, 5) ?? "";
  if (postcode.length !== 5) return "";
  const utilityType = input.utility_type === "gas" ? "G" : input.utility_type === "dual" ? "C" : "E";
  const annualElectricity = utilityType === "G" ? 2600 : annualizeConsumption(input, "electricity");
  const annualGas = annualGasConsumption(input, utilityType);
  const electricitySplit = splitAnnualElectricityConsumption(annualElectricity);
  const power = input.power_kw ?? 3.5;

  let digits = "";
  digits += utilityType === "E" ? "1" : utilityType === "G" ? "2" : "3";
  digits += "4"; // Default domestic 2.0TD-style tariff used by CNMC when the bill does not expose a clearer tariff.
  digits += "0"; // No additional services and no permanence by default.
  digits += postcode.padStart(5, "0");
  digits += normalizeCnmcPower(power);
  digits += normalizeCnmcPower(power);
  digits += normalizeCnmcPower(power);
  digits += normalizeCnmcPower(power);
  digits += normalizeCnmcPower(power);
  digits += normalizeCnmcPower(power);
  digits += normalizeCnmcPower(power);
  digits += padNumber(annualElectricity, 6);
  digits += padNumber(electricitySplit.first, 6);
  digits += padNumber(electricitySplit.second, 6);
  digits += padNumber(electricitySplit.third, 6);
  digits += "000000"; // Extra electricity periods are only used for higher-power tariffs.
  digits += "000000";
  digits += "000000";
  digits += padNumber(annualGas, 7);
  digits += "000000"; // idOferta
  digits += "0000"; // curvaConsumo
  digits += "1"; // vivienda
  digits += padNumber(annualElectricity, 6);
  digits += padNumber(annualGas, 7);
  digits += "000000".repeat(12); // QR and provider-specific consumption splits.
  digits += "1"; // factura
  digits += normalizeCnmcPrice(input.total_cost);
  digits += "0000"; // commercialiser code
  digits += "0000000000000".repeat(3); // dates
  digits += "0"; // access tariff / QR flag
  digits += input.has_social_bonus ? "1" : "0";
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPrice(null);
  digits += "0";
  digits += normalizeCnmcAdjustment(null);
  digits += normalizeCnmcAdjustment(null);
  digits += normalizeCnmcAdjustment(null);
  digits += normalizeCnmcAdjustment(null);
  digits += normalizeCnmcAdjustmentUnitPrice(null);
  digits += normalizeCnmcAdjustmentUnitPrice(null);
  digits += normalizeCnmcAdjustmentUnitPrice(null);
  digits += normalizeCnmcAdjustmentUnitPrice(null);
  digits += normalizeCnmcAdjustment(null);
  digits += "0000000000000";
  digits += "0000";
  digits += "000";
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPower(null);
  digits += normalizeCnmcPower(null);
  digits += "0000000000000";
  digits += `0${normalizeCnmcPrice(null)}`;
  digits += `0${normalizeCnmcPrice(null)}`;
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPrice(null);
  digits += normalizeCnmcPowerPrice(null);
  digits += normalizeCnmcPowerPrice(null);
  digits += normalizeCnmcEnergyPrice(null);
  digits += normalizeCnmcEnergyPrice(null);
  digits += normalizeCnmcEnergyPrice(null);
  digits += "00000";
  digits += "00000";
  digits += "0"; // cambio
  digits += "0"; // promo
  digits += "0"; // verde
  digits += "0"; // revision flag
  digits += "0000000000000";
  digits += "0"; // trampeo
  digits += "00"; // perfil consumo
  digits += "0000"; // cups internal id
  digits += "2"; // revisionPrecios
  digits += "000000"; // autoconsumo energy
  digits += "0000000"; // auditoria
  digits += "0000000000000";
  digits += "0000000000000";
  digits += normalizeCnmcPower(3.5);
  digits += "0"; // autoconsumo

  return `${CNMC_COMPARATOR_URL}comparador/listado/${cnmcParamsToHex(digits)}`;
}

interface CandidateLink {
  text: string;
  href: string;
}

interface CnmcApiOffer {
  comercializadora?: string;
  oferta?: string;
  importePrimerAnio?: number;
  importeSegundoAnio?: number;
  validez?: string;
  penalizacion?: boolean;
  verde?: boolean;
  serviciosAdicionales?: boolean;
  tipoRevision?: number;
}

function buildCnmcApiUrl(input: NormalizedUtilityInput): string {
  const utilityType = input.utility_type === "gas" ? "G" : input.utility_type === "dual" ? "C" : "E";
  const endpoint = input.utility_type === "gas" ? "gas" : input.utility_type === "dual" ? "conjuntas" : "electricidad";
  const postcode = input.postcode?.replace(/\D/g, "").slice(0, 5) || "00000";
  const annualElectricity = utilityType === "G" ? 2600 : annualizeConsumption(input, "electricity");
  const annualGas = annualGasConsumption(input, utilityType);
  const electricitySplit = splitAnnualElectricityConsumption(annualElectricity);
  const power = input.power_kw ?? 3.5;

  const params: Record<string, string | number | boolean> = {
    tipoSuministro: utilityType,
    codigoPostal: postcode,
    potencia: power,
    potenciaPrimeraFranja: power,
    potenciaSegundaFranja: power,
    potenciaTerceraFranja: power,
    potenciaCuartaFranja: power,
    potenciaQuintaFranja: power,
    potenciaSextaFranja: power,
    consumoAnualE: annualElectricity,
    consumoAnualEOrig: annualElectricity,
    consumoPrimeraFranja: electricitySplit.first,
    consumoSegundaFranja: electricitySplit.second,
    consumoTerceraFranja: electricitySplit.third,
    consumoCuartaFranja: 0,
    consumoQuintaFranja: 0,
    consumoSextaFranja: 0,
    consumoAnualEQr: 0,
    consumoPrimeraFranjaQr: 0,
    consumoSegundaFranjaQr: 0,
    consumoTerceraFranjaQr: 0,
    consumoCuartaFranjaQr: 0,
    consumoQuintaFranjaQr: 0,
    consumoSextaFranjaQr: 0,
    consumoAnualEPQr: 0,
    consumoPrimeraFranjaPQr: 0,
    consumoSegundaFranjaPQr: 0,
    consumoTerceraFranjaPQr: 0,
    consumoCuartaFranjaPQr: 0,
    consumoQuintaFranjaPQr: 0,
    consumoSextaFranjaPQr: 0,
    tarifa: 4,
    consumoAnualG: annualGas,
    consumoAnualGOrig: annualGas,
    serviciosAdicionales: 2,
    permanencia: 2,
    vivienda: true,
    factura: false,
    energiaAutoconsumo: 0,
    idAuditoriaQR: 0,
    potenciaAutoconsumo: 3.5,
    revisionPrecios: 2,
    importe: 0,
    tc: 0,
    bs: 0,
    impSA: 0,
    impOtros: 0,
    exc: 0,
    reg: 0,
    mecanismoAjuste: 0,
    importeMecanismoAjustePunta: 0,
    importeMecanismoAjusteLlano: 0,
    importeMecanismoAjusteValle: 0,
    precioConsumoMecanismoAjustePunta: 0,
    precioConsumoMecanismoAjusteLlano: 0,
    precioConsumoMecanismoAjusteValle: 0,
    precioConsumoMecanismoAjusteTotal: 0,
    mecanismoAjusteIVA: 0,
    impOtrosConIE: 0,
    impOtrosSinIE: 0,
    pmaxP1: 0,
    pmaxP2: 0,
    dtoBS: 0,
    finBS: 0,
    ajuste: 0,
    impPot: 0,
    impEner: 0,
    dto: 0,
    prP1: 0,
    prP2: 0,
    prE1: 0,
    prE2: 0,
    prE3: 0,
    cfP1flex: 0,
    cfP2flex: 0,
    cambio: 0,
    promo: 0,
    verde: 0,
    rev: 0,
    trampeo: 0,
    perfilConsumo: 10,
    cups: input.cups || "0000",
    autoconsumo: false,
  };

  return `${CNMC_COMPARATOR_URL}api/publico/ofertas/${endpoint}?${new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString()}&`;
}

function extractCnmcApiOffers(payload: unknown, utilityType: UtilityType): CnmcApiOffer[] {
  const data = payload as Record<string, unknown>;
  const direct = [
    data.resultadoComparador,
    data.resultadoComparadorSinAjustePrecio,
    data.resultadoComparadorConAjustePrecio,
  ].filter(Array.isArray).flat() as CnmcApiOffer[];

  if (utilityType !== "dual") return direct;

  const jointContainers = [
    data.resultadoComparadorConjuntas,
    data.resultadoComparadorConjuntasSinAjustePrecio,
    data.resultadoComparadorConjuntasConAjustePrecio,
  ].filter((value): value is Record<string, unknown> => !!value && typeof value === "object");

  const joint = jointContainers
    .flatMap((container) => Array.isArray(container.ofertasConjuntas) ? container.ofertasConjuntas : []) as CnmcApiOffer[];

  return joint.length ? joint : direct;
}

function cnmcRevisionLabel(value: number | undefined): string {
  if (value === 5) return "Revisión de precios anual";
  if (value === 2) return "Precio regulado o revisión limitada";
  return "Condiciones indicadas por CNMC";
}

async function fetchCnmcApiResults(input: NormalizedUtilityInput): Promise<UtilityComparisonResult[]> {
  const response = await fetch(buildCnmcApiUrl(input), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`CNMC API returned ${response.status}`);

  const payload = await response.json();
  const offers = extractCnmcApiOffers(payload, input.utility_type)
    .filter((offer) => offer && offer.comercializadora && offer.oferta && isNumeric(offer.importePrimerAnio));

  if (!offers.length) throw new Error("CNMC API returned no offer rows");

  const current = monthlyBaseline(input);
  const seen = new Set<string>();
  const results = offers
    .map((offer): UtilityComparisonResult => {
      const annual = Number(offer.importePrimerAnio);
      const monthly = Number((annual / 12).toFixed(2));
      const key = `${offer.comercializadora}|${offer.oferta}|${annual}`;
      seen.add(key);
      return {
        provider: cleanResultLine(offer.comercializadora || "Proveedor CNMC"),
        tariff_name: cleanResultLine(offer.oferta || "Oferta CNMC"),
        estimated_monthly_cost: monthly,
        estimated_annual_cost: Number(annual.toFixed(2)),
        estimated_monthly_savings: Number(Math.max(0, current - monthly).toFixed(2)),
        contract_type: "Comparador oficial CNMC",
        permanence: offer.penalizacion ? "Puede incluir penalización" : "Sin penalización detectada",
        price_stability: cnmcRevisionLabel(offer.tipoRevision),
        green_energy: offer.verde ?? null,
        source: "CNMC",
        confidence: "high",
        notes: [
          offer.validez || "Oferta publicada por el comparador oficial CNMC.",
          offer.serviciosAdicionales ? "Incluye servicios adicionales; conviene revisarlos." : "Sin servicios adicionales detectados.",
        ],
      };
    })
    .filter((result, index, all) => {
      const key = `${result.provider}|${result.tariff_name}|${result.estimated_annual_cost}`;
      return all.findIndex((candidate) => `${candidate.provider}|${candidate.tariff_name}|${candidate.estimated_annual_cost}` === key) === index;
    });

  return rankAndTrim(results);
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
      provider: "Estimacion VYVA",
      tariff_name: `${utilityLabel} - calculo orientativo recomendado`,
      factor: 0.84,
      contract_type: "Estimacion orientativa",
      permanence: "",
      price_stability: "Orientativo",
      green_energy: null,
      notes: ["La comparacion oficial no respondio a tiempo; este resultado es orientativo."],
    },
    {
      provider: "Estimacion VYVA",
      tariff_name: `${utilityLabel} - calculo orientativo de ahorro`,
      factor: 0.79,
      contract_type: "Estimacion orientativa",
      permanence: "",
      price_stability: "Orientativo",
      green_energy: null,
      notes: ["Prioriza el posible ahorro, con menor confianza que una comparacion oficial."],
    },
    {
      provider: "Estimacion VYVA",
      tariff_name: `${utilityLabel} - calculo orientativo estable`,
      factor: 0.90,
      contract_type: "Estimacion orientativa",
      permanence: "",
      price_stability: "Orientativo",
      green_energy: null,
      notes: ["Prioriza claridad y estabilidad sobre maximo ahorro estimado."],
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

function looksLikeCnmcResultsPage(text: string): boolean {
  const normalized = normalizeForMatch(text);
  const hasResultLanguage = /importe anual|mercado libre|ver oferta|nombre comercializadora|revision de precios|permanencia/.test(normalized);
  const hasWelcomeLanguage = /bienvenido al portal del consumidor|tipo de suministro que desea contratar/.test(normalized);
  return hasResultLanguage && !hasWelcomeLanguage;
}

async function attemptCnmcAutomation(input: NormalizedUtilityInput): Promise<UtilityComparisonResult[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({ locale: "es-ES" });
    const generatedCnmcUrl = buildCnmcResultsUrl(input);
    let reachedResultsPage = false;

    if (generatedCnmcUrl) {
      await page.goto(generatedCnmcUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(() => undefined);
      const directText = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
      reachedResultsPage = looksLikeCnmcResultsPage(directText);
    }

    if (!reachedResultsPage) {
      await page.goto("https://comparador.cnmc.gob.es/", { waitUntil: "domcontentloaded", timeout: 30000 });

      const bodyText = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 8000);
      const hasComparator = /comparador|electricidad|gas|ofertas|tarifa/i.test(bodyText);
      if (!hasComparator) throw new Error("CNMC comparator page did not expose expected text");

      const startButton = page.getByRole("button", { name: /iniciar/i }).first();
      if (await startButton.count()) {
        await startButton.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
      }

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
    }

    const resultText = (await page.locator("body").innerText({ timeout: 10000 })).slice(0, 12000);
    if (!looksLikeCnmcResultsPage(resultText)) {
      throw new Error("CNMC did not reach a result listing page");
    }
    const lines = resultText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const moneyLines = lines.filter((line) => parseMoney(line) != null);
    if (moneyLines.length < 2) throw new Error("CNMC did not expose parseable tariff results");
    const links = await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => ({
      text: anchor.textContent ?? "",
      href: anchor.getAttribute("href") ?? "",
    }))).catch(() => [] as CandidateLink[]);
    const pageUrl = page.url();
    const resultsUrl = isCnmcResultsUrl(pageUrl) ? pageUrl : generatedCnmcUrl;

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
        source_url: isCnmcResultsUrl(resultsUrl) ? resultsUrl : undefined,
        provider_url: providerUrl || undefined,
        action_label: "Ver ofertas",
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
    const apiResults = await fetchCnmcApiResults(input);
    if (apiResults.length > 0) {
      return {
        source_used: "CNMC",
        source_status: "success",
        results: apiResults.map((result) => ({
          ...result,
          action_label: "Ver ofertas",
        })),
        explanation: "He comparado con los datos oficiales del comparador CNMC usando los datos normalizados de la factura.",
      };
    }
  } catch (err) {
    console.warn("[utilities/cnmc] CNMC API issue, trying browser automation:", err instanceof Error ? err.message : err);
  }

  try {
    const automatedResults = await attemptCnmcAutomation(input);
    if (automatedResults.length > 0) {
      const results = automatedResults.map((result) => ({
        ...result,
        source_url: isCnmcResultsUrl(result.source_url) ? result.source_url : undefined,
        action_label: "Ver ofertas",
      }));
      return {
        source_used: "CNMC",
        source_status: "success",
        results,
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
