import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  Car,
  Calendar,
  Search,
  Tag,
  RefreshCw,
  Plus,
  Sparkles,
  Home,
  ShieldCheck,
  PhoneCall,
  CircleCheck,
  CircleX,
  Share2,
  MapPin,
  Clock,
  ExternalLink,
  Camera,
  FileUp,
  Mic,
  PencilLine,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VoiceHero from "@/components/VoiceHero";
import { apiFetch } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StoredChatHistory {
  savedAt: string;
  messages: ChatMessage[];
}

interface RecommendationCard {
  id?: string;
  title: string;
  description: string;
  category: "deal" | "event" | "tip" | "activity";
  emoji: string;
  why?: string;
  details?: string;
  steps?: string[];
  action_label?: string;
  action_prompt?: string;
  safety_note?: string;
  best_time?: string;
  effort?: "none" | "low" | "medium";
  freshness?: string;
  personal_signals?: string[];
  action_kind?: "chat" | "call" | "booking" | "check" | "plan";
  action_payload?: {
    flow?: string;
    needs?: string[];
    search_terms?: string[];
    title?: string;
    category?: RecommendationCard["category"];
    personal_signals?: string[];
    location_hint?: string;
    safety_note?: string;
    resolved_place?: {
      name?: string;
      address?: string;
      phone?: string;
      website?: string;
      mapsUrl?: string;
      openingHours?: string[];
      priceInfo?: string;
      sourceName?: string;
      sourceUrl?: string;
      dateText?: string;
      timeInfo?: string;
      matchReason?: string;
      priceLevel?: number;
      rating?: number;
      reviewCount?: number;
    };
  };
  location_hint?: string;
  score?: number;
  reason_codes?: string[];
}

interface RecommendationActionPlan {
  title: string;
  summary: string;
  place_name?: string;
  address?: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  opening_hours?: string[];
  price_info: string;
  travel_info: string;
  accessibility_note: string;
  next_steps: string[];
  caveat: string;
  share_text: string;
}

interface ConciergePendingItem {
  id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone: string | null;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  status: "pending" | "calling" | "completed" | "failed" | "cancelled";
  language: string;
  confirmed_at?: string | null;
  expires_at?: string | null;
}

interface ConciergeSessionItem {
  id: string;
  pending_id: string | null;
  use_case: string;
  provider_name: string | null;
  outcome: string;
  outcome_payload: Record<string, unknown> | null;
  outcome_summary: string | null;
  completed_at?: string | null;
}

type ConciergeActionListResponse<T> = { items?: T[] };

interface OfferOption {
  label: "Opcion recomendada" | "Alternativa 1" | "Alternativa 2";
  name: string;
  category: string;
  what_it_offers: string;
  price_or_advantage: string;
  why_good_option: string;
  distance_or_availability: string;
  contact_method: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  trust_note: string;
  score: number;
}

interface OffersSearchResponse {
  category: string;
  options: OfferOption[];
  decision_explanation: string;
  neutrality_note: string;
  source_guidance: string[];
  next_step: string;
  no_results_message?: string;
}

type BillDocumentAnalysis = {
  document_type: "electricity_bill" | "gas_bill" | "internet_phone_bill" | "insurance_policy" | "home_service_invoice" | "unknown";
  category: string;
  provider_name: string | null;
  service_address?: string | null;
  postcode?: string | null;
  cups?: string | null;
  billing_period: string | null;
  billing_period_days?: number | null;
  total_amount: number | null;
  power_kw?: number | null;
  currency: string | null;
  usage: {
    kwh: number | null;
    gas_kwh: number | null;
    data_or_phone_plan: string | null;
  };
  tariff_or_plan: string | null;
  unit_prices: {
    electricity_price_per_kwh: number | null;
    gas_price_per_kwh: number | null;
    standing_charge: number | null;
  };
  confidence: "high" | "medium" | "low";
  missing_fields: string[];
  suggested_query: string;
  user_summary: string;
  isFallback?: boolean;
  fallback_reason?: "missing_api_key" | "invalid_model_json" | "openai_error" | "unreadable";
};

type UtilityInputMethod = "upload" | "photo" | "voice" | "manual";
type UtilityType = "electricity" | "gas" | "dual";
type SavingsPanelView = "overview" | "utilities";

interface NormalizedUtilityInput {
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

interface UtilityComparisonResult {
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
  confidence: "high" | "medium" | "low";
  notes: string[];
}

interface UtilityCompareResponse {
  normalized_input: NormalizedUtilityInput;
  source_used: "CNMC" | "Fallback";
  source_status: "success" | "fallback" | "failed";
  source_url?: string;
  summary: {
    headline: string;
    current_monthly_cost: number | null;
    best_estimated_monthly_cost: number | null;
    estimated_monthly_savings: number | null;
  };
  results: UtilityComparisonResult[];
  calculation_note: string;
  estimated_note: string;
  neutrality_note: string;
  source_note: string;
}

const OFFER_CATEGORY_CHIPS = [
  {
    es: "Gastos del hogar",
    en: "Household costs",
    detailEs: "Electricidad, gas, internet, telefono y mantenimiento.",
    detailEn: "Electricity, gas, internet, phone, and maintenance.",
    queryEs: "revisar gastos del hogar electricidad gas internet telefono mantenimiento",
    queryEn: "review household costs electricity gas internet phone maintenance",
  },
  {
    es: "Vivienda y cuidados",
    en: "Living and care",
    detailEs: "Residencias, centros de dia, ayuda a domicilio y estancias temporales.",
    detailEn: "Care homes, day centres, home help, and temporary stays.",
    queryEs: "comparar residencia mayores centro de dia ayuda a domicilio estancias temporales",
    queryEn: "compare senior residence day centre home care temporary stays",
  },
  {
    es: "Seguros y proteccion",
    en: "Insurance and protection",
    detailEs: "Salud, hogar, vida, asistencia y dependencia.",
    detailEn: "Health, home, life, assistance, and dependency support.",
    queryEs: "revisar seguro salud hogar vida asistencia dependencia cobertura precio",
    queryEn: "review health home life assistance dependency insurance coverage price",
  },
  {
    es: "Servicios en casa",
    en: "Home support",
    detailEs: "Limpieza, reparaciones, mantenimiento y cuidado personal en casa.",
    detailEn: "Cleaning, repairs, maintenance, and personal care at home.",
    queryEs: "servicios fiables en casa limpieza reparaciones mantenimiento cuidado personal",
    queryEn: "reliable home services cleaning repairs maintenance personal care",
  },
  {
    es: "Ayudas y beneficios",
    en: "Benefits and support",
    detailEs: "Subvenciones, beneficios para mayores, ayudas locales y programas sociales.",
    detailEn: "Grants, senior benefits, local support, and social programmes.",
    queryEs: "ayudas disponibles beneficios para mayores subvenciones programas sociales locales",
    queryEn: "available benefits senior support grants local social programmes",
  },
] as const;

const OFFER_IDEA_CHIPS = [
  {
    es: "Reducir gastos mensuales",
    en: "Reduce monthly costs",
    queryEs: "reducir gastos mensuales luz gas internet seguros servicios esenciales",
    queryEn: "reduce monthly costs electricity gas internet insurance essential services",
  },
  {
    es: "Revisar ayudas disponibles",
    en: "Review available benefits",
    queryEs: "revisar ayudas disponibles para mayores en mi zona",
    queryEn: "review available senior benefits in my area",
  },
  {
    es: "Comparar servicios de cuidado",
    en: "Compare care services",
    queryEs: "comparar ayuda a domicilio centros de dia residencias mayores",
    queryEn: "compare home help day centres senior residences",
  },
  {
    es: "Revisar mi internet",
    en: "Review my internet plan",
    queryEs: "revisar internet telefono precio cobertura facilidad para mayores",
    queryEn: "review internet phone price coverage ease for seniors",
  },
  {
    es: "Comprobar seguro actual",
    en: "Check current insurance",
    queryEs: "revisar seguro actual cobertura precio proteccion",
    queryEn: "review current insurance coverage price protection",
  },
  {
    es: "Ayuda fiable en casa",
    en: "Reliable help at home",
    queryEs: "buscar ayuda fiable en casa limpieza reparaciones mantenimiento",
    queryEn: "find reliable help at home cleaning repairs maintenance",
  },
  {
    es: "Opciones de residencia",
    en: "Care home options",
    queryEs: "comparar residencias de mayores cerca calidad precio ubicacion",
    queryEn: "compare nearby care homes quality price location",
  },
  {
    es: "Optimizar mis facturas",
    en: "Optimise my bills",
    queryEs: "optimizar facturas electricidad gas internet mantenimiento hogar",
    queryEn: "optimise bills electricity gas internet home maintenance",
  },
] as const;

const UTILITY_INPUT_METHODS = [
  { key: "upload", icon: FileUp, es: "Subir factura", en: "Upload bill" },
  { key: "photo", icon: Camera, es: "Hacer foto", en: "Take photo" },
  { key: "voice", icon: Mic, es: "Responder por voz", en: "Answer by voice" },
  { key: "manual", icon: PencilLine, es: "Rellenar datos manualmente", en: "Fill manually" },
] as const;

const UTILITY_VOICE_QUESTIONS = [
  { key: "utility_type", es: "La factura es de luz, gas o ambas?", en: "Is the bill for electricity, gas, or both?" },
  { key: "postcode", es: "Cual es su codigo postal?", en: "What is your postcode?" },
  { key: "monthly_cost", es: "Cuanto paga aproximadamente al mes?", en: "How much do you pay approximately each month?" },
  { key: "consumption_kwh", es: "Sabe cuantos kWh consume? Si no lo sabe, no pasa nada.", en: "Do you know how many kWh you use? If not, that is okay." },
  { key: "power_kw", es: "Sabe que potencia tiene contratada? Si no lo sabe, puedo estimarla.", en: "Do you know your contracted power? If not, I can estimate it." },
] as const;

const EMPTY_UTILITY_FORM = {
  utility_type: "electricity",
  postcode: "",
  monthly_cost: "",
  consumption_kwh: "",
  power_kw: "",
  provider: "",
};

const APPOINTMENT_TYPE_CHIPS = [
  {
    key: "medical",
    es: "Medica",
    en: "Medical",
    promptEs: "Ayudame a programar una cita medica. Usa mi perfil primero, busca opciones cercanas si hace falta, y antes de actuar preparame un resumen para confirmar.",
    promptEn: "Help me schedule a medical appointment. Use my profile first, search nearby options if needed, and prepare a confirmation summary before acting.",
  },
  {
    key: "personal-care",
    es: "Cuidado personal",
    en: "Personal care",
    promptEs: "Ayudame a programar una cita de cuidado personal, como peluqueria, podologia o bienestar. Prioriza cercania, facilidad y WhatsApp si esta disponible.",
    promptEn: "Help me schedule a personal care appointment, such as hair, podiatry, or wellness. Prioritize proximity, ease, and WhatsApp if available.",
  },
  {
    key: "government",
    es: "Tramite oficial",
    en: "Government",
    promptEs: "Ayudame a programar una cita para un tramite oficial. Revisa que documentos podria necesitar y prepara recordatorios.",
    promptEn: "Help me schedule an appointment for an official service. Check what documents may be needed and prepare reminders.",
  },
  {
    key: "home-service",
    es: "Servicio en casa",
    en: "Home service",
    promptEs: "Ayudame a programar un servicio en casa. Usa mi direccion, prioriza proveedores fiables, y confirma precio, hora y forma de contacto.",
    promptEn: "Help me schedule a home service. Use my address, prioritize trusted providers, and confirm price, time, and contact method.",
  },
  {
    key: "social",
    es: "Social o restaurante",
    en: "Social or restaurant",
    promptEs: "Ayudame a programar una reserva social o restaurante. Busca opciones accesibles, cercanas y faciles, y ofrece transporte si conviene.",
    promptEn: "Help me schedule a social booking or restaurant. Find accessible, nearby, easy options and offer transport if useful.",
  },
] as const;

const RECS_CACHE_BASE = "vyva_concierge_recs_v8";
const RECS_DATE_BASE = "vyva_concierge_recs_date_v8";
const CHAT_HISTORY_BASE = "vyva_concierge_chat";
const CHAT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function recsCacheKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${RECS_CACHE_BASE}_${lang}`;
}

function recsDateKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${RECS_DATE_BASE}_${lang}`;
}

function chatHistoryKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${CHAT_HISTORY_BASE}_${lang}`;
}

function getCategoryColors(category: RecommendationCard["category"]) {
  const map: Record<RecommendationCard["category"], { bg: string; border: string }> = {
    deal: { bg: "#FEF3C7", border: "#FCD34D" },
    event: { bg: "#EDE9FE", border: "#C4B5FD" },
    tip: { bg: "#ECFDF5", border: "#6EE7B7" },
    activity: { bg: "#F5F3FF", border: "#DDD6FE" },
  };
  return map[category] ?? map.tip;
}

function effortLabel(effort: RecommendationCard["effort"], isSpanish: boolean) {
  if (effort === "none") return isSpanish ? "Sin esfuerzo" : "No effort";
  if (effort === "low") return isSpanish ? "Suave" : "Gentle";
  if (effort === "medium") return isSpanish ? "Moderado" : "Moderate";
  return "";
}

function buildRecommendationActionPrompt(card: RecommendationCard, isSpanish: boolean) {
  const payload = card.action_payload;
  const needs = payload?.needs?.length ? payload.needs.join(", ") : "";
  const searchTerms = payload?.search_terms?.length ? payload.search_terms.join(", ") : "";
  const signals = card.personal_signals?.length ? card.personal_signals.join(", ") : "";

  if (isSpanish) {
    return [
      `Quiero que me ayudes con esta recomendacion: "${card.title}".`,
      `Tipo de accion: ${card.action_kind || "plan"}.`,
      payload?.flow ? `Flujo: ${payload.flow}.` : "",
      needs ? `Necesito que cubras: ${needs}.` : "",
      searchTerms ? `Si hace falta buscar, usa estos terminos: ${searchTerms}.` : "",
      card.location_hint ? `Contexto local: ${card.location_hint}` : "",
      signals ? `Personalizalo usando estas senales: ${signals}.` : "",
      card.safety_note ? `Ten en cuenta esta nota de cuidado: ${card.safety_note}` : "",
      "Responde como una conversacion natural de movil, sin titulos markdown, sin tablas y sin listas largas.",
      "Empieza con una frase clara de lo que puedes hacer y pide solo el siguiente dato o confirmacion necesaria.",
      "Si requiere llamar, reservar o confirmar algo, prepara primero un resumen claro y pideme confirmacion.",
    ].filter(Boolean).join("\n");
  }

  return [
    `Help me with this recommendation: "${card.title}".`,
    `Action type: ${card.action_kind || "plan"}.`,
    payload?.flow ? `Flow: ${payload.flow}.` : "",
    needs ? `Cover these needs: ${needs}.` : "",
    searchTerms ? `If search is needed, use these terms: ${searchTerms}.` : "",
    card.location_hint ? `Local context: ${card.location_hint}` : "",
    signals ? `Personalise it using these signals: ${signals}.` : "",
    card.safety_note ? `Care note: ${card.safety_note}` : "",
    "Respond like a natural mobile chat, with no markdown headings, no tables, and no long lists.",
    "Start with one clear sentence about what you can do and ask only for the next needed detail or confirmation.",
    "If it requires a call, booking, or confirmation, prepare a clear summary and ask me to confirm first.",
  ].filter(Boolean).join("\n");
}

function buildFallbackPlan(card: RecommendationCard, isSpanish: boolean): RecommendationActionPlan {
  const title = isSpanish ? `Plan para: ${card.title}` : `Plan for: ${card.title}`;
  const caveat = isSpanish
    ? "No he podido comprobar datos en vivo ahora mismo. Antes de salir, confirma horarios, precio y disponibilidad."
    : "I could not check live details right now. Before leaving, confirm hours, price, and availability.";

  return {
    title,
    summary: isSpanish
      ? "No he podido verificar un lugar cercano en vivo para esta tarjeta. Actualiza recomendaciones o pide a VYVA que busque de nuevo."
      : "I could not verify a nearby live place for this card. Refresh recommendations or ask VYVA to search again.",
    price_info: isSpanish
      ? "Sin lugar verificado, no conviene estimar precio."
      : "Without a verified place, it is not useful to estimate price.",
    travel_info: isSpanish
      ? "Actualiza la recomendacion para encontrar una opcion cercana concreta con ruta y mapa."
      : "Refresh the recommendation to find a concrete nearby option with route and map.",
    accessibility_note: card.safety_note || (isSpanish
      ? "Comprobar acceso, asientos, escaleras y distancia antes de ir."
      : "Check access, seating, stairs, and distance before going."),
    next_steps: isSpanish
      ? ["Actualizar recomendaciones", "Buscar una opcion cercana verificada", "Confirmar horario, precio y acceso"]
      : ["Refresh recommendations", "Find a verified nearby option", "Confirm hours, price, and access"],
    caveat,
    share_text: [
      title,
      card.description,
      isSpanish ? "Pendiente: confirmar horario, precio, acceso y ruta." : "Pending: confirm hours, price, access, and route.",
      caveat,
    ].join("\n"),
  };
}

const QUICK_ACTIONS = [
  { key: "bookRide", Icon: Car, color: "#6B21A8", bg: "#F5F3FF" },
  { key: "scheduleAppt", Icon: Calendar, color: "#0F766E", bg: "#F0FDFA" },
  { key: "researchTopic", Icon: Search, color: "#0A7C4E", bg: "#ECFDF5" },
  { key: "findDeals", Icon: Tag, color: "#C9890A", bg: "#FEF3C7" },
] as const;

async function callConcierge(
  prompt: string,
  history: ChatMessage[],
  locale: string
): Promise<string> {
  const res = await fetch("/api/concierge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}

async function fetchRecommendations(locale: string, refresh = false): Promise<RecommendationCard[]> {
  const res = await apiFetch("/api/concierge/recommendations", {
    method: "POST",
    body: JSON.stringify({ locale, refresh }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { recommendations?: RecommendationCard[] };
  return data.recommendations ?? [];
}

async function fetchRecommendationPlan(card: RecommendationCard, locale: string): Promise<RecommendationActionPlan> {
  const res = await apiFetch("/api/concierge/recommendations/plan", {
    method: "POST",
    body: JSON.stringify({ card, locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { plan?: RecommendationActionPlan };
  if (!data.plan) throw new Error("Missing recommendation plan");
  return data.plan;
}

async function sendRecommendationFeedback(
  card: RecommendationCard,
  action: "shown" | "opened" | "liked" | "dismissed" | "completed"
) {
  if (!card.id) return;
  await apiFetch("/api/concierge/recommendations/feedback", {
    method: "POST",
    body: JSON.stringify({
      recommendation_id: card.id,
      action,
      category: card.category,
      title: card.title,
      reasons: card.reason_codes ?? [],
    }),
  });
}

async function fetchPendingActions(): Promise<ConciergePendingItem[]> {
  const res = await apiFetch("/api/concierge/actions/pending");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergePendingItem>;
  return data.items ?? [];
}

async function fetchRecentSessions(): Promise<ConciergeSessionItem[]> {
  const res = await apiFetch("/api/concierge/actions/sessions");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergeSessionItem>;
  return data.items ?? [];
}

async function searchOffers(query: string, locale: string, documentContext?: BillDocumentAnalysis): Promise<OffersSearchResponse> {
  const res = await apiFetch("/api/offers/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      locale,
      document_context: documentContext,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as OffersSearchResponse;
}

function compressBillImage(file: File, targetChars = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas context unavailable"));

      const emergencyMode = targetChars <= 120_000;
      const qualities = emergencyMode
        ? [0.48, 0.4, 0.32, 0.24, 0.16, 0.1]
        : [0.86, 0.78, 0.68, 0.58, 0.48, 0.38];
      const maxSizes = emergencyMode
        ? [620, 520, 420, 340, 260, 200, 160]
        : [1900, 1600, 1300, 1050, 850];
      let best = "";

      for (const maxSize of maxSizes) {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        for (const quality of qualities) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (!best || dataUrl.length < best.length) best = dataUrl;
          if (dataUrl.length <= targetChars) {
            resolve(dataUrl);
            return;
          }
        }
      }

      resolve(best);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No he podido abrir el archivo."));
    reader.readAsDataURL(file);
  });
}

function billReaderEndpoints(): string[] {
  return ["/api/bill-reader/analyze", "/api/offers/analyze-document"];
}

function billReaderError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function analyzeBillDocument(image: string, locale: string): Promise<BillDocumentAnalysis> {
  let lastResponse: Response | null = null;

  for (const endpoint of billReaderEndpoints()) {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ image, locale }),
    }).catch(() => null);

    if (!res) continue;
    lastResponse = res;
    if (res.status === 404) continue;
    if (res.ok) return await res.json() as BillDocumentAnalysis;
    break;
  }

  const res = lastResponse;
  if (!res) {
    throw billReaderError(locale.startsWith("es")
      ? "No he podido conectar con el lector de facturas. Reinicie la app en Replit y pruebe de nuevo."
      : "I could not connect to the bill reader. Restart the app in Replit and try again.");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 404) {
      throw billReaderError(locale.startsWith("es")
        ? "El lector de facturas todavia no esta activo en el servidor. Actualice el codigo y reinicie la app en Replit."
        : "The bill reader is not active on the server yet. Pull the latest code and restart the app in Replit.", res.status);
    }
    if (res.status === 413) {
      const sizeMb = (image.length / 1024 / 1024).toFixed(1);
      throw billReaderError(locale.startsWith("es")
        ? `La imagen no ha podido enviarse al lector (${sizeMb} MB). Voy a intentarlo con una version mas ligera.`
        : `The image could not be sent to the reader (${sizeMb} MB). I will try a lighter version.`, res.status);
    }
    throw billReaderError(data?.error ?? `Request failed: ${res.status}`, res.status);
  }

  return await res.json() as BillDocumentAnalysis;
}

function billAnalysisToUtilityExtracted(analysis: BillDocumentAnalysis): Record<string, unknown> {
  return {
    document_type: analysis.document_type,
    provider_name: analysis.provider_name,
    service_address: analysis.service_address,
    postcode: analysis.postcode,
    cups: analysis.cups,
    tariff_or_plan: analysis.tariff_or_plan,
    billing_period: analysis.billing_period,
    billing_period_days: analysis.billing_period_days,
    total_amount: analysis.total_amount,
    power_kw: analysis.power_kw,
    usage: analysis.usage,
    unit_prices: analysis.unit_prices,
    confidence: analysis.confidence,
    missing_fields: analysis.missing_fields,
  };
}

async function normalizeUtilityReview(params: {
  input_method: UtilityInputMethod;
  locale: string;
  extracted_data?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  voice_answers?: Record<string, unknown>;
}): Promise<{ normalized_input: NormalizedUtilityInput; can_compare: boolean; next_missing_field?: string }> {
  const res = await apiFetch("/api/utilities/normalize", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json();
}

async function compareUtilityReview(params: {
  input_method: UtilityInputMethod;
  locale: string;
  normalized_input: NormalizedUtilityInput;
  extracted_data?: Record<string, unknown>;
}): Promise<UtilityCompareResponse> {
  const res = await apiFetch("/api/utilities/compare", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as UtilityCompareResponse;
}

function billDocumentLabel(type: BillDocumentAnalysis["document_type"], es: boolean): string {
  switch (type) {
    case "electricity_bill":
      return es ? "Factura de luz" : "Electricity bill";
    case "gas_bill":
      return es ? "Factura de gas" : "Gas bill";
    case "internet_phone_bill":
      return es ? "Internet / telefono" : "Internet / phone";
    case "insurance_policy":
      return es ? "Seguro" : "Insurance";
    case "home_service_invoice":
      return es ? "Servicio en casa" : "Home service";
    default:
      return es ? "Documento no identificado" : "Unidentified document";
  }
}

function isCnmcUtilityBillDocument(type: BillDocumentAnalysis["document_type"]): boolean {
  return type === "electricity_bill" || type === "gas_bill";
}

function nonCnmcBillNotice(type: BillDocumentAnalysis["document_type"], es: boolean): string {
  const label = billDocumentLabel(type, es).toLowerCase();
  if (type === "internet_phone_bill") {
    return es
      ? "He detectado una factura de internet o telefono. La comparacion oficial de CNMC solo cubre luz y gas; por ahora puedo preparar una revision orientativa de servicio."
      : "I detected an internet or phone bill. The official CNMC comparison only covers electricity and gas; for now I can prepare an indicative service review.";
  }
  return es
    ? `He detectado ${label}. Esta herramienta compara oficialmente luz y gas; para este documento puedo preparar una revision orientativa.`
    : `I detected ${label}. This tool officially compares electricity and gas; for this document I can prepare an indicative review.`;
}

function shouldOpenUtilitySavingsReview(labelEs: string): boolean {
  return ["Gastos del hogar", "Reducir gastos mensuales", "Optimizar mis facturas"].includes(labelEs);
}

function billConfidenceLabel(confidence: BillDocumentAnalysis["confidence"], es: boolean): string {
  if (confidence === "high") return es ? "alta" : "high";
  if (confidence === "medium") return es ? "media" : "medium";
  return es ? "baja" : "low";
}

function formatBillAmount(amount: number | null, currency: string | null, es: boolean): string {
  if (amount == null) return es ? "No visible" : "Not visible";
  return `${amount.toLocaleString(es ? "es-ES" : "en-GB", { maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

function utilityTypeLabel(type: UtilityType, es: boolean): string {
  if (type === "gas") return es ? "Gas" : "Gas";
  if (type === "dual") return es ? "Luz + gas" : "Electricity + gas";
  return es ? "Luz" : "Electricity";
}

function formatEuro(amount: number | null, es: boolean): string {
  if (amount == null) return es ? "No disponible" : "Not available";
  return `${amount.toLocaleString(es ? "es-ES" : "en-GB", { maximumFractionDigits: 2 })} €`;
}

function fieldValue(value: string | number | boolean | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function hasFieldValue(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function utilityDetailLabel(field: string, es: boolean): string {
  const isEstimated = field.startsWith("estimated:");
  const key = isEstimated ? field.replace("estimated:", "") : field;
  const labels: Record<string, { es: string; en: string }> = {
    postcode: { es: "codigo postal", en: "postcode" },
    power_kw: { es: "potencia", en: "power" },
    consumption_kwh: { es: "consumo", en: "usage" },
    "estimated monthly cost or consumption_kwh": {
      es: "importe mensual o consumo",
      en: "monthly cost or usage",
    },
  };
  const label = labels[key]?.[es ? "es" : "en"] ?? key.replace(/_/g, " ");
  if (!isEstimated) return label;
  return es ? `${label} estimado` : `estimated ${label}`;
}

function billClientMessage(locale: string, key: "unsupported" | "read_failed"): string {
  const lang = locale.split("-")[0].toLowerCase();
  const messages = {
    unsupported: {
      es: "Puedo leer fotos, imagenes o PDF de facturas. Pruebe con uno de esos formatos.",
      de: "Ich kann Fotos, Bilder oder PDF-Rechnungen lesen. Bitte versuchen Sie eines dieser Formate.",
      fr: "Je peux lire des photos, images ou PDF de factures. Essayez l'un de ces formats.",
      it: "Posso leggere foto, immagini o PDF di fatture. Prova con uno di questi formati.",
      pt: "Posso ler fotos, imagens ou PDF de faturas. Tente um desses formatos.",
      en: "I can read bill photos, images, or PDFs. Please try one of those formats.",
    },
    read_failed: {
      es: "No he podido procesar la factura automaticamente. Puede rellenar los datos a mano o intentarlo de nuevo.",
      de: "Ich konnte die Rechnung nicht automatisch verarbeiten. Sie koennen die Daten manuell eingeben oder es erneut versuchen.",
      fr: "Je n'ai pas pu traiter automatiquement la facture. Vous pouvez saisir les donnees manuellement ou reessayer.",
      it: "Non sono riuscita a elaborare automaticamente la fattura. Puoi inserire i dati manualmente o riprovare.",
      pt: "Nao consegui processar automaticamente a fatura. Pode preencher os dados manualmente ou tentar novamente.",
      en: "I could not process the bill automatically. You can enter the details manually or try again.",
    },
  } as const;
  return messages[key][lang as keyof typeof messages[typeof key]] ?? messages[key].en;
}

async function confirmPendingAction(item: ConciergePendingItem) {
  const bookingUrl = getBookingUrl(item);

  if (!item.provider_phone && bookingUrl) {
    window.open(bookingUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const res = await apiFetch(`/api/concierge/actions/${item.id}/confirm`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to confirm concierge action");
  }
}

async function cancelPendingAction(id: string) {
  const res = await apiFetch(`/api/concierge/actions/${id}/cancel`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to cancel concierge action");
  }
}

function getBookingUrl(item: ConciergePendingItem): string {
  return typeof item.action_payload?.booking_url === "string"
    ? item.action_payload.booking_url.trim()
    : "";
}

function statusLabel(status: ConciergePendingItem["status"], locale = "es"): string {
  const es = locale.startsWith("es");
  switch (status) {
    case "pending":
      return es ? "Pendiente de confirmar" : "Awaiting confirmation";
    case "calling":
      return es ? "Llamando ahora" : "Calling now";
    case "completed":
      return es ? "Completado" : "Completed";
    case "failed":
      return es ? "Necesita revision" : "Needs attention";
    case "cancelled":
      return es ? "Cancelado" : "Cancelled";
    default:
      return status;
  }
}

function sessionOutcomeLabel(outcome: string, locale = "es"): string {
  const es = locale.startsWith("es");
  switch (outcome) {
    case "confirmed":
      return es ? "Confirmado" : "Confirmed";
    case "no_answer":
      return es ? "Sin respuesta" : "No answer";
    case "cant_fulfil":
      return es ? "No se pudo completar" : "Could not complete";
    case "user_cancelled":
      return es ? "Cancelado" : "Cancelled";
    case "error":
      return es ? "Problema" : "Problem";
    default:
      return outcome;
  }
}

function useCaseLabel(useCase: string, locale = "es"): string {
  const es = locale.startsWith("es");
  switch (useCase) {
    case "book_ride":
      return es ? "Taxi" : "Ride";
    case "order_medicine":
      return es ? "Medicacion" : "Medicine";
    case "book_appointment":
      return es ? "Cita medica" : "Appointment";
    default:
      return useCase.replace(/_/g, " ");
  }
}

const ConciergeScreen = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.split("-")[0].toLowerCase();
  const isSpanish = locale === "es";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasRestoredHistory, setHasRestoredHistory] = useState(false);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);
  const currentLocaleRef = useRef(i18n.language);
  const saveReadyRef = useRef(false);
  const shownRecIdsRef = useRef<Set<string>>(new Set());
  const billInputRef = useRef<HTMLInputElement>(null);

  const [recs, setRecs] = useState<RecommendationCard[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState<RecommendationCard | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<RecommendationActionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentNote, setAppointmentNote] = useState("");
  const [offersOpen, setOffersOpen] = useState(false);
  const [savingsPanelView, setSavingsPanelView] = useState<SavingsPanelView>("overview");
  const [offersQuery, setOffersQuery] = useState("");
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersResult, setOffersResult] = useState<OffersSearchResponse | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [offersIdeaPage, setOffersIdeaPage] = useState(0);
  const [billAnalysis, setBillAnalysis] = useState<BillDocumentAnalysis | null>(null);
  const [billAnalysisLoading, setBillAnalysisLoading] = useState(false);
  const [billAnalysisError, setBillAnalysisError] = useState<string | null>(null);
  const [utilityMethod, setUtilityMethod] = useState<UtilityInputMethod | null>(null);
  const [utilityForm, setUtilityForm] = useState({ ...EMPTY_UTILITY_FORM });
  const [utilityVoiceAnswers, setUtilityVoiceAnswers] = useState<Record<string, string>>({});
  const [utilityVoiceStep, setUtilityVoiceStep] = useState(0);
  const [utilityVoiceDraft, setUtilityVoiceDraft] = useState("");
  const [utilityNormalized, setUtilityNormalized] = useState<NormalizedUtilityInput | null>(null);
  const [utilityResult, setUtilityResult] = useState<UtilityCompareResponse | null>(null);
  const [utilityLoading, setUtilityLoading] = useState(false);
  const [utilityError, setUtilityError] = useState<string | null>(null);
  const [utilityNotice, setUtilityNotice] = useState<string | null>(null);

  const { data: pendingActions = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/concierge/actions/pending"],
    queryFn: fetchPendingActions,
    refetchInterval: 8000,
  });

  const { data: recentSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/concierge/actions/sessions"],
    queryFn: fetchRecentSessions,
    refetchInterval: 8000,
  });

  const confirmMutation = useMutation({
    mutationFn: confirmPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  useEffect(() => {
    currentLocaleRef.current = i18n.language;
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatHistoryKey(i18n.language));
      if (raw) {
        const stored = JSON.parse(raw) as StoredChatHistory;
        const age = Date.now() - new Date(stored.savedAt).getTime();
        if (Array.isArray(stored.messages) && stored.messages.length > 0 && age < CHAT_MAX_AGE_MS) {
          setMessages(stored.messages);
          setHasRestoredHistory(true);
          return;
        }
        localStorage.removeItem(chatHistoryKey(i18n.language));
      }
    } catch {
      // Ignore corrupt cache.
    }
    setMessages([]);
    setHasRestoredHistory(false);
  }, [i18n.language]);

  useEffect(() => {
    if (!saveReadyRef.current) {
      saveReadyRef.current = true;
      return;
    }
    if (messages.length === 0) return;
    try {
      const stored: StoredChatHistory = { savedAt: new Date().toISOString(), messages };
      localStorage.setItem(chatHistoryKey(currentLocaleRef.current), JSON.stringify(stored));
    } catch {
      // Ignore storage errors.
    }
  }, [messages]);

  useEffect(() => {
    const today = new Date().toDateString();
    const cachedDate = localStorage.getItem(recsDateKey(i18n.language));
    const cachedRecs = localStorage.getItem(recsCacheKey(i18n.language));
    if (cachedDate === today && cachedRecs) {
      try {
        const parsed = JSON.parse(cachedRecs) as RecommendationCard[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecs(parsed);
          return;
        }
      } catch {
        // Fall through to fetch.
      }
    }
    loadRecommendations();
  }, [i18n.language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  useEffect(() => {
    recs.forEach((card) => {
      if (!card.id || shownRecIdsRef.current.has(card.id)) return;
      shownRecIdsRef.current.add(card.id);
      sendRecommendationFeedback(card, "shown").catch(() => undefined);
    });
  }, [recs]);

  useEffect(() => {
    if (!offersOpen) return;
    const interval = window.setInterval(() => {
      setOffersIdeaPage((page) => (page + 1) % Math.max(1, Math.ceil((OFFER_IDEA_CHIPS.length - 3) / 4)));
    }, 4200);
    return () => window.clearInterval(interval);
  }, [offersOpen]);

  async function loadRecommendations(refresh = false) {
    setRecsLoading(true);
    try {
      const cards = await fetchRecommendations(i18n.language, refresh);
      setRecs(cards);
      const today = new Date().toDateString();
      localStorage.setItem(recsDateKey(i18n.language), today);
      localStorage.setItem(recsCacheKey(i18n.language), JSON.stringify(cards));
    } catch {
      // Keep the page calm; recommendations are optional.
    } finally {
      setRecsLoading(false);
    }
  }

  function handleRefreshRecs() {
    localStorage.removeItem(recsDateKey(i18n.language));
    localStorage.removeItem(recsCacheKey(i18n.language));
    shownRecIdsRef.current.clear();
    loadRecommendations(true);
  }

  function handleNewConversation() {
    setMessages([]);
    setHasRestoredHistory(false);
    try {
      localStorage.removeItem(chatHistoryKey(i18n.language));
    } catch {
      // Ignore.
    }
  }

  async function sendMessage(text: string, history: ChatMessage[]) {
    const myReqId = ++reqIdRef.current;
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await callConcierge(text, history, i18n.language);
      if (reqIdRef.current !== myReqId) return;
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      if (reqIdRef.current !== myReqId) return;
      setChatError(t("concierge.errorMsg"));
    } finally {
      if (reqIdRef.current === myReqId) setChatLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    sendMessage(text, nextHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickAction(key: string) {
    if (key === "scheduleAppt") {
      setAppointmentOpen((open) => !open);
      setOffersOpen(false);
      return;
    }
    if (key === "findDeals") {
      setOffersOpen(true);
      setSavingsPanelView("overview");
      setAppointmentOpen(false);
      setOffersError(null);
      if (!offersQuery) {
        setOffersQuery(isSpanish
          ? "reducir gastos mensuales y revisar servicios importantes"
          : "reduce monthly costs and review important services");
      }
      return;
    }
    const prompt = t(`concierge.prompts.${key}`);
    if (!prompt) return;
    setInput(prompt);
  }

  function startAppointmentFlow(chip: (typeof APPOINTMENT_TYPE_CHIPS)[number]) {
    const base = isSpanish ? chip.promptEs : chip.promptEn;
    const note = appointmentNote.trim();
    const message = note
      ? `${base}\n\nDetalle del usuario: ${note}`
      : base;
    const userMsg: ChatMessage = { role: "user", content: message };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setAppointmentOpen(false);
    setAppointmentNote("");
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    sendMessage(message, nextHistory);
  }

  async function handleSearchOffers(nextQuery = offersQuery, documentContext?: BillDocumentAnalysis) {
    const query = nextQuery.trim();
    if (!query || offersLoading) return;
    setOffersLoading(true);
    setOffersError(null);
    try {
      const result = await searchOffers(query, i18n.language, documentContext);
      setOffersResult(result);
    } catch {
      setOffersError(isSpanish
        ? "No he podido comparar opciones verificables ahora mismo."
        : "I could not compare verifiable options right now.");
    } finally {
      setOffersLoading(false);
    }
  }

  function handleOfferChipSearch(query: string) {
    setSavingsPanelView("overview");
    setOffersQuery(query);
    setOffersResult(null);
    setBillAnalysis(null);
    setUtilityResult(null);
    handleSearchOffers(query);
  }

  function openUtilitySavingsReview() {
    setSavingsPanelView("utilities");
    setOffersResult(null);
    setOffersError(null);
  }

  function closeOffersPanel() {
    setOffersOpen(false);
    setSavingsPanelView("overview");
  }

  function resetUtilityReview(method?: UtilityInputMethod) {
    setUtilityMethod(method ?? null);
    setUtilityForm({ ...EMPTY_UTILITY_FORM });
    setUtilityVoiceAnswers({});
    setUtilityVoiceStep(0);
    setUtilityVoiceDraft("");
    setUtilityNormalized(null);
    setUtilityResult(null);
    setUtilityError(null);
    setUtilityNotice(null);
    setBillAnalysis(null);
    setBillAnalysisError(null);
  }

  async function normalizeFromBillAnalysis(analysis: BillDocumentAnalysis, inputMethod: UtilityInputMethod) {
    setUtilityLoading(true);
    setUtilityError(null);
    try {
      const extracted = billAnalysisToUtilityExtracted(analysis);
      const normalized = await normalizeUtilityReview({
        input_method: inputMethod,
        locale: i18n.language,
        extracted_data: extracted,
      });
      setUtilityNormalized(normalized.normalized_input);
      setUtilityMethod(inputMethod);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}. Puede corregirlo abajo.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}. You can correct it below.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setUtilityError(isSpanish
        ? (message || "No he podido preparar los datos de la factura.")
        : (message || "I could not prepare the bill details."));
    } finally {
      setUtilityLoading(false);
    }
  }

  async function handleBillFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!file.type.startsWith("image/") && !isPdf) {
      setBillAnalysisError(billClientMessage(i18n.language, "unsupported"));
      return;
    }
    setBillAnalysisLoading(true);
    setBillAnalysis(null);
    setBillAnalysisError(null);
    setOffersResult(null);
    setUtilityNormalized(null);
    setUtilityResult(null);
    try {
      const documentDataUrl = isPdf ? await readFileAsDataUrl(file) : await compressBillImage(file);
      let analysis: BillDocumentAnalysis;
      try {
        analysis = await analyzeBillDocument(documentDataUrl, i18n.language);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status !== 413 || isPdf) throw err;
        const emergencyDataUrl = await compressBillImage(file, 75_000);
        analysis = await analyzeBillDocument(emergencyDataUrl, i18n.language);
      }
      setBillAnalysis(analysis);
      setOffersQuery(analysis.suggested_query);
      if (!analysis.isFallback && isCnmcUtilityBillDocument(analysis.document_type)) {
        await normalizeFromBillAnalysis(analysis, utilityMethod === "upload" ? "upload" : "photo");
      }
      if (!analysis.isFallback && analysis.document_type !== "unknown" && !isCnmcUtilityBillDocument(analysis.document_type)) {
        setUtilityMethod(utilityMethod === "upload" ? "upload" : "photo");
        setUtilityNotice(nonCnmcBillNotice(analysis.document_type, isSpanish));
      }
      if (!analysis.isFallback && analysis.document_type === "unknown") {
        setBillAnalysisError(analysis.user_summary);
      }
      if (analysis.isFallback) {
        setBillAnalysisError(analysis.user_summary);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setBillAnalysisError(message || billClientMessage(i18n.language, "read_failed"));
    } finally {
      setBillAnalysisLoading(false);
    }
  }

  function handleCompareBillAnalysis() {
    if (!billAnalysis || billAnalysis.document_type === "unknown") return;
    const query = billAnalysis.suggested_query.trim() || (isSpanish
      ? "comparar factura de servicios importantes"
      : "compare important service bill");
    setOffersQuery(query);
    setOffersResult(null);
    handleSearchOffers(query, billAnalysis);
  }

  function updateUtilityNormalizedField(key: keyof NormalizedUtilityInput, value: string) {
    setUtilityError(null);
    setUtilityResult(null);
    setUtilityNormalized((prev) => {
      if (!prev) return prev;
      const numericFields = new Set(["power_kw", "consumption_kwh", "billing_period_days", "total_cost", "confidence"]);
      const nextValue = numericFields.has(key as string)
        ? (value.trim() ? Number(value.replace(",", ".")) : null)
        : value;
      const next = { ...prev, [key]: nextValue } as NormalizedUtilityInput;
      if (value.trim()) {
        next.missing_fields = next.missing_fields.filter((field) => field !== key && field !== `estimated:${key}`);
      }
      return next;
    });
  }

  async function handleNormalizeManualUtility() {
    setUtilityLoading(true);
    setUtilityError(null);
    setUtilityResult(null);
    try {
      const normalized = await normalizeUtilityReview({
        input_method: "manual",
        locale: i18n.language,
        fields: utilityForm,
      });
      setUtilityNormalized(normalized.normalized_input);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}.`);
      }
    } catch {
      setUtilityError(isSpanish ? "No he podido preparar esos datos." : "I could not prepare those details.");
    } finally {
      setUtilityLoading(false);
    }
  }

  async function handleUtilityVoiceNext() {
    const question = UTILITY_VOICE_QUESTIONS[utilityVoiceStep];
    if (!question) return;
    const answer = utilityVoiceDraft.trim();
    if (!answer) return;
    const nextAnswers = { ...utilityVoiceAnswers, [question.key]: answer };
    setUtilityVoiceAnswers(nextAnswers);
    setUtilityVoiceDraft("");
    if (utilityVoiceStep < UTILITY_VOICE_QUESTIONS.length - 1) {
      setUtilityVoiceStep((step) => step + 1);
      return;
    }
    setUtilityLoading(true);
    setUtilityError(null);
    try {
      const normalized = await normalizeUtilityReview({
        input_method: "voice",
        locale: i18n.language,
        voice_answers: nextAnswers,
      });
      setUtilityNormalized(normalized.normalized_input);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}.`);
      }
    } catch {
      setUtilityError(isSpanish ? "No he podido preparar sus respuestas." : "I could not prepare your answers.");
    } finally {
      setUtilityLoading(false);
    }
  }

  function startUtilityVoiceDictation() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUtilityError(isSpanish
        ? "Este navegador no permite dictado aqui. Puede escribir la respuesta en una frase corta."
        : "This browser does not support dictation here. You can type the answer in a short sentence.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = isSpanish ? "es-ES" : i18n.language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setUtilityVoiceDraft(transcript);
    };
    recognition.onerror = () => {
      setUtilityError(isSpanish
        ? "No he podido escuchar bien. Puede intentarlo otra vez o escribir la respuesta."
        : "I could not hear clearly. You can try again or type the answer.");
    };
    recognition.start();
  }

  async function handleCompareUtility() {
    if (!utilityNormalized) return;
    if (!hasFieldValue(utilityNormalized.postcode)) {
      setUtilityError(isSpanish
        ? "Para comparar mejor, escriba su codigo postal."
        : "To compare better, please enter your postcode.");
      return;
    }
    const comparableInput: NormalizedUtilityInput = {
      ...utilityNormalized,
      postcode: String(utilityNormalized.postcode ?? "").trim(),
      missing_fields: utilityNormalized.missing_fields.filter((field) => {
        if (field === "postcode" && String(utilityNormalized.postcode ?? "").trim()) return false;
        if (field === "power_kw" && utilityNormalized.power_kw != null) return false;
        if (field === "estimated:power_kw" && utilityNormalized.power_kw != null) return false;
        if (field === "estimated monthly cost or consumption_kwh"
          && (utilityNormalized.total_cost != null || utilityNormalized.consumption_kwh != null)) return false;
        return true;
      }),
    };
    setUtilityLoading(true);
    setUtilityError(null);
    setUtilityNotice(null);
    setUtilityResult(null);
    try {
      const result = await compareUtilityReview({
        input_method: utilityMethod ?? "manual",
        locale: i18n.language,
        normalized_input: comparableInput,
        extracted_data: billAnalysis ? billAnalysisToUtilityExtracted(billAnalysis) : {},
      });
      setUtilityResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setUtilityError(message || (isSpanish
        ? "No he podido completar la comparacion oficial ahora."
        : "I could not complete the official comparison right now."));
    } finally {
      setUtilityLoading(false);
    }
  }

  function buildUtilityShareText(result: UtilityCompareResponse): string {
    const best = result.results[0];
    const bestUrl = best ? utilityOptionUrl(best, result) : result.source_url ?? "";
    const optionLines = result.results
      .map((option, index) => {
        const optionUrl = utilityOptionUrl(option, result);
        return `${index + 1}. ${option.provider} - ${option.tariff_name}: ${formatEuro(option.estimated_monthly_cost, isSpanish)}/mes${optionUrl ? ` (${optionUrl})` : ""}`;
      })
      .join("\n");
    return [
      isSpanish ? "Resumen de revision de factura VYVA" : "VYVA bill review summary",
      `${isSpanish ? "Coste actual aproximado" : "Approx current cost"}: ${formatEuro(result.summary.current_monthly_cost, isSpanish)}/mes`,
      best ? `${isSpanish ? "Mejor opcion estimada" : "Best estimated option"}: ${best.provider} - ${best.tariff_name}` : "",
      `${isSpanish ? "Coste estimado" : "Estimated cost"}: ${formatEuro(result.summary.best_estimated_monthly_cost, isSpanish)}/mes`,
      `${isSpanish ? "Ahorro estimado" : "Estimated saving"}: ${formatEuro(result.summary.estimated_monthly_savings, isSpanish)}/mes`,
      optionLines ? `${isSpanish ? "Opciones sugeridas" : "Suggested options"}:\n${optionLines}` : "",
      bestUrl ? `${isSpanish ? "Verificar o contratar" : "Verify or contract"}: ${bestUrl}` : "",
      result.estimated_note,
      result.neutrality_note,
    ].filter(Boolean).join("\n");
  }

  function isUsefulUtilityUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (/comparador\.cnmc\.gob\.es$/i.test(parsed.hostname)) {
        return /^\/comparador\/listado\//i.test(parsed.pathname);
      }
      return true;
    } catch {
      return false;
    }
  }

  function isCnmcResultsUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return /comparador\.cnmc\.gob\.es$/i.test(parsed.hostname)
        && /^\/comparador\/listado\//i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function utilityOptionUrl(result: UtilityComparisonResult, parent?: UtilityCompareResponse): string {
    return [
      result.source_url,
      parent?.source_url,
      result.provider_url,
    ]
      .find((url) => isUsefulUtilityUrl(url)) ?? "";
  }

  function utilityOptionActionLabel(result: UtilityComparisonResult, url?: string): string {
    if (isUsefulUtilityUrl(url)) return isSpanish ? "Ver ofertas" : "View offers";
    if (result.source === "CNMC") return isSpanish ? "Ver resultados" : "View results";
    return isSpanish ? "Ver opciones" : "View options";
  }

  async function handleUtilityResultAction(action: "whatsapp" | "save" | "remind" | "switch") {
    if (!utilityResult) return;
    if (action === "whatsapp") {
      const text = encodeURIComponent(buildUtilityShareText(utilityResult));
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "save") {
      setUtilityNotice(isSpanish
        ? "Revision guardada. VYVA la tendra en cuenta para futuras comparaciones."
        : "Review saved. VYVA will use it for future comparisons.");
      return;
    }
    const prompt = action === "remind"
      ? (isSpanish
        ? "Recuerdame revisar esta factura de luz o gas de nuevo el mes que viene."
        : "Remind me to review this electricity or gas bill again next month.")
      : (isSpanish
        ? "Ayudame a cambiar de tarifa paso a paso usando esta comparacion. Primero prepara un resumen y pideme confirmacion."
        : "Help me switch tariff step by step using this comparison. First prepare a summary and ask me to confirm.");
    setInput(prompt);
    closeOffersPanel();
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleOfferAction(option: OfferOption) {
    if (option.phone) {
      setInput(isSpanish
        ? `Ayudame a contactar con ${option.name} para revisar esta opcion y confirmar el siguiente paso.`
        : `Help me contact ${option.name} to review this option and confirm the next step.`);
      closeOffersPanel();
      chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const url = option.website || option.maps_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRecommendationAction(card: RecommendationCard) {
    if (chatLoading) return;
    sendRecommendationFeedback(card, "liked").catch(() => undefined);
    setPlanLoading(true);
    try {
      const plan = await fetchRecommendationPlan(card, i18n.language);
      setSelectedPlan(plan);
      setSelectedRec(null);
    } catch {
      setSelectedPlan(buildFallbackPlan(card, isSpanish));
      setSelectedRec(null);
    } finally {
      setPlanLoading(false);
    }
  }

  function handleOpenRecommendation(card: RecommendationCard) {
    setSelectedRec(card);
    sendRecommendationFeedback(card, "opened").catch(() => undefined);
  }

  function handleRecommendationFeedback(
    card: RecommendationCard,
    action: "liked" | "dismissed" | "completed"
  ) {
    sendRecommendationFeedback(card, action).catch(() => undefined);
    if (action === "dismissed") {
      setRecs((prev) => prev.filter((item) => item !== card));
      setSelectedRec(null);
    }
    if (action === "completed") {
      setSelectedRec(null);
    }
  }

  async function handleSharePlan(plan: RecommendationActionPlan) {
    if (navigator.share) {
      try {
        await navigator.share({ title: plan.title, text: plan.share_text });
        return;
      } catch {
        // Fall back to clipboard.
      }
    }
    await navigator.clipboard?.writeText(plan.share_text).catch(() => undefined);
  }

  const activeAction = pendingActions[0];
  const queuedActionCount = Math.max(0, pendingActions.length - 1);
  const priorityOfferIdeas = OFFER_IDEA_CHIPS.slice(0, 3);
  const visibleOfferIdeas = OFFER_IDEA_CHIPS.slice(3 + offersIdeaPage * 4, 3 + offersIdeaPage * 4 + 4);

  return (
    <div className="vyva-page">
      <VoiceHero
        heroSurface="concierge"
        sourceText={t("concierge.voiceSource")}
        headline={t("concierge.headline")}
        subtitle={t("concierge.subtitle")}
        contextHint="concierge"
      />

      <section className="mt-5" data-testid="section-concierge-active-task">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="vyva-section-title">
            {isSpanish ? "Ahora mismo" : "Right now"}
          </h2>
          {queuedActionCount > 0 && (
            <span className="font-body text-[12px] font-medium text-vyva-text-2">
              +{queuedActionCount} {isSpanish ? "en cola" : "queued"}
            </span>
          )}
        </div>

        {pendingLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">
              {isSpanish ? "Buscando acciones activas..." : "Looking for active actions..."}
            </span>
          </div>
        ) : !activeAction ? (
          <div
            className="vyva-card p-[18px]"
            style={{ boxShadow: "0 10px 30px rgba(107,33,168,0.08)" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-[48px] h-[48px] rounded-[16px] flex items-center justify-center bg-[#F5F3FF]">
                <Sparkles size={22} style={{ color: "#6B21A8" }} />
              </div>
              <div className="flex-1">
                <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                  {isSpanish ? "Sin tareas pendientes" : "No pending tasks"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "Cuando VYVA prepare una llamada, reserva o gestion, aparecera aqui para que la confirmes."
                    : "When VYVA prepares a call, booking, or task, it will appear here for your confirmation."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="vyva-card p-[18px]"
            style={{ boxShadow: "0 14px 38px rgba(107,33,168,0.12)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[12px] uppercase tracking-[0.12em] text-vyva-text-2">
                  {useCaseLabel(activeAction.use_case, locale)}
                </p>
                <p className="mt-1 font-body text-[20px] font-semibold leading-tight text-vyva-text-1">
                  {activeAction.provider_name || (isSpanish ? "Proveedor seleccionado" : "Selected provider")}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[12px] font-medium"
                style={{
                  background: activeAction.status === "calling" ? "#F5F3FF" : "#F3F4F6",
                  color: activeAction.status === "calling" ? "#6B21A8" : "#374151",
                }}
              >
                {statusLabel(activeAction.status, locale)}
              </span>
            </div>

            <p className="mt-4 font-body text-[15px] leading-relaxed text-vyva-text-1">
              {activeAction.action_summary}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeAction.provider_phone && (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[12px] text-vyva-text-1">
                  <PhoneCall size={13} style={{ color: "#6B21A8" }} />
                  {activeAction.provider_phone}
                </span>
              )}
              {!activeAction.provider_phone && getBookingUrl(activeAction) && (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] text-vyva-text-1">
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Reserva online disponible" : "Online booking available"}
                </span>
              )}
            </div>

            {activeAction.status === "pending" && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  data-testid={`button-concierge-confirm-${activeAction.id}`}
                  onClick={() => confirmMutation.mutate(activeAction)}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  className="vyva-primary-action h-auto hover:bg-vyva-purple/90"
                >
                  <PhoneCall size={16} className="mr-2" />
                  {!activeAction.provider_phone && getBookingUrl(activeAction)
                    ? (isSpanish ? "Abrir reserva" : "Open booking")
                    : (isSpanish ? "Confirmar y llamar" : "Confirm and call")}
                </Button>
                <Button
                  data-testid={`button-concierge-cancel-${activeAction.id}`}
                  onClick={() => cancelMutation.mutate(activeAction.id)}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  variant="outline"
                  className="vyva-secondary-action h-auto"
                >
                  {isSpanish ? "Cancelar" : "Cancel"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="vyva-section-title mb-[10px]">
          {t("concierge.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map(({ key, Icon, color, bg }) => (
            <button
              key={key}
              data-testid={`button-concierge-action-${key}`}
              onClick={() => handleQuickAction(key)}
              disabled={chatLoading}
              className="vyva-tap flex min-h-[144px] min-w-0 flex-col items-start justify-between rounded-[28px] border border-vyva-border bg-[#FFFCF8] px-4 py-5 text-left transition-transform active:scale-[0.99] disabled:opacity-50"
              style={{ boxShadow: "0 14px 30px rgba(60,38,20,0.08)" }}
            >
              <div
                className="flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-[20px]"
                style={{ background: bg }}
              >
                <Icon size={25} style={{ color }} />
              </div>
              <span className="font-body text-[20px] font-extrabold leading-[1.08] text-vyva-text-1 [overflow-wrap:anywhere]">
                {t(`concierge.actions.${key}`)}
              </span>
            </button>
          ))}
        </div>

        {appointmentOpen && (
          <div
            className="mt-4 rounded-[26px] border border-[#99F6E4] bg-[#F0FDFA] p-4"
            style={{ boxShadow: "0 12px 32px rgba(15,118,110,0.12)" }}
            data-testid="panel-appointment-assistant"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-white">
                <Calendar size={21} style={{ color: "#0F766E" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                  {isSpanish ? "Programar una cita" : "Schedule an appointment"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "VYVA usa tu perfil primero, propone opciones si hace falta, y no reserva nada sin confirmarlo contigo."
                    : "VYVA uses your profile first, suggests options if needed, and never books without confirming with you."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAppointmentOpen(false)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white font-body text-[15px] text-vyva-text-2"
                aria-label={isSpanish ? "Cerrar" : "Close"}
              >
                x
              </button>
            </div>

            <div className="mt-4 rounded-[20px] bg-white/75 p-3">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0F766E]">
                {isSpanish ? "Que tipo de cita necesitas?" : "What kind of appointment?"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {APPOINTMENT_TYPE_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => startAppointmentFlow(chip)}
                    disabled={chatLoading}
                    className="vyva-tap rounded-[17px] border border-[#99F6E4] bg-white px-3 py-3 text-left font-body text-[14px] font-semibold leading-tight text-vyva-text-1 disabled:opacity-60"
                  >
                    {isSpanish ? chip.es : chip.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-[20px] bg-white/75 p-3">
              <label className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                {isSpanish ? "Detalle opcional" : "Optional detail"}
              </label>
              <Input
                value={appointmentNote}
                onChange={(e) => setAppointmentNote(e.target.value)}
                placeholder={isSpanish ? "Ej. dermatologia, martes por la manana, WhatsApp si se puede" : "E.g. dermatology, Tuesday morning, WhatsApp if possible"}
                className="mt-2 min-h-[50px] rounded-[18px] border-vyva-border bg-white font-body text-[15px]"
              />
            </div>
          </div>
        )}

        {offersOpen && (
          <div
            className="mt-4 rounded-[26px] border border-[#D9C7B6] bg-[#FCF8F1] p-4"
            style={{ boxShadow: "0 14px 34px rgba(76,49,28,0.10)" }}
            data-testid="panel-offers-search"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-white shadow-sm">
                <Tag size={21} style={{ color: "#6B21A8" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                  {isSpanish ? "Ahorra y mejora tus servicios" : "Save and improve your services"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "Comparamos opciones verificables para ayudarle a pagar menos, elegir mejor y gestionar servicios importantes."
                    : "We compare verifiable options to help you pay less, choose better, and manage important services."}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 font-body text-[12px] font-semibold text-vyva-purple">
                  {isSpanish ? "Neutral y sin comisiones." : "Neutral and commission-free."}
                </span>
              </div>
              <button
                type="button"
                onClick={closeOffersPanel}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white font-body text-[15px] text-vyva-text-2"
                aria-label={isSpanish ? "Cerrar" : "Close"}
              >
                x
              </button>
            </div>

            <p className="mt-4 rounded-[18px] border border-vyva-border bg-white/80 p-3 font-body text-[13px] leading-relaxed text-vyva-text-2">
              {isSpanish
                ? "VYVA compara opciones verificables según precio, confianza, facilidad y adecuación a su situación. No promociona servicios ni recibe comisiones."
                : "VYVA compares verifiable options by price, trust, ease, and fit for your situation. It does not promote services or receive commissions."}
            </p>

            {savingsPanelView === "utilities" && (
            <div className="mt-4 rounded-[22px] border border-[#E8DCCF] bg-white p-4">
              <input
                ref={billInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleBillFileSelect}
                data-testid="input-offers-bill-photo"
              />
              <button
                type="button"
                onClick={() => setSavingsPanelView("overview")}
                className="mb-3 inline-flex rounded-full bg-[#FBF8F4] px-3 py-2 font-body text-[12px] font-semibold text-vyva-purple"
              >
                {isSpanish ? "Ahorra y mejora > Reducir gastos mensuales" : "Save and improve > Reduce monthly costs"}
              </button>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF]">
                  <Zap size={20} style={{ color: "#6B21A8" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[16px] font-semibold leading-tight text-vyva-text-1">
                    {isSpanish ? "Revisa tus facturas y servicios" : "Review your bills and services"}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                    {isSpanish
                      ? "Empiece con luz y gas en España. VYVA normaliza los datos y compara opciones oficiales u orientativas."
                      : "Start with electricity and gas in Spain. VYVA normalizes the details and compares official or fallback options."}
                  </p>
                </div>
              </div>

              <p className="mt-4 font-body text-[15px] font-semibold text-vyva-text-1">
                {isSpanish ? "Como quiere revisar su factura?" : "How would you like to review your bill?"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {UTILITY_INPUT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => {
                        resetUtilityReview(method.key);
                        if (method.key === "upload" || method.key === "photo") {
                          window.setTimeout(() => billInputRef.current?.click(), 0);
                        }
                      }}
                      className={`vyva-tap rounded-[17px] border px-3 py-3 text-left ${
                        utilityMethod === method.key ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF7]"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-body text-[14px] font-semibold text-vyva-text-1">
                        <Icon size={16} className="text-vyva-purple" />
                        {isSpanish ? method.es : method.en}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(utilityMethod === "upload" || utilityMethod === "photo") && (
                <div className="mt-3 rounded-[16px] bg-[#F5F3FF] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "La foto o PDF se usa solo para leer la factura. No se guarda."
                    : "The photo or PDF is only used to read the bill. It is not stored."}
                </div>
              )}

              {billAnalysisError && (
                <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] leading-relaxed text-[#9A3412]">
                  {billAnalysisError}
                </p>
              )}

              {billAnalysisLoading && (
                <div className="mt-3 flex items-center gap-2 rounded-[16px] bg-[#FFFCF7] px-3 py-3 font-body text-[13px] text-vyva-text-2">
                  <Loader2 size={16} className="animate-spin text-vyva-purple" />
                  {isSpanish ? "Leyendo factura..." : "Reading bill..."}
                </div>
              )}

              {utilityMethod === "voice" && !utilityNormalized && (
                <div className="mt-4 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Pregunta breve" : "Short question"}
                  </p>
                  <p className="mt-2 font-body text-[16px] font-semibold leading-snug text-vyva-text-1">
                    {isSpanish ? UTILITY_VOICE_QUESTIONS[utilityVoiceStep].es : UTILITY_VOICE_QUESTIONS[utilityVoiceStep].en}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={utilityVoiceDraft}
                      onChange={(e) => setUtilityVoiceDraft(e.target.value)}
                      placeholder={isSpanish ? "Responda aqui..." : "Answer here..."}
                      className="h-[44px] rounded-full border-vyva-border bg-white font-body text-[14px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startUtilityVoiceDictation}
                      className="h-[44px] rounded-full border-vyva-border bg-white px-3"
                      aria-label={isSpanish ? "Dictar respuesta" : "Dictate answer"}
                    >
                      <Mic size={16} />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleUtilityVoiceNext}
                      disabled={!utilityVoiceDraft.trim() || utilityLoading}
                      className="h-[44px] rounded-full bg-vyva-purple px-4 font-body text-[13px]"
                    >
                      {utilityVoiceStep === UTILITY_VOICE_QUESTIONS.length - 1
                        ? (isSpanish ? "Preparar" : "Prepare")
                        : (isSpanish ? "Siguiente" : "Next")}
                    </Button>
                  </div>
                </div>
              )}

              {utilityMethod === "manual" && !utilityNormalized && (
                <div className="mt-4 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Datos sencillos" : "Simple details"}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={utilityForm.utility_type}
                      onChange={(e) => setUtilityForm((prev) => ({ ...prev, utility_type: e.target.value }))}
                      className="h-[46px] rounded-[16px] border border-vyva-border bg-white px-3 font-body text-[14px]"
                    >
                      <option value="electricity">{isSpanish ? "Luz" : "Electricity"}</option>
                      <option value="gas">{isSpanish ? "Gas" : "Gas"}</option>
                      <option value="dual">{isSpanish ? "Luz + gas" : "Electricity + gas"}</option>
                    </select>
                    <Input value={utilityForm.postcode} onChange={(e) => setUtilityForm((prev) => ({ ...prev, postcode: e.target.value }))} placeholder={isSpanish ? "Codigo postal" : "Postcode"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.monthly_cost} onChange={(e) => setUtilityForm((prev) => ({ ...prev, monthly_cost: e.target.value }))} placeholder={isSpanish ? "Importe mensual aprox." : "Approx monthly cost"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.consumption_kwh} onChange={(e) => setUtilityForm((prev) => ({ ...prev, consumption_kwh: e.target.value }))} placeholder={isSpanish ? "Consumo kWh opcional" : "kWh optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.power_kw} onChange={(e) => setUtilityForm((prev) => ({ ...prev, power_kw: e.target.value }))} placeholder={isSpanish ? "Potencia kW opcional" : "Power kW optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.provider} onChange={(e) => setUtilityForm((prev) => ({ ...prev, provider: e.target.value }))} placeholder={isSpanish ? "Compania actual opcional" : "Current provider optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                  </div>
                  <Button type="button" onClick={handleNormalizeManualUtility} disabled={utilityLoading} className="mt-3 h-[42px] rounded-full bg-vyva-purple px-4 font-body text-[13px]">
                    {utilityLoading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
                    {isSpanish ? "Preparar comparacion" : "Prepare comparison"}
                  </Button>
                </div>
              )}

              {utilityNormalized && (
                <div className="mt-3 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  {(() => {
                    const postcodeMissing = !hasFieldValue(utilityNormalized.postcode);
                    const blockingMissingFields = utilityNormalized.missing_fields.filter((field) => !field.startsWith("estimated:"));
                    const shownMissingFields = blockingMissingFields.filter((field) => !(field === "postcode" && !postcodeMissing));
                    const estimatedFields = utilityNormalized.missing_fields.filter((field) => field.startsWith("estimated:"));
                    const detailLabels = [...shownMissingFields, ...estimatedFields].map((field) => utilityDetailLabel(field, isSpanish));
                    const consumptionEstimated = utilityNormalized.missing_fields.includes("estimated:consumption_kwh");
                    const powerEstimated = utilityNormalized.missing_fields.includes("estimated:power_kw");

                    return (
                      <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                        {isSpanish ? "He encontrado estos datos en su factura:" : "I found these details in your bill:"}
                      </p>
                      <p className="mt-1 font-body text-[16px] font-semibold text-vyva-text-1">
                        {utilityTypeLabel(utilityNormalized.utility_type, isSpanish)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 font-body text-[12px] font-semibold ${
                      utilityNormalized.confidence >= 0.75
                        ? "bg-[#ECFDF5] text-[#0A7C4E]"
                        : utilityNormalized.confidence >= 0.45
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#FEE2E2] text-[#B91C1C]"
                    }`}>
                      {isSpanish ? "Confianza" : "Confidence"}: {Math.round(utilityNormalized.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-[14px] bg-white p-3">
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                        {isSpanish ? "Compania" : "Provider"}
                      </p>
                      <Input value={utilityNormalized.provider} onChange={(e) => updateUtilityNormalizedField("provider", e.target.value)} placeholder={isSpanish ? "No visible" : "Not visible"} className="mt-1 h-[38px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]" />
                    </div>
                    <div className={`rounded-[14px] p-3 ${postcodeMissing ? "border border-[#FDBA74] bg-[#FFF7ED]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                      <p className={`font-body text-[11px] font-semibold uppercase tracking-[0.10em] ${postcodeMissing ? "text-[#9A3412]" : "text-vyva-text-2"}`}>
                        {isSpanish ? "Codigo postal" : "Postcode"}
                      </p>
                      {postcodeMissing && (
                        <span className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C2410C]">
                          {isSpanish ? "Necesario" : "Required"}
                        </span>
                      )}
                      </div>
                      <Input
                        value={utilityNormalized.postcode}
                        onChange={(e) => updateUtilityNormalizedField("postcode", e.target.value)}
                        placeholder={isSpanish ? "Escriba su codigo postal" : "Enter postcode"}
                        className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${postcodeMissing ? "border-[#FB923C] focus-visible:ring-[#FB923C]" : "border-vyva-border"}`}
                      />
                      {postcodeMissing && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#9A3412]">
                          {isSpanish
                            ? "No aparece de forma fiable en la factura. Escríbalo para comparar opciones de su zona."
                            : "It was not found reliably on the bill. Enter it to compare options in your area."}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-[14px] p-3 ${consumptionEstimated ? "border border-[#FDE68A] bg-[#FFFBEB]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                          {isSpanish ? "Consumo" : "Usage"}
                        </p>
                        {consumptionEstimated && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92400E]">
                            {isSpanish ? "Estimado" : "Estimated"}
                          </span>
                        )}
                      </div>
                      <Input value={fieldValue(utilityNormalized.consumption_kwh, "")} onChange={(e) => updateUtilityNormalizedField("consumption_kwh", e.target.value)} placeholder="kWh" className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${consumptionEstimated ? "border-[#FBBF24] focus-visible:ring-[#FBBF24]" : "border-vyva-border"}`} />
                      {consumptionEstimated && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#92400E]">
                          {isSpanish
                            ? "VYVA lo ha estimado desde el importe. Corrijalo si ve el kWh exacto en la factura."
                            : "VYVA estimated this from the amount. Correct it if you see the exact kWh on the bill."}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-[14px] p-3 ${powerEstimated ? "border border-[#FDE68A] bg-[#FFFBEB]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                          {isSpanish ? "Potencia contratada" : "Contracted power"}
                        </p>
                        {powerEstimated && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92400E]">
                            {isSpanish ? "Estimado" : "Estimated"}
                          </span>
                        )}
                      </div>
                      <Input value={fieldValue(utilityNormalized.power_kw, "")} onChange={(e) => updateUtilityNormalizedField("power_kw", e.target.value)} placeholder="kW" className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${powerEstimated ? "border-[#FBBF24] focus-visible:ring-[#FBBF24]" : "border-vyva-border"}`} />
                      {powerEstimated && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#92400E]">
                          {isSpanish
                            ? "Estimacion segura para comparar. Puede cambiarla si aparece en la factura."
                            : "Safe estimate for comparison. You can change it if it appears on the bill."}
                        </p>
                      )}
                    </div>
                    <div className="rounded-[14px] bg-white p-3 sm:col-span-2">
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                        {isSpanish ? "Importe total / mensual" : "Total / monthly amount"}
                      </p>
                      <Input value={fieldValue(utilityNormalized.total_cost, "")} onChange={(e) => updateUtilityNormalizedField("total_cost", e.target.value)} placeholder="€" className="mt-1 h-[38px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]" />
                    </div>
                  </div>

                  {detailLabels.length > 0 && (
                    <p className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                      {isSpanish ? "Datos pendientes o estimados: " : "Pending or estimated details: "}
                      {detailLabels.join(", ")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      data-testid="button-utilities-compare"
                      onClick={handleCompareUtility}
                      disabled={utilityLoading}
                      className="h-[42px] rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90 disabled:opacity-50"
                    >
                      {utilityLoading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
                      {isSpanish ? "Comparar opciones" : "Compare options"}
                    </Button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {utilityError && (
                <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] leading-relaxed text-[#9A3412]">
                  {utilityError}
                </p>
              )}
              {utilityNotice && (
                <p className="mt-3 rounded-[16px] bg-[#F0FDF4] px-3 py-2 font-body text-[13px] leading-relaxed text-[#166534]">
                  {utilityNotice}
                </p>
              )}

              {utilityResult && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[18px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                    <p className="font-body text-[18px] font-semibold text-vyva-text-1">
                      {utilityResult.summary.headline}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {isSpanish ? "Actualmente paga aproximadamente " : "You currently pay approximately "}
                      <strong>{formatEuro(utilityResult.summary.current_monthly_cost, isSpanish)}</strong>.
                      {" "}
                      {isSpanish ? "La mejor opcion encontrada estima " : "The best option found estimates "}
                      <strong>{formatEuro(utilityResult.summary.best_estimated_monthly_cost, isSpanish)}</strong>.
                      {" "}
                      {isSpanish ? "Ahorro estimado: " : "Estimated saving: "}
                      <strong>{formatEuro(utilityResult.summary.estimated_monthly_savings, isSpanish)}</strong>.
                    </p>
                  </div>

                  {utilityResult.results.map((result, index) => {
                    const optionUrl = utilityOptionUrl(result, utilityResult);
                    return (
                    <div key={`${result.provider}-${result.tariff_name}-${index}`} className="rounded-[20px] border border-vyva-border bg-white p-4">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                        {index === 0 ? (isSpanish ? "Opcion recomendada" : "Recommended option") : index === 1 ? (isSpanish ? "Mas economica" : "Cheapest") : (isSpanish ? "Mas estable / sencilla" : "Most stable / simple")}
                      </p>
                      <p className="mt-1 font-body text-[17px] font-semibold text-vyva-text-1">{result.provider}</p>
                      <p className="font-body text-[13px] text-vyva-text-2">{result.tariff_name}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[14px] bg-[#F5F3FF] p-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.10em] text-vyva-text-2">{isSpanish ? "Coste estimado" : "Estimated cost"}</p>
                          <p className="font-body text-[15px] font-semibold text-vyva-text-1">{formatEuro(result.estimated_monthly_cost, isSpanish)}/mes</p>
                        </div>
                        <div className="rounded-[14px] bg-[#ECFDF5] p-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.10em] text-vyva-text-2">{isSpanish ? "Ahorro" : "Saving"}</p>
                          <p className="font-body text-[15px] font-semibold text-[#0A7C4E]">{formatEuro(result.estimated_monthly_savings, isSpanish)}/mes</p>
                        </div>
                      </div>
                      {optionUrl && (
                        <a
                          href={optionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-vyva-purple/20 bg-[#F5F3FF] px-4 py-2 font-body text-[13px] font-semibold text-vyva-purple"
                        >
                          <ExternalLink size={15} />
                          {utilityOptionActionLabel(result, optionUrl)}
                        </a>
                      )}
                    </div>
                  );
                  })}

                  <div className="rounded-[18px] border border-vyva-border bg-white p-3">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Como lo he calculado" : "How I calculated it"}
                    </p>
                    <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">{utilityResult.calculation_note}</p>
                    {utilityResult.estimated_note && <p className="mt-2 font-body text-[12px] leading-relaxed text-[#92400E]">{utilityResult.estimated_note}</p>}
                    <p className="mt-2 font-body text-[12px] leading-relaxed text-vyva-text-2">{utilityResult.neutrality_note}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { key: "whatsapp", es: "Enviar resumen por WhatsApp", en: "Send summary by WhatsApp" },
                      { key: "save", es: "Guardar revision", en: "Save review" },
                      { key: "remind", es: "Recordarme revisar de nuevo", en: "Remind me to review again" },
                      { key: "switch", es: "Ayudarme a cambiar", en: "Help me switch" },
                    ].map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => handleUtilityResultAction(action.key as "whatsapp" | "save" | "remind" | "switch")}
                        className="vyva-tap rounded-[16px] border border-vyva-border bg-white px-3 py-3 text-left font-body text-[13px] font-semibold text-vyva-text-1"
                      >
                        {isSpanish ? action.es : action.en}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {savingsPanelView === "overview" && (
              <>
            <div className="mt-4 rounded-[22px] bg-white/85 p-3">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                {isSpanish ? "Puede mejorar esto ahora" : "You can improve this now"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {priorityOfferIdeas.map((idea) => {
                  const label = isSpanish ? idea.es : idea.en;
                  const query = isSpanish ? idea.queryEs : idea.queryEn;
                  const opensUtilityReview = shouldOpenUtilitySavingsReview(idea.es);
                  return (
                    <button
                      key={idea.es}
                      type="button"
                      onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                      className="vyva-tap rounded-[18px] border border-[#E8DCCF] bg-[#FFFCF7] px-4 py-3 text-left font-body text-[15px] font-semibold leading-tight text-vyva-text-1"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-[22px] bg-white/85 p-3">
              <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                {isSpanish ? "Categorias importantes" : "Important categories"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {OFFER_CATEGORY_CHIPS.map((chip) => {
                  const label = isSpanish ? chip.es : chip.en;
                  const detail = isSpanish ? chip.detailEs : chip.detailEn;
                  const query = isSpanish ? chip.queryEs : chip.queryEn;
                  const opensUtilityReview = shouldOpenUtilitySavingsReview(chip.es);
                  return (
                    <button
                      key={chip.es}
                      type="button"
                      onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                      className="vyva-tap rounded-[18px] border border-vyva-border bg-white px-4 py-3 text-left"
                    >
                      <span className="block font-body text-[15px] font-semibold leading-tight text-vyva-text-1">
                        {label}
                      </span>
                      <span className="mt-1 block font-body text-[12px] leading-relaxed text-vyva-text-2">
                        {detail}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-[22px] bg-white/85 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                  {isSpanish ? "Recomendado para usted" : "Recommended for you"}
                </p>
                <span className="font-body text-[11px] text-vyva-text-2">
                  {isSpanish ? "Según perfil y contexto" : "Based on profile and context"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleOfferIdeas.map((idea) => {
                  const label = isSpanish ? idea.es : idea.en;
                  const query = isSpanish ? idea.queryEs : idea.queryEn;
                  const opensUtilityReview = shouldOpenUtilitySavingsReview(idea.es);
                  return (
                    <button
                      key={idea.es}
                      type="button"
                      onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                      className="vyva-tap rounded-[16px] border border-vyva-border bg-white px-3 py-3 text-left font-body text-[13px] font-semibold leading-tight text-vyva-text-1"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                data-testid="input-offers-query"
                value={offersQuery}
                onChange={(event) => setOffersQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearchOffers();
                  }
                }}
                placeholder={isSpanish ? "Ej: revisar mi seguro, reducir la luz..." : "E.g. review my insurance, lower electricity..."}
                className="h-[46px] flex-1 rounded-full border-[#D9C7B6] bg-white font-body text-[14px]"
              />
              <Button
                data-testid="button-offers-search"
                onClick={() => handleSearchOffers()}
                disabled={offersLoading || !offersQuery.trim()}
                className="h-[46px] rounded-full bg-vyva-purple px-4 font-body text-[14px] hover:bg-vyva-purple/90"
              >
                {offersLoading ? <Loader2 size={16} className="animate-spin text-white" /> : (isSpanish ? "Buscar" : "Search")}
              </Button>
            </div>

            {offersError && (
              <p className="mt-3 rounded-[16px] bg-white px-3 py-2 font-body text-[13px] text-[#B91C1C]">
                {offersError}
              </p>
            )}

            {offersResult && (
              <div className="mt-4 space-y-3">
                <div className="rounded-[18px] bg-white p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#C9890A]">
                    {offersResult.category}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                    {offersResult.decision_explanation}
                  </p>
                </div>

                {offersResult.options.length === 0 ? (
                  <div className="rounded-[18px] bg-white p-4">
                    <p className="font-body text-[14px] leading-relaxed text-vyva-text-1">
                      {offersResult.no_results_message || (isSpanish
                        ? "No hay suficientes opciones verificables ahora mismo."
                        : "There are not enough verifiable options right now.")}
                    </p>
                  </div>
                ) : (
                  offersResult.options.map((option) => (
                    <div key={`${option.label}-${option.name}`} className="rounded-[20px] border border-vyva-border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                            {option.label}
                          </p>
                          <p className="mt-1 font-body text-[17px] font-semibold leading-tight text-vyva-text-1">
                            {option.name}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[12px] font-semibold text-[#0A7C4E]">
                          {option.score}/100
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <p className="font-body text-[13px] leading-relaxed text-vyva-text-1">{option.what_it_offers}</p>
                        <p className="rounded-[14px] bg-[#F5F3FF] p-3 font-body text-[13px] leading-relaxed text-vyva-text-1">
                          {option.price_or_advantage}
                        </p>
                        <p className="font-body text-[13px] leading-relaxed text-vyva-text-2">{option.why_good_option}</p>
                        <p className="font-body text-[13px] leading-relaxed text-vyva-text-2">{option.distance_or_availability}</p>
                        <p className="font-body text-[12px] leading-relaxed text-vyva-text-2">{option.trust_note}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => handleOfferAction(option)}
                          className="h-[40px] rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90"
                        >
                          {option.phone ? (isSpanish ? "Contactar proveedor" : "Contact provider") : option.website || option.maps_url ? (isSpanish ? "Revisar ahora" : "Review now") : (isSpanish ? "Ver contacto" : "View contact")}
                        </Button>
                        <span className="inline-flex items-center rounded-full bg-[#FBF8F4] px-3 py-2 font-body text-[12px] text-vyva-text-2">
                          {option.contact_method}
                        </span>
                      </div>
                    </div>
                  ))
                )}

                <div className="rounded-[18px] border border-vyva-border bg-white p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                    {isSpanish ? "Neutralidad" : "Neutrality"}
                  </p>
                  <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">
                    {offersResult.neutrality_note}
                  </p>
                  <p className="mt-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                    {offersResult.next_step}
                  </p>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="vyva-section-title mb-[10px]">
          {isSpanish ? "Herramientas de ayuda" : "Help tools"}
        </h2>
        <div className="space-y-3">
          <div
            className="flex items-center gap-4 rounded-[20px] border border-vyva-border bg-white p-[16px_18px]"
            style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
            data-testid="banner-concierge-intro"
          >
            <div
              className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#F5F3FF" }}
            >
              <Sparkles size={22} style={{ color: "#6B21A8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("concierge.activityTile")}</p>
              <p className="font-body text-[13px] text-vyva-text-2 truncate">{t("concierge.activityTileSubtitle")}</p>
            </div>
          </div>

          <button
            data-testid="button-safe-home-teaser"
            onClick={() => navigate("/activity")}
            className="w-full flex items-center gap-4 rounded-[20px] border border-vyva-border bg-white p-[16px_18px] text-left"
            style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
          >
            <div
              className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#ECFDF5" }}
            >
              <Home size={22} style={{ color: "#0A7C4E" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("safeHome.activityTile")}</p>
              <p className="font-body text-[13px] text-vyva-text-2 truncate">{t("safeHome.activityTileSubtitle")}</p>
            </div>
            <span className="font-body text-[18px] font-medium" style={{ color: "#6B21A8" }}>›</span>
          </button>

          <button
            data-testid="button-scam-guard-teaser"
            onClick={() => navigate("/scam-guard")}
            className="w-full flex items-center gap-4 rounded-[20px] border border-vyva-border bg-white p-[16px_18px] text-left"
            style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
          >
            <div
              className="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#EDE9FE" }}
            >
              <ShieldCheck size={22} style={{ color: "#6B21A8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("scamGuard.activityTile")}</p>
              <p className="font-body text-[13px] text-vyva-text-2 truncate">{t("scamGuard.activityTileSubtitle")}</p>
            </div>
            <span className="font-body text-[18px] font-medium" style={{ color: "#6B21A8" }}>›</span>
          </button>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="vyva-section-title">
            {t("concierge.forYouToday")}
          </h2>
          <button
            data-testid="button-concierge-refresh-recs"
            onClick={handleRefreshRecs}
            disabled={recsLoading}
            className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-40"
            style={{ color: "#6B21A8" }}
          >
            <RefreshCw size={13} className={recsLoading ? "animate-spin" : ""} />
            {t("concierge.refreshRecs")}
          </button>
        </div>

        {recsLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">
              {t("concierge.loadingRecs")}
            </span>
          </div>
        ) : recs.length === 0 ? (
          <div className="rounded-[20px] border border-vyva-border bg-white p-[16px]">
            <p className="font-body text-[13px] text-vyva-text-2">
              {t("concierge.noRecs")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recs.slice(0, 3).map((card, i) => {
              const colors = getCategoryColors(card.category);
              return (
                <button
                  key={i}
                  data-testid={`card-concierge-rec-${i}`}
                  onClick={() => handleOpenRecommendation(card)}
                  className="w-full rounded-[20px] border bg-white p-[16px] text-left transition-transform active:scale-[0.99]"
                  style={{
                    borderColor: colors.border,
                    boxShadow: "0 2px 12px rgba(107,33,168,0.07)",
                  }}
                >
                  <div className="flex gap-4">
                    <div
                      className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[16px] text-[24px]"
                      style={{ background: colors.bg }}
                    >
                      {card.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[15px] font-semibold text-vyva-text-1 leading-tight">
                        {card.title}
                      </p>
                      <p className="mt-1 font-body text-[13px] text-vyva-text-2 leading-relaxed">
                        {card.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {card.best_time && (
                          <span className="rounded-full bg-[#F5F1EC] px-2 py-1 font-body text-[11px] font-semibold text-vyva-text-2">
                            {card.best_time}
                          </span>
                        )}
                        {card.effort && (
                          <span className="rounded-full bg-[#F5F3FF] px-2 py-1 font-body text-[11px] font-semibold text-[#6B21A8]">
                            {effortLabel(card.effort, isSpanish)}
                          </span>
                        )}
                        {card.freshness && (
                          <span className="rounded-full bg-[#ECFDF5] px-2 py-1 font-body text-[11px] font-semibold text-[#0A7C4E]">
                            {card.freshness}
                          </span>
                        )}
                      </div>
                      {card.personal_signals && card.personal_signals.length > 0 && (
                        <p className="mt-2 font-body text-[12px] text-vyva-text-2 leading-relaxed">
                          {isSpanish ? "Basado en " : "Based on "}
                          {card.personal_signals.slice(0, 2).join(" + ")}
                        </p>
                      )}
                      <p className="mt-2 font-body text-[12px] font-semibold" style={{ color: "#6B21A8" }}>
                        {isSpanish ? "Ver guia" : "View guide"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedRec && (
          <div
            className="fixed inset-0 z-[1000] flex items-end bg-black/35 px-[10px] sm:items-center sm:justify-center sm:px-4"
            style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))", paddingTop: 16 }}
            role="dialog"
            aria-modal="true"
            data-testid="dialog-concierge-rec-detail"
            onClick={() => setSelectedRec(null)}
          >
            <div
              className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-vyva-border bg-white"
              style={{
                boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
                maxHeight: "calc(100dvh - 128px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[inherit] overflow-y-auto p-[18px] pb-0">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E7DDD4]" />

                <div className="flex items-start gap-3">
                  <div
                    className="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-[17px] text-[24px]"
                    style={{ background: getCategoryColors(selectedRec.category).bg }}
                  >
                    {selectedRec.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                      {selectedRec.title}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {selectedRec.why || selectedRec.description}
                    </p>
                  </div>
                  <button
                    data-testid="button-close-rec-detail"
                    onClick={() => setSelectedRec(null)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F5F1EC] font-body text-[16px] text-vyva-text-2"
                    aria-label={isSpanish ? "Cerrar" : "Close"}
                  >
                    x
                  </button>
                </div>

                {(selectedRec.best_time || selectedRec.effort || selectedRec.freshness) && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {selectedRec.best_time && (
                      <div className="rounded-[16px] bg-[#FBF8F4] p-3">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-vyva-text-2">
                          {isSpanish ? "Momento" : "Timing"}
                        </p>
                        <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-1">
                          {selectedRec.best_time}
                        </p>
                      </div>
                    )}
                    {selectedRec.effort && (
                      <div className="rounded-[16px] bg-[#F5F3FF] p-3">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6B21A8]">
                          {isSpanish ? "Esfuerzo" : "Effort"}
                        </p>
                        <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-1">
                          {effortLabel(selectedRec.effort, isSpanish)}
                        </p>
                      </div>
                    )}
                    {selectedRec.freshness && (
                      <div className="rounded-[16px] bg-[#ECFDF5] p-3">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0A7C4E]">
                          {isSpanish ? "Hoy" : "Today"}
                        </p>
                        <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-1">
                          {selectedRec.freshness}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRec.personal_signals && selectedRec.personal_signals.length > 0 && (
                  <div className="mt-4 rounded-[18px] border border-vyva-border bg-white p-3">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Por que aparece" : "Why this appears"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedRec.personal_signals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full bg-[#F5F1EC] px-3 py-1.5 font-body text-[12px] font-semibold text-vyva-text-2"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                    {selectedRec.location_hint && (
                      <p className="mt-3 font-body text-[13px] leading-relaxed text-vyva-text-2">
                        {selectedRec.location_hint}
                      </p>
                    )}
                  </div>
                )}

                {selectedRec.details && (
                  <p className="mt-5 font-body text-[14px] leading-relaxed text-vyva-text-1">
                    {selectedRec.details}
                  </p>
                )}

                {selectedRec.steps && selectedRec.steps.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Como disfrutarlo" : "How to enjoy it"}
                    </p>
                    {selectedRec.steps.map((step, index) => (
                      <div key={`${step}-${index}`} className="flex gap-3 rounded-[16px] bg-[#FBF8F4] p-3">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[12px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <p className="font-body text-[13px] leading-relaxed text-vyva-text-1">{step}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRec.safety_note && (
                  <div className="mt-4 rounded-[16px] border border-[#FCD34D] bg-[#FFFBEB] p-3">
                    <p className="font-body text-[12px] font-semibold text-[#92400E]">
                      {isSpanish ? "Nota de cuidado" : "Care note"}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-[#78350F]">
                      {selectedRec.safety_note}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    data-testid="button-rec-like"
                    onClick={() => handleRecommendationFeedback(selectedRec, "liked")}
                    className="rounded-full bg-[#F5F3FF] px-2 py-2 font-body text-[12px] font-semibold"
                    style={{ color: "#6B21A8" }}
                  >
                    {isSpanish ? "Me interesa" : "Interested"}
                  </button>
                  <button
                    data-testid="button-rec-done"
                    onClick={() => handleRecommendationFeedback(selectedRec, "completed")}
                    className="rounded-full bg-[#ECFDF5] px-2 py-2 font-body text-[12px] font-semibold"
                    style={{ color: "#0A7C4E" }}
                  >
                    {isSpanish ? "Hecho" : "Done"}
                  </button>
                  <button
                    data-testid="button-rec-not-for-me"
                    onClick={() => handleRecommendationFeedback(selectedRec, "dismissed")}
                    className="rounded-full bg-[#F5F1EC] px-2 py-2 font-body text-[12px] font-semibold text-vyva-text-2"
                  >
                    {isSpanish ? "No es para mi" : "Not for me"}
                  </button>
                </div>

                <div className="sticky bottom-0 -mx-[18px] mt-5 flex gap-2 border-t border-vyva-border bg-white p-[14px_18px]">
                  <Button
                    data-testid="button-rec-action"
                    onClick={() => handleRecommendationAction(selectedRec)}
                    disabled={planLoading}
                    className="h-[46px] flex-1 rounded-full bg-vyva-purple font-body text-[14px] hover:bg-vyva-purple/90"
                  >
                    {planLoading ? (
                      <Loader2 size={16} className="animate-spin text-white" />
                    ) : (
                      selectedRec.action_label || (isSpanish ? "Ayudame" : "Help me")
                    )}
                  </Button>
                  <Button
                    data-testid="button-rec-dismiss"
                    onClick={() => setSelectedRec(null)}
                    variant="outline"
                    className="h-[46px] rounded-full px-5 font-body text-[14px]"
                  >
                    {isSpanish ? "Cerrar" : "Close"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedPlan && (
          <div
            className="fixed inset-0 z-[1000] flex items-end bg-black/35 px-[10px] sm:items-center sm:justify-center sm:px-4"
            style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))", paddingTop: 16 }}
            role="dialog"
            aria-modal="true"
            data-testid="dialog-concierge-rec-plan"
            onClick={() => setSelectedPlan(null)}
          >
            <div
              className="w-full max-w-[600px] overflow-hidden rounded-[28px] border border-vyva-border bg-white"
              style={{ boxShadow: "0 18px 50px rgba(0,0,0,0.22)", maxHeight: "calc(100dvh - 128px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[inherit] overflow-y-auto p-[18px] pb-0">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E7DDD4]" />
                <div className="flex items-start gap-3">
                  <div className="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F5F3FF]">
                    <Sparkles size={22} className="text-vyva-purple" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                      {selectedPlan.title}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {selectedPlan.summary}
                    </p>
                  </div>
                  <button
                    data-testid="button-close-rec-plan"
                    onClick={() => setSelectedPlan(null)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F5F1EC] font-body text-[16px] text-vyva-text-2"
                    aria-label={isSpanish ? "Cerrar" : "Close"}
                  >
                    x
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {(selectedPlan.place_name || selectedPlan.address) && (
                    <div className="rounded-[18px] border border-vyva-border bg-[#FBF8F4] p-4">
                      <div className="flex items-start gap-3">
                        <MapPin size={18} className="mt-0.5 flex-shrink-0 text-vyva-purple" />
                        <div>
                          {selectedPlan.place_name && (
                            <p className="font-body text-[15px] font-semibold text-vyva-text-1">{selectedPlan.place_name}</p>
                          )}
                          {selectedPlan.address && (
                            <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">{selectedPlan.address}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] bg-[#F5F3FF] p-4">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6B21A8]">
                        {isSpanish ? "Precio" : "Price"}
                      </p>
                      <p className="mt-2 font-body text-[13px] leading-relaxed text-vyva-text-1">{selectedPlan.price_info}</p>
                    </div>
                    <div className="rounded-[18px] bg-[#ECFDF5] p-4">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                        {isSpanish ? "Como llegar" : "How to get there"}
                      </p>
                      <p className="mt-2 font-body text-[13px] leading-relaxed text-vyva-text-1">{selectedPlan.travel_info}</p>
                    </div>
                  </div>

                  {selectedPlan.opening_hours && selectedPlan.opening_hours.length > 0 && (
                    <div className="rounded-[18px] border border-vyva-border bg-white p-4">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-vyva-purple" />
                        <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                          {isSpanish ? "Horarios" : "Opening hours"}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1">
                        {selectedPlan.opening_hours.slice(0, 4).map((hour) => (
                          <p key={hour} className="font-body text-[13px] leading-relaxed text-vyva-text-1">{hour}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-[18px] border border-vyva-border bg-white p-4">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Accesibilidad" : "Accessibility"}
                    </p>
                    <p className="mt-2 font-body text-[13px] leading-relaxed text-vyva-text-1">{selectedPlan.accessibility_note}</p>
                  </div>

                  <div className="rounded-[18px] border border-vyva-border bg-white p-4">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Siguientes pasos" : "Next steps"}
                    </p>
                    <div className="mt-3 space-y-2">
                      {selectedPlan.next_steps.map((step, index) => (
                        <div key={`${step}-${index}`} className="flex gap-3">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[12px] font-semibold text-white">
                            {index + 1}
                          </span>
                          <p className="font-body text-[13px] leading-relaxed text-vyva-text-1">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="font-body text-[12px] leading-relaxed text-vyva-text-2">{selectedPlan.caveat}</p>
                </div>

                <div className="sticky bottom-0 -mx-[18px] mt-5 grid grid-cols-2 gap-2 border-t border-vyva-border bg-white p-[14px_18px]">
                  <Button
                    data-testid="button-rec-plan-share"
                    onClick={() => handleSharePlan(selectedPlan)}
                    className="h-[46px] rounded-full bg-vyva-purple font-body text-[14px] hover:bg-vyva-purple/90"
                  >
                    <Share2 size={15} className="mr-2" />
                    {isSpanish ? "Compartir" : "Share"}
                  </Button>
                  {(selectedPlan.maps_url || selectedPlan.website) && (
                    <Button
                      data-testid="button-rec-plan-open"
                      onClick={() => window.open(selectedPlan.maps_url || selectedPlan.website, "_blank", "noopener,noreferrer")}
                      variant="outline"
                      className="h-[46px] rounded-full font-body text-[14px]"
                    >
                      <ExternalLink size={15} className="mr-2" />
                      {selectedPlan.maps_url ? (isSpanish ? "Abrir mapa" : "Open map") : (isSpanish ? "Abrir web" : "Open site")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
            {isSpanish ? "Resultados recientes" : "Recent concierge results"}
          </h2>
        </div>

        {sessionsLoading ? (
          <div className="rounded-[20px] border border-vyva-border bg-white p-[16px]">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-vyva-purple" />
              <span className="font-body text-[13px] text-vyva-text-2">
                {isSpanish ? "Cargando resultados..." : "Loading recent results..."}
              </span>
            </div>
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="rounded-[20px] border border-vyva-border bg-white p-[16px]">
            <p className="font-body text-[13px] leading-relaxed text-vyva-text-2">
              {isSpanish
                ? "Cuando una llamada o reserva termine, el resultado aparecera aqui en una tarjeta simple."
                : "When a call or booking finishes, the result will appear here in a simple card."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.slice(0, 4).map((item) => {
              const success = item.outcome === "confirmed";
              return (
                <div
                  key={item.id}
                  className="rounded-[18px] border border-vyva-border bg-white p-[16px]"
                  style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-[12px] uppercase tracking-wide text-vyva-text-2">
                        {useCaseLabel(item.use_case, locale)}
                      </p>
                      <p className="font-body text-[16px] font-semibold text-vyva-text-1">
                        {item.provider_name || (isSpanish ? "Proveedor" : "Provider")}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium"
                      style={{
                        background: success ? "#ECFDF5" : "#FEF2F2",
                        color: success ? "#0A7C4E" : "#B91C1C",
                      }}
                    >
                      {success ? <CircleCheck size={14} /> : <CircleX size={14} />}
                      {sessionOutcomeLabel(item.outcome, locale)}
                    </span>
                  </div>

                  <p className="mt-3 font-body text-[14px] leading-relaxed text-vyva-text-1">
                    {item.outcome_summary || (isSpanish ? "Aun no hay resumen disponible." : "No summary available yet.")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};

export default ConciergeScreen;
