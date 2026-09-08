import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Heart,
  Home,
  Loader2,
  Mic,
  PackageCheck,
  Pill,
  Search,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserCheck,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { executeShoppingPreparation, isShoppingCanvasEnabled, parseShoppingCanvasRolloutConfig, ShoppingVoiceCanvas, type ShoppingAddress, type ShoppingRetailer } from "@/components/voice-canvas";
import { SHOPPING_CANVAS_COMMANDS, SHOPPING_CANVAS_COPY } from "./conciergeShoppingCanvasCopy";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import {
  getStaticShoppingSupportPackages,
  SHOPPING_CATEGORY_CHOICE_LABELS,
  SHOPPING_SUPPORT_PACKAGES,
  type ShoppingCategoryChoice,
  type ShoppingPriority,
  type ShoppingRecommendation,
  type ShoppingRecommendationResponse,
  type ShoppingSupportPackageDefinition,
  type ShoppingSupportPackageId,
} from "../../shared/shopping";

type Copy = {
  title: string;
  subtitle: string;
  voiceTitle: string;
  voiceBody: string;
  voiceAsk: string;
  voiceListening: string;
  voiceUnavailable: string;
  voiceCaptured: string;
  readSummary: string;
  stopReading: string;
  modesTitle: string;
  shortlist: string;
  needLabel: string;
  needPlaceholder: string;
  categoryTitle: string;
  prioritiesTitle: string;
  personalTitle: string;
  personalBody: string;
  constraintsLabel: string;
  constraintsPlaceholder: string;
  find: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  resultsTitle: string;
  compareTitle: string;
  save: string;
  saved: string;
  shortlistTitle: string;
  noCheckout: string;
  caveat: string;
  error: string;
  errorSignIn: string;
  errorPlan: string;
  errorProfile: string;
  errorApiUnavailable: string;
  back: string;
  tryIdeas: string;
  checkBeforeBuying: string;
  confidence: string;
  safetyLabel: string;
  goodChoice: string;
  checkCarefully: string;
  askTrustedPerson: string;
  careReview: string;
  careReviewBody: string;
  prepareRequest: string;
  prepareRequestBody: string;
  prepareRequestSummary: string;
  safetyCheckTitle: string;
  safetyCheckBody: string;
  safetyCheckLabel: string;
  safetyCheckPlaceholder: string;
  safetyPriceLabel: string;
  safetyPricePlaceholder: string;
  safetySellerLabel: string;
  safetySellerPlaceholder: string;
  safetyCheckButton: string;
  safetyResultTitle: string;
  safetyNextStep: string;
  useAsNeed: string;
  packageTitle: string;
  packageBody: string;
  packageSource: string;
  packageNoCheckout: string;
  packageServiceNotice: string;
};

type ShoppingRoutePrefill = {
  needText: string;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  constraints?: string[];
  packageId?: ShoppingSupportPackageId;
  sourceRecommendation?: string;
};

type ShoppingLocationState = {
  shoppingPrefill?: ShoppingRoutePrefill;
  resumeCanvas?: "shopping" | boolean;
} | null;

const COPY: Record<"en" | "es", Copy> = {
  en: {
    title: "Shop",
    subtitle: "A voice-first guide for safer choices, clearer comparisons, and no surprise checkout.",
    voiceTitle: "Tell VYVA what you need",
    voiceBody: "Say a shopping need, product question, or suspicious link. VYVA turns it into a short, safer plan.",
    voiceAsk: "Ask by voice",
    voiceListening: "Listening...",
    voiceUnavailable: "Voice input is not available in this browser. You can still type your request.",
    voiceCaptured: "I added what I heard. You can edit it before searching.",
    readSummary: "Read summary",
    stopReading: "Stop reading",
    modesTitle: "Shopping mode",
    shortlist: "Shortlist",
    needLabel: "What do you need help choosing?",
    needPlaceholder: "Example: Groceries for the week that are low salt, easy to open, and not heavy to carry.",
    categoryTitle: "Area",
    prioritiesTitle: "Most important",
    personalTitle: "Make it right for me",
    personalBody: "VYVA uses these needs when comparing choices.",
    constraintsLabel: "Avoid",
    constraintsPlaceholder: "Example: hard to bend, poor night vision, no heavy items, avoid subscriptions",
    find: "Find best choices",
    loading: "Finding clear choices...",
    emptyTitle: "Start with a need, a product, or a concern",
    emptyBody: "VYVA keeps the list short, explains safety tradeoffs, and never starts checkout.",
    resultsTitle: "Best choices",
    compareTitle: "Simple comparison",
    save: "Save choice",
    saved: "Saved",
    shortlistTitle: "Saved shortlist",
    noCheckout: "No checkout here.",
    caveat: "For pharmacy items, VYVA does not replace a pharmacist, doctor, or medication advice.",
    error: "VYVA could not compare choices right now. Please try again.",
    errorSignIn: "Please sign in again, then try Find best choices.",
    errorPlan: "Concierge is not included in this plan. Check subscription settings to enable it.",
    errorProfile: "Choose or finish a care profile first, then try again.",
    errorApiUnavailable: "The local VYVA API is not running. Start the backend on port 3001 and try again.",
    back: "Back",
    tryIdeas: "Try one",
    checkBeforeBuying: "Check before choosing",
    confidence: "Fit",
    safetyLabel: "Safety",
    goodChoice: "Good choice",
    checkCarefully: "Check carefully",
    askTrustedPerson: "Ask someone you trust",
    careReview: "Ask trusted person",
    careReviewBody: "VYVA will prepare a review request before anyone is contacted.",
    prepareRequest: "Prepare request",
    prepareRequestBody: "VYVA turns this into a safe next step. You confirm before anything is sent.",
    prepareRequestSummary: "VYVA prepares a shopping request. Nothing is ordered, paid, or sent without confirmation.",
    safetyCheckTitle: "Check a product or seller",
    safetyCheckBody: "Paste a product label, website, seller name, or price. VYVA flags scam signs, accessibility issues, and health cautions.",
    safetyCheckLabel: "Product, label, message, or website",
    safetyCheckPlaceholder: "Example: Seller asks me to pay by gift card for a discounted blood pressure monitor.",
    safetyPriceLabel: "Price",
    safetyPricePlaceholder: "Example: 180",
    safetySellerLabel: "Seller or website",
    safetySellerPlaceholder: "Example: unknown website, Amazon, local pharmacy",
    safetyCheckButton: "Check safety",
    safetyResultTitle: "Safety check",
    safetyNextStep: "Next step",
    useAsNeed: "Use this as my request",
    packageTitle: "Choose a support package",
    packageBody: "Packages prepare a short request from VYVA-approved supplies or Concierge. VYVA will not place an order or start checkout.",
    packageSource: "From your health recommendation",
    packageNoCheckout: "No checkout starts here.",
    packageServiceNotice: "Service request only.",
  },
  es: {
    title: "Comprar",
    subtitle: "Una guia por voz para elegir con mas seguridad, comparar claro y sin pagos sorpresa.",
    voiceTitle: "Diga a VYVA que necesita",
    voiceBody: "Diga una necesidad, una duda sobre un producto o un enlace sospechoso. VYVA lo convierte en un plan breve y seguro.",
    voiceAsk: "Pedir por voz",
    voiceListening: "Escuchando...",
    voiceUnavailable: "La voz no esta disponible en este navegador. Puede escribir la solicitud.",
    voiceCaptured: "He anadido lo que he entendido. Puede editarlo antes de buscar.",
    readSummary: "Leer resumen",
    stopReading: "Parar lectura",
    modesTitle: "Modo de compra",
    shortlist: "Guardados",
    needLabel: "Que necesita elegir?",
    needPlaceholder: "Ejemplo: compra para la semana baja en sal, facil de abrir y ligera.",
    categoryTitle: "Area",
    prioritiesTitle: "Mas importante",
    personalTitle: "Adaptarlo a mi",
    personalBody: "VYVA usa estas necesidades al comparar opciones.",
    constraintsLabel: "Evitar",
    constraintsPlaceholder: "Ejemplo: cuesta agacharse, poca vision de noche, sin objetos pesados, evitar suscripciones",
    find: "Buscar mejores opciones",
    loading: "Buscando opciones claras...",
    emptyTitle: "Empiece con una necesidad, un producto o una duda",
    emptyBody: "VYVA muestra pocas opciones, explica riesgos y nunca inicia compra.",
    resultsTitle: "Mejores opciones",
    compareTitle: "Comparacion sencilla",
    save: "Guardar opcion",
    saved: "Guardado",
    shortlistTitle: "Opciones guardadas",
    noCheckout: "Sin compra aqui.",
    caveat: "Para articulos de farmacia, VYVA no sustituye a un farmaceutico, medico ni consejo sobre medicacion.",
    error: "VYVA no ha podido comparar opciones ahora. Intentelo otra vez.",
    errorSignIn: "Inicie sesion otra vez y vuelva a buscar mejores opciones.",
    errorPlan: "Concierge no esta incluido en este plan. Revise la suscripcion para activarlo.",
    errorProfile: "Elija o termine un perfil de cuidado y vuelva a intentarlo.",
    errorApiUnavailable: "La API local de VYVA no esta funcionando. Inicie el backend en el puerto 3001 y vuelva a intentarlo.",
    back: "Volver",
    tryIdeas: "Probar",
    checkBeforeBuying: "Comprobar antes de elegir",
    confidence: "Encaje",
    safetyLabel: "Seguridad",
    goodChoice: "Buena opcion",
    checkCarefully: "Revisar con cuidado",
    askTrustedPerson: "Preguntar a alguien de confianza",
    careReview: "Preguntar a confianza",
    careReviewBody: "VYVA preparara una solicitud de revision antes de contactar a nadie.",
    prepareRequest: "Preparar solicitud",
    prepareRequestBody: "VYVA lo convierte en un siguiente paso seguro. Usted confirma antes de enviar nada.",
    prepareRequestSummary: "VYVA prepara una solicitud de compra. No se pide, paga ni envia nada sin confirmacion.",
    safetyCheckTitle: "Comprobar producto o vendedor",
    safetyCheckBody: "Pegue una etiqueta, web, vendedor o precio. VYVA senala indicios de estafa, accesibilidad y cautelas de salud.",
    safetyCheckLabel: "Producto, etiqueta, mensaje o web",
    safetyCheckPlaceholder: "Ejemplo: El vendedor me pide pagar con tarjeta regalo por un tensiometro rebajado.",
    safetyPriceLabel: "Precio",
    safetyPricePlaceholder: "Ejemplo: 180",
    safetySellerLabel: "Vendedor o web",
    safetySellerPlaceholder: "Ejemplo: web desconocida, Amazon, farmacia local",
    safetyCheckButton: "Comprobar seguridad",
    safetyResultTitle: "Revision de seguridad",
    safetyNextStep: "Siguiente paso",
    useAsNeed: "Usar como solicitud",
    packageTitle: "Elija un paquete de apoyo",
    packageBody: "Los paquetes preparan una solicitud corta con suministros aprobados por VYVA o Concierge. VYVA no hace pedidos ni inicia pagos.",
    packageSource: "Desde su recomendacion de salud",
    packageNoCheckout: "No se inicia compra aqui.",
    packageServiceNotice: "Solo solicitud de servicio.",
  },
};

const CATEGORY_OPTIONS: Array<{ id: ShoppingCategoryChoice; icon: string }> = [
  { id: "safe_home", icon: "S" },
  { id: "groceries", icon: "G" },
  { id: "pharmacy_basics", icon: "P" },
  { id: "household", icon: "H" },
  { id: "mobility_aids", icon: "M" },
];

const PRIORITY_OPTIONS: Array<{ id: ShoppingPriority; en: string; es: string }> = [
  { id: "budget", en: "Low cost", es: "Precio bajo" },
  { id: "simplicity", en: "Easy to use", es: "Facil de usar" },
  { id: "accessibility", en: "Accessibility", es: "Accesibilidad" },
  { id: "safety", en: "Safety", es: "Seguridad" },
  { id: "delivery", en: "Easy to carry", es: "Facil de llevar" },
  { id: "diet", en: "Diet needs", es: "Dieta" },
];

type ShoppingModeId = "groceries" | "home_safety" | "pharmacy" | "check";

const SHOPPING_MODES: Array<{
  id: ShoppingModeId;
  Icon: LucideIcon;
  label: Record<"en" | "es", string>;
  body: Record<"en" | "es", string>;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  needText: Record<"en" | "es", string>;
}> = [
  {
    id: "groceries",
    Icon: Truck,
    label: { en: "Groceries", es: "Compra" },
    body: { en: "Diet, budget, delivery", es: "Dieta, precio, entrega" },
    category: "groceries",
    priorities: ["diet", "delivery", "simplicity"],
    needText: {
      en: "Groceries for the week that fit my health needs, budget, and delivery preferences.",
      es: "Compra para la semana que se adapte a mi salud, presupuesto y entrega.",
    },
  },
  {
    id: "home_safety",
    Icon: Home,
    label: { en: "Home safety", es: "Casa segura" },
    body: { en: "Falls, lighting, access", es: "Caidas, luz, acceso" },
    category: "safe_home",
    priorities: ["safety", "accessibility"],
    needText: {
      en: "Home safety items that reduce fall risk and are simple to set up.",
      es: "Articulos de seguridad en casa que reduzcan caidas y sean faciles de colocar.",
    },
  },
  {
    id: "pharmacy",
    Icon: Pill,
    label: { en: "Pharmacy", es: "Farmacia" },
    body: { en: "Labels, basics, refills", es: "Etiquetas, basicos, recetas" },
    category: "pharmacy_basics",
    priorities: ["simplicity", "safety", "accessibility"],
    needText: {
      en: "Pharmacy basics that are easy to read, easy to open, and safe to confirm with a pharmacist.",
      es: "Basicos de farmacia faciles de leer, abrir y confirmar con farmacia.",
    },
  },
  {
    id: "check",
    Icon: ShieldCheck,
    label: { en: "Check product", es: "Comprobar" },
    body: { en: "Scam, label, seller", es: "Estafa, etiqueta, vendedor" },
    category: "safe_home",
    priorities: ["safety", "simplicity"],
    needText: {
      en: "",
      es: "",
    },
  },
];

type PersonalNeedId =
  | "low_sodium"
  | "blood_sugar"
  | "easy_open"
  | "lightweight"
  | "large_print"
  | "care_review";

const PERSONAL_NEED_OPTIONS: Array<{
  id: PersonalNeedId;
  label: Record<"en" | "es", string>;
  constraints: Record<"en" | "es", string>;
  priorities: ShoppingPriority[];
}> = [
  {
    id: "low_sodium",
    label: { en: "Low salt", es: "Bajo en sal" },
    constraints: { en: "prefer low sodium and check salt labels", es: "preferir bajo en sal y revisar etiquetas" },
    priorities: ["diet", "safety"],
  },
  {
    id: "blood_sugar",
    label: { en: "Blood sugar", es: "Glucosa" },
    constraints: { en: "check sugar and carbohydrate labels", es: "revisar azucar e hidratos" },
    priorities: ["diet", "safety"],
  },
  {
    id: "easy_open",
    label: { en: "Easy to open", es: "Facil de abrir" },
    constraints: { en: "easy-open packaging and simple instructions", es: "envases faciles de abrir e instrucciones sencillas" },
    priorities: ["accessibility", "simplicity"],
  },
  {
    id: "lightweight",
    label: { en: "Lightweight", es: "Ligero" },
    constraints: { en: "avoid heavy items and prefer delivery-friendly sizes", es: "evitar peso y preferir tamanos faciles de entregar" },
    priorities: ["delivery", "accessibility"],
  },
  {
    id: "large_print",
    label: { en: "Large print", es: "Letra grande" },
    constraints: { en: "large labels, clear controls, and readable instructions", es: "etiquetas grandes, controles claros e instrucciones legibles" },
    priorities: ["accessibility", "simplicity"],
  },
  {
    id: "care_review",
    label: { en: "Review before buying", es: "Revisar antes" },
    constraints: { en: "prepare trusted-person review before any expensive or uncertain purchase", es: "preparar revision de confianza antes de compras caras o dudosas" },
    priorities: ["safety"],
  },
];

const VALID_SHOPPING_CATEGORIES = new Set(CATEGORY_OPTIONS.map((option) => option.id));
const VALID_SHOPPING_PRIORITIES = new Set(PRIORITY_OPTIONS.map((option) => option.id));
const FALLBACK_SUPPORT_PACKAGE_OPTIONS = getStaticShoppingSupportPackages();

const IDEA_CHIPS = [
  {
    en: "Safer bathroom at night",
    es: "Bano mas seguro",
    category: "safe_home" as ShoppingCategoryChoice,
    priorities: ["safety", "accessibility"] as ShoppingPriority[],
  },
  {
    en: "Less bending at home",
    es: "Menos agacharse en casa",
    category: "safe_home" as ShoppingCategoryChoice,
    priorities: ["accessibility", "delivery"] as ShoppingPriority[],
  },
  {
    en: "Avoid mixing medicines",
    es: "No confundir medicinas",
    category: "pharmacy_basics" as ShoppingCategoryChoice,
    priorities: ["simplicity", "safety"] as ShoppingPriority[],
  },
  {
    en: "Heart-friendly breakfast",
    es: "Desayuno para el corazon",
    category: "groceries" as ShoppingCategoryChoice,
    priorities: ["diet", "simplicity"] as ShoppingPriority[],
  },
];

type ProductSafetyVerdict = "good" | "check" | "review";

type ProductSafetyResult = {
  verdict: ProductSafetyVerdict;
  label: string;
  reasons: string[];
  nextStep: string;
};

type BrowserSpeechRecognitionResultEvent = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function localeKey(language: string): "en" | "es" {
  return language.toLowerCase().startsWith("es") ? "es" : "en";
}

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function normalizeSafetyText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function parsePriceAmount(value: string): number | null {
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function productSafetyLabel(verdict: ProductSafetyVerdict, copy: Copy) {
  if (verdict === "good") return copy.goodChoice;
  if (verdict === "check") return copy.checkCarefully;
  return copy.askTrustedPerson;
}

function recommendationSafetyVerdict(item: ShoppingRecommendation): ProductSafetyVerdict {
  if (item.product.priceTier === "high" || item.confidence === "low") return "review";
  if (item.cautionNotes.length > 0 || item.tradeoffs.length > 0 || item.confidence === "medium") return "check";
  return "good";
}

function evaluateProductSafety(input: {
  text: string;
  seller: string;
  price: string;
  profileNeeds: PersonalNeedId[];
  locale: "en" | "es";
  copy: Copy;
}): ProductSafetyResult {
  const combined = normalizeSafetyText(`${input.text} ${input.seller}`);
  const price = parsePriceAmount(input.price);
  const reasons: string[] = [];
  let riskScore = 0;

  const suspiciousTerms = [
    "gift card",
    "crypto",
    "wire transfer",
    "bank transfer",
    "urgent",
    "limited time",
    "prize",
    "unknown seller",
    "suspect",
    "tarjeta regalo",
    "cripto",
    "transferencia",
    "urgente",
    "premio",
    "desconocido",
  ];
  const subscriptionTerms = ["subscription", "free trial", "recurring", "suscripcion", "prueba gratis", "recurrente"];
  const healthTerms = ["medicine", "medication", "supplement", "ibuprofen", "painkiller", "sodium", "sugar", "salt", "medicina", "suplemento", "azucar", "sal"];
  const fallRiskTerms = ["step stool", "ladder", "slippery", "bath mat", "rug", "taburete", "escalera", "resbal", "alfombra"];

  if (suspiciousTerms.some((term) => combined.includes(term))) {
    riskScore += 3;
    reasons.push(input.locale === "es"
      ? "Hay senales habituales de estafa o presion para pagar de forma insegura."
      : "There are common scam or pressure-payment signs.");
  }
  if (subscriptionTerms.some((term) => combined.includes(term))) {
    riskScore += 2;
    reasons.push(input.locale === "es"
      ? "Podria haber una suscripcion o pago recurrente que conviene revisar."
      : "There may be a subscription or recurring payment to review.");
  }
  if (price !== null && price >= 150) {
    riskScore += 2;
    reasons.push(input.locale === "es"
      ? "El precio es suficientemente alto para pedir una segunda revision."
      : "The price is high enough to deserve a second review.");
  }
  if (healthTerms.some((term) => combined.includes(term))) {
    riskScore += 1;
    reasons.push(input.locale === "es"
      ? "Revise etiqueta, alergias y consejo de farmacia o medico antes de elegir."
      : "Check the label, allergies, and pharmacist or doctor guidance before choosing.");
  }
  if (fallRiskTerms.some((term) => combined.includes(term))) {
    riskScore += 1;
    reasons.push(input.locale === "es"
      ? "Revise estabilidad, superficie antideslizante y medidas antes de comprar."
      : "Check stability, non-slip surface, and measurements before buying.");
  }
  if (input.profileNeeds.includes("low_sodium") && /(soup|meal|food|snack|sopa|comida|alimento)/.test(combined)) {
    riskScore += 1;
    reasons.push(input.locale === "es"
      ? "Su preferencia baja en sal hace importante revisar sodio por racion."
      : "Your low-salt preference makes the sodium per serving important.");
  }
  if (input.profileNeeds.includes("blood_sugar") && /(drink|juice|fruit|yogurt|snack|bebida|zumo|fruta|yogur)/.test(combined)) {
    riskScore += 1;
    reasons.push(input.locale === "es"
      ? "Revise azucar e hidratos antes de elegir."
      : "Check sugar and carbohydrate labels before choosing.");
  }
  if (input.profileNeeds.includes("easy_open") && /(jar|bottle|cap|can|frasco|botella|tapon|lata)/.test(combined)) {
    reasons.push(input.locale === "es"
      ? "Busque envase facil de abrir y etiqueta clara."
      : "Look for easy-open packaging and a clear label.");
  }

  if (!input.text.trim() && !input.seller.trim() && !input.price.trim()) {
    return {
      verdict: "check",
      label: productSafetyLabel("check", input.copy),
      reasons: [input.locale === "es" ? "Anada producto, vendedor o precio para revisar." : "Add a product, seller, or price to check."],
      nextStep: input.locale === "es" ? "Pegue el mensaje o etiqueta y vuelva a comprobar." : "Paste the message or label and check again.",
    };
  }

  const verdict: ProductSafetyVerdict = riskScore >= 3 ? "review" : riskScore >= 1 ? "check" : "good";
  const fallbackReason = input.locale === "es"
    ? "No veo senales claras de estafa en lo escrito, pero conviene revisar vendedor, devoluciones y etiqueta."
    : "I do not see clear scam signs in the text, but seller, returns, and labels still matter.";

  return {
    verdict,
    label: productSafetyLabel(verdict, input.copy),
    reasons: reasons.length > 0 ? Array.from(new Set(reasons)).slice(0, 4) : [fallbackReason],
    nextStep: verdict === "review"
      ? (input.locale === "es"
        ? "Pida revision a alguien de confianza antes de pagar o compartir datos."
        : "Ask someone you trust to review it before paying or sharing details.")
      : verdict === "check"
        ? (input.locale === "es"
          ? "Compruebe etiqueta, vendedor, devolucion y facilidad de uso antes de decidir."
          : "Check the label, seller, return policy, and ease of use before deciding.")
        : (input.locale === "es"
          ? "Si el vendedor es fiable, compare precio y entrega antes de elegir."
          : "If the seller is trusted, compare price and delivery before choosing."),
  };
}

function categoryLabel(category: ShoppingCategoryChoice, locale: "en" | "es") {
  return SHOPPING_CATEGORY_CHOICE_LABELS[category][locale];
}

function modeForCategory(category: ShoppingCategoryChoice): ShoppingModeId {
  if (category === "groceries") return "groceries";
  if (category === "pharmacy_basics") return "pharmacy";
  return "home_safety";
}

function rankLabel(label: ShoppingRecommendation["rankLabel"], locale: "en" | "es") {
  if (locale === "en") return label;
  if (label === "Best fit") return "Mejor opcion";
  if (label === "Lowest cost") return "Menor coste";
  if (label === "Best first step") return "Primer paso";
  if (label === "Best for night trips") return "Para ir de noche";
  if (label === "Best if standing is hard") return "Si cuesta levantarse";
  if (label === "Best for less bending") return "Para agacharse menos";
  return "Mas facil";
}

function confidenceLabel(confidence: ShoppingRecommendation["confidence"], locale: "en" | "es") {
  if (locale === "es") {
    if (confidence === "high") return "alto";
    if (confidence === "medium") return "medio";
    return "bajo";
  }
  return confidence;
}

class ShoppingRequestError extends Error {
  status?: number;
  code?: string;
  nextRoute?: string;

  constructor(message: string, status?: number, code?: string, nextRoute?: string) {
    super(message);
    this.name = "ShoppingRequestError";
    this.status = status;
    this.code = code;
    this.nextRoute = nextRoute;
  }
}

async function readErrorBody(response: Response): Promise<{ error?: string; code?: string; nextRoute?: string }> {
  try {
    const parsed = await response.json();
    return typeof parsed === "object" && parsed !== null ? parsed as { error?: string; code?: string; nextRoute?: string } : {};
  } catch {
    return {};
  }
}

function shoppingErrorMessage(error: unknown, copy: Copy): string {
  if (error instanceof ShoppingRequestError) {
    if (error.status === 401) return copy.errorSignIn;
    if (error.status === 403 || error.code === "ENTITLEMENT_REQUIRED") return copy.errorPlan;
    if (error.status === 409) return copy.errorProfile;
    if (error.status === 502 || error.code === "LOCAL_API_UNAVAILABLE") return copy.errorApiUnavailable;
    return error.message || copy.error;
  }
  return copy.error;
}

async function requestRecommendations(input: {
  needText: string;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  constraints: string[];
  locale: string;
  packageId?: string | null;
}): Promise<ShoppingRecommendationResponse> {
  const response = await apiFetch("/api/concierge/shopping/recommendations", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ShoppingRequestError(body.error || `Request failed: ${response.status}`, response.status, body.code, body.nextRoute);
  }
  return await response.json() as ShoppingRecommendationResponse;
}

const RecommendationCard = ({
  item,
  locale,
  saved,
  onToggleSave,
  onCareReview,
  copy,
}: {
  item: ShoppingRecommendation;
  locale: "en" | "es";
  saved: boolean;
  onToggleSave: () => void;
  onCareReview: () => void;
  copy: Copy;
}) => {
  const safetyVerdict = recommendationSafetyVerdict(item);
  const safetyTone = safetyVerdict === "good"
    ? "bg-[#ECFDF5] text-[#0A7C4E]"
    : safetyVerdict === "check"
      ? "bg-[#FFF7ED] text-[#9A3412]"
      : "bg-[#FEF2F2] text-[#B91C1C]";

  return (
    <article className="rounded-[18px] border border-vyva-border bg-white p-4 shadow-[0_8px_20px_rgba(60,38,20,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[12px] font-black text-[#0A7C4E]">
              {rankLabel(item.rankLabel, locale)}
            </span>
            <span className="rounded-full bg-[#F8F4EF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-text-2">
              {item.product.priceLabel}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-[12px] font-black ${safetyTone}`}>
              <ShieldCheck size={13} />
              {copy.safetyLabel}: {productSafetyLabel(safetyVerdict, copy)}
            </span>
          </div>
          <h2 className="mt-2 font-body text-[20px] font-extrabold leading-tight text-vyva-text-1">
            {item.product.name}
          </h2>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] font-body text-[18px] font-black text-vyva-purple">
          {item.product.name.slice(0, 1)}
        </div>
      </div>

      <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">
        {item.product.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#F8F4EF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-text-2">
          {item.product.availabilityLabel}
        </span>
        <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-purple">
          {copy.confidence}: {confidenceLabel(item.confidence, locale)}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {item.reasons.slice(0, 2).map((reason) => (
          <p key={reason} className="flex gap-2 rounded-[12px] bg-[#F0FDFA] px-3 py-2 font-body text-[14px] font-bold leading-snug text-vyva-text-1">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#0F766E]" />
            <span>{reason}</span>
          </p>
        ))}
        {(item.tradeoffs[0] || item.cautionNotes[0]) && (
          <p className="flex gap-2 rounded-[12px] bg-[#FFFCF7] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#C9890A]" />
            <span>{item.tradeoffs[0] || item.cautionNotes[0]}</span>
          </p>
        )}
        {item.product.accessibilityNotes[0] && (
          <p className="rounded-[12px] border border-vyva-border bg-white px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
            <span className="font-extrabold text-vyva-text-1">{copy.checkBeforeBuying}: </span>
            {item.product.accessibilityNotes[0]}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onToggleSave}
          className={`vyva-tap inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 font-body text-[16px] font-extrabold ${
            saved ? "border border-[#BBF7D0] bg-[#ECFDF5] text-[#0A7C4E]" : "bg-vyva-purple text-white"
          }`}
          aria-pressed={saved}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
          {saved ? copy.saved : copy.save}
        </button>
        <button
          type="button"
          onClick={onCareReview}
          className="vyva-tap inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#D8B4FE] bg-[#F5F3FF] px-4 py-3 font-body text-[15px] font-extrabold text-vyva-purple"
        >
          <UserCheck size={18} />
          {copy.careReview}
        </button>
      </div>
    </article>
  );
};

const ConciergeShoppingScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const locale = localeKey(language);
  const copy = COPY[locale];
  const [category, setCategory] = useState<ShoppingCategoryChoice>("safe_home");
  const [needText, setNeedText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [priorities, setPriorities] = useState<ShoppingPriority[]>(["safety", "accessibility"]);
  const [activeMode, setActiveMode] = useState<ShoppingModeId>("home_safety");
  const [profileNeeds, setProfileNeeds] = useState<PersonalNeedId[]>(["easy_open", "large_print"]);
  const [result, setResult] = useState<ShoppingRecommendationResponse | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "captured">("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [checkText, setCheckText] = useState("");
  const [checkPrice, setCheckPrice] = useState("");
  const [checkSeller, setCheckSeller] = useState("");
  const [safetyResult, setSafetyResult] = useState<ProductSafetyResult | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shoppingCanvasOpen, setShoppingCanvasOpen] = useState(false);
  const [shoppingCanvasConfig, setShoppingCanvasConfig] = useState({ enabled: false, rolloutPercent: 0 });
  const [shoppingProfile, setShoppingProfile] = useState<{ id?: string | number; address?: string; addressLine1?: string; city?: string; savedProviders?: Array<{ id?: string | number; name?: string; providerName?: string; category?: string }> } | null>(null);
  const [routePackageId, setRoutePackageId] = useState<ShoppingSupportPackageId | null>(null);
  const [sourceRecommendation, setSourceRecommendation] = useState("");
  const [supportPackages, setSupportPackages] = useState<ShoppingSupportPackageDefinition[]>(FALLBACK_SUPPORT_PACKAGE_OPTIONS);
  const resultsRef = useRef<HTMLElement | null>(null);
  const lastRoutePrefillKeyRef = useRef<string | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const supportPackageMap = useMemo(() => new Map(supportPackages.map((item) => [item.id, item])), [supportPackages]);
  const activeRoutePackage = routePackageId ? supportPackageMap.get(routePackageId) ?? SHOPPING_SUPPORT_PACKAGES[routePackageId] : null;
  const selectedProfileOptions = useMemo(
    () => PERSONAL_NEED_OPTIONS.filter((option) => profileNeeds.includes(option.id)),
    [profileNeeds],
  );
  const shoppingCanvasEnabled = isShoppingCanvasEnabled(shoppingCanvasConfig, String(shoppingProfile?.id ?? "anonymous"));
  const shouldResumeShoppingCanvas = (location.state as ShoppingLocationState)?.resumeCanvas === true
    || (location.state as ShoppingLocationState)?.resumeCanvas === "shopping";
  const canvasRetailers = useMemo<ShoppingRetailer[]>(() => (shoppingProfile?.savedProviders ?? []).filter((item) => /supermarket|grocery|food|store|retail/i.test(item.category ?? "")).map((item, index) => ({ id: String(item.id ?? `retailer-${index}`), label: item.name ?? item.providerName ?? "", subtitle: locale === "es" ? "Tienda guardada" : "Saved retailer", description: item.isTrusted ? (locale === "es" ? "Guardado en tu perfil" : "Saved in your profile") : undefined, retailerType: item.category ?? (locale === "es" ? "Tienda" : "Retailer"), estimateLabel: locale === "es" ? "No verificado" : "Unverified", feeLabel: locale === "es" ? "No verificado" : "Unverified", savedLabel: locale === "es" ? "Tienda guardada" : "Saved retailer", reviewReminder: locale === "es" ? "Revisar antes de actuar" : "Review before action", recommended: index === 0 })).filter((item) => item.label), [shoppingProfile, locale]);
  const canvasAddresses = useMemo<ShoppingAddress[]>(() => { const address = [shoppingProfile?.address ?? shoppingProfile?.addressLine1, shoppingProfile?.city].filter(Boolean).join(", "); return address ? [{ id: "home", label: locale === "es" ? "Casa" : "Home", address, savedLabel: locale === "es" ? "Dirección guardada" : "Saved address", deliveryNote: locale === "es" ? "Entrega preparada, no pedida" : "Delivery prepared, not ordered", reviewReminder: locale === "es" ? "Revisar antes de actuar" : "Review before action", recommended: true }] : []; }, [shoppingProfile, locale]);

  const savedRecommendations = useMemo(
    () => result?.recommendations.filter((item) => savedIds.includes(item.product.id)) ?? [],
    [result, savedIds],
  );

  useEffect(() => () => {
    speechRecognitionRef.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => { let active = true; apiFetch("/api/profile").then((response) => response.ok ? response.json() : null).catch(() => null).then((profile) => { if (active) setShoppingProfile(profile); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => apiFetch("/api/config/features/shopping-delivery-voice-canvas")
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null)
      .then((config) => { if (active) setShoppingCanvasConfig(parseShoppingCanvasRolloutConfig(config)); });
    refresh();
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => { if (!shoppingCanvasEnabled) setShoppingCanvasOpen(false); }, [shoppingCanvasEnabled]);
  useEffect(() => {
    if (shoppingCanvasEnabled && shouldResumeShoppingCanvas) setShoppingCanvasOpen(true);
  }, [shoppingCanvasEnabled, shouldResumeShoppingCanvas]);

  useEffect(() => {
    let active = true;
    async function loadSupportPackages() {
      try {
        const response = await apiFetch("/api/concierge/shopping/support-packages");
        if (!response?.ok) throw new Error("Support packages unavailable");
        const data = await response.json().catch(() => ({}));
        const packages = Array.isArray(data.packages)
          ? data.packages.filter((item): item is ShoppingSupportPackageDefinition => (
            item && typeof item.id === "string" && item.label && item.description && item.needText
          ))
          : [];
        if (active && packages.length > 0) setSupportPackages(packages);
      } catch {
        if (active) setSupportPackages(FALLBACK_SUPPORT_PACKAGE_OPTIONS);
      }
    }
    loadSupportPackages();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prefill = (location.state as ShoppingLocationState)?.shoppingPrefill;
    if (!prefill) return;
    const prefillKey = `${prefill.packageId ?? ""}:${prefill.category}:${prefill.needText}:${prefill.priorities.join(",")}:${prefill.constraints?.join(",") ?? ""}`;
    if (lastRoutePrefillKeyRef.current === prefillKey) return;
    lastRoutePrefillKeyRef.current = prefillKey;
    const packageId = typeof prefill.packageId === "string" && prefill.packageId.trim() ? prefill.packageId.trim() : null;
    const packageDefinition = packageId ? supportPackageMap.get(packageId) ?? SHOPPING_SUPPORT_PACKAGES[packageId] : null;

    if (prefill.needText.trim()) {
      setNeedText(prefill.needText.trim());
    } else if (packageDefinition) {
      setNeedText(packageDefinition.needText[locale]);
    }
    if (VALID_SHOPPING_CATEGORIES.has(prefill.category)) {
      setCategory(prefill.category);
      setActiveMode(modeForCategory(prefill.category));
    } else if (packageDefinition) {
      setCategory(packageDefinition.category);
      setActiveMode(modeForCategory(packageDefinition.category));
    }
    const safePriorities = prefill.priorities.filter((priority) => VALID_SHOPPING_PRIORITIES.has(priority));
    if (safePriorities.length) {
      setPriorities(safePriorities);
      setPreferencesOpen(true);
    } else if (packageDefinition) {
      setPriorities(packageDefinition.priorities);
      setPreferencesOpen(true);
    }
    const packageConstraints = packageDefinition?.constraints[locale] ?? [];
    const safeConstraints = prefill.constraints?.filter(Boolean) ?? packageConstraints;
    if (safeConstraints.length) {
      setConstraintsText(safeConstraints.join(", "));
      setPreferencesOpen(true);
    }
    setRoutePackageId(packageId);
    setSourceRecommendation(prefill.sourceRecommendation?.trim() ?? "");
    setResult(null);
    setError(null);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [locale, location.pathname, location.search, location.state, navigate, supportPackageMap]);

  function togglePriority(priority: ShoppingPriority) {
    setPriorities((current) => (
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority]
    ));
  }

  function toggleProfileNeed(need: PersonalNeedId) {
    setProfileNeeds((current) => (
      current.includes(need)
        ? current.filter((item) => item !== need)
        : [...current, need]
    ));
  }

  function applyShoppingMode(mode: (typeof SHOPPING_MODES)[number]) {
    setActiveMode(mode.id);
    setError(null);
    setSafetyResult(null);
    if (mode.id === "check") {
      setCheckText((current) => current || needText);
      window.setTimeout(() => {
        if (typeof document === "undefined") return;
        document.getElementById("shopping-product-check")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }

    setNeedText(mode.needText[locale]);
    setCategory(mode.category);
    setPriorities(mode.priorities);
    setRoutePackageId(null);
    setSourceRecommendation("");
    setPreferencesOpen(true);
    setResult(null);
  }

  function applyIdea(idea: (typeof IDEA_CHIPS)[number]) {
    setNeedText(locale === "es" ? idea.es : idea.en);
    setCategory(idea.category);
    setPriorities(idea.priorities);
    setActiveMode(idea.category === "groceries" ? "groceries" : idea.category === "pharmacy_basics" ? "pharmacy" : "home_safety");
    setResult(null);
    setError(null);
  }

  function applyFollowUpQuestion(question: string) {
    const normalized = question.toLowerCase();
    setNeedText(question.replace(/\?$/, ""));
    if (normalized.includes("medicine") || normalized.includes("medicin") || normalized.includes("pastilla")) {
      setCategory("pharmacy_basics");
      setPriorities(["simplicity", "safety"]);
    } else if (normalized.includes("bend") || normalized.includes("agachar")) {
      setCategory("safe_home");
      setPriorities(["accessibility", "delivery"]);
    } else {
      setCategory("safe_home");
      setPriorities(["safety", "accessibility"]);
    }
    setActiveMode(normalized.includes("medicine") || normalized.includes("medicin") || normalized.includes("pastilla") ? "pharmacy" : "home_safety");
    setResult(null);
    setError(null);
  }

  function startVoiceInput() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError(copy.voiceUnavailable);
      return;
    }

    try {
      speechRecognitionRef.current?.stop();
      const recognition = new Recognition();
      speechRecognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = locale === "es" ? "es-ES" : "en-US";
      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = Array.from({ length: lastResult.length }, (_, index) => lastResult[index]?.transcript ?? "")
          .join(" ")
          .trim();
        if (transcript) {
          setNeedText((current) => current.trim() ? `${current.trim()} ${transcript}` : transcript);
          setVoiceStatus("captured");
          if (shoppingCanvasEnabled) setShoppingCanvasOpen(true);
          setError(null);
        }
      };
      recognition.onerror = () => {
        setVoiceStatus("idle");
        setError(copy.voiceUnavailable);
      };
      recognition.onend = () => {
        setVoiceStatus((current) => current === "listening" ? "idle" : current);
      };
      setVoiceStatus("listening");
      recognition.start();
    } catch {
      setVoiceStatus("idle");
      setError(copy.voiceUnavailable);
    }
  }

  function stopReading() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  function readShoppingSummary() {
    if (isSpeaking) {
      stopReading();
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setError(copy.voiceUnavailable);
      return;
    }
    const text = result
      ? [result.querySummary, result.comparison.summary, result.uncertaintyNote].join(" ")
      : needText.trim() || copy.voiceBody;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "es" ? "es-ES" : "en-US";
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function runSafetyCheck() {
    const next = evaluateProductSafety({
      text: checkText,
      seller: checkSeller,
      price: checkPrice,
      profileNeeds,
      locale,
      copy,
    });
    setSafetyResult(next);
    setError(null);
  }

  function applySafetyCheckAsNeed() {
    const merged = [
      checkText.trim(),
      checkSeller.trim() ? `${copy.safetySellerLabel}: ${checkSeller.trim()}` : "",
      checkPrice.trim() ? `${copy.safetyPriceLabel}: ${checkPrice.trim()}` : "",
    ].filter(Boolean).join("\n");
    if (!merged) return;
    const normalized = normalizeSafetyText(merged);
    setNeedText(merged);
    setPriorities(["safety", "simplicity"]);
    if (/(medicine|medication|pill|supplement|pharmacy|medicina|pastilla|farmacia|suplemento)/.test(normalized)) {
      setCategory("pharmacy_basics");
      setActiveMode("pharmacy");
    } else if (/(food|meal|soup|fruit|drink|grocery|comida|sopa|fruta|bebida|compra)/.test(normalized)) {
      setCategory("groceries");
      setActiveMode("groceries");
    } else {
      setCategory("safe_home");
      setActiveMode("home_safety");
    }
    setConstraintsText((current) => {
      const safetyConstraints = locale === "es"
        ? "revisar vendedor, devolucion, suscripciones y facilidad de uso"
        : "check seller, return policy, subscriptions, and ease of use";
      return current.trim() ? `${current.trim()}, ${safetyConstraints}` : safetyConstraints;
    });
    setPreferencesOpen(true);
    setResult(null);
  }

  function requestShoppingReview(message: string, source: "shopping_helper" | "shopping_recommendation" = "shopping_helper") {
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind: "task",
          message,
          flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          requestedTool: "operator_review",
          actionLabel: copy.prepareRequest,
          summary: copy.prepareRequestSummary,
          useCase: "shopping_request",
          source,
        },
      },
    });
  }

  function requestComparisonReview() {
    if (!result) return;
    const selected = savedRecommendations.length > 0
      ? savedRecommendations
      : result.recommendations.slice(0, 2);
    const selectedLines = selected.map((item) => (
      `- ${item.product.name}: ${item.product.priceLabel}. ${item.reasons[0] ?? item.product.description}`
    ));
    const categoryText = categoryLabel(category, locale);
    const priorityText = priorities
      .map((priority) => PRIORITY_OPTIONS.find((option) => option.id === priority)?.[locale])
      .filter(Boolean)
      .join(", ");
    const message = locale === "es"
      ? [
        "Ayudame a preparar una solicitud de compra segura.",
        `Necesidad: ${needText.trim() || result.querySummary}`,
        `Area: ${categoryText}`,
        priorityText ? `Prioridades: ${priorityText}` : "",
        selectedLines.length > 0 ? `Opciones:\n${selectedLines.join("\n")}` : "",
        `Comparacion: ${result.comparison.summary}`,
        constraintsText.trim() ? `Evitar o revisar: ${constraintsText.trim()}` : "",
        "No inicies compra, pago ni contacto sin mi confirmacion.",
      ].filter(Boolean).join("\n")
      : [
        "Help me prepare a safe shopping request.",
        `Need: ${needText.trim() || result.querySummary}`,
        `Area: ${categoryText}`,
        priorityText ? `Priorities: ${priorityText}` : "",
        selectedLines.length > 0 ? `Options:\n${selectedLines.join("\n")}` : "",
        `Comparison: ${result.comparison.summary}`,
        constraintsText.trim() ? `Avoid or check: ${constraintsText.trim()}` : "",
        "Do not start checkout, payment, or contact anyone without my confirmation.",
      ].filter(Boolean).join("\n");
    requestShoppingReview(message);
  }

  function requestRecommendationReview(item: ShoppingRecommendation) {
    const message = locale === "es"
      ? [
        `Ayudame a revisar esta posible compra antes de decidir: ${item.product.name}.`,
        `Precio/valor: ${item.product.priceLabel}.`,
        `Motivo: ${item.reasons[0] ?? item.product.description}`,
        `Cautela: ${item.cautionNotes[0] ?? item.tradeoffs[0] ?? "revisar vendedor, devolucion y facilidad de uso"}.`,
        "No inicies compra ni contactes a nadie sin mi confirmacion.",
      ].join("\n")
      : [
        `Help me review this possible purchase before I decide: ${item.product.name}.`,
        `Price/value: ${item.product.priceLabel}.`,
        `Reason: ${item.reasons[0] ?? item.product.description}`,
        `Caution: ${item.cautionNotes[0] ?? item.tradeoffs[0] ?? "check seller, returns, and ease of use"}.`,
        "Do not start checkout or contact anyone without my confirmation.",
      ].join("\n");
    requestShoppingReview(message, "shopping_recommendation");
  }

  function requestSafetyResultReview() {
    const message = locale === "es"
      ? [
        "Ayudame a revisar esta posible compra o vendedor.",
        checkText.trim() ? `Detalle: ${checkText.trim()}` : "",
        checkSeller.trim() ? `Vendedor/web: ${checkSeller.trim()}` : "",
        checkPrice.trim() ? `Precio: ${checkPrice.trim()}` : "",
        safetyResult ? `Resultado VYVA: ${safetyResult.label}. ${safetyResult.nextStep}` : "",
        "No inicies compra ni compartas datos sin mi confirmacion.",
      ].filter(Boolean).join("\n")
      : [
        "Help me review this possible purchase or seller.",
        checkText.trim() ? `Detail: ${checkText.trim()}` : "",
        checkSeller.trim() ? `Seller/site: ${checkSeller.trim()}` : "",
        checkPrice.trim() ? `Price: ${checkPrice.trim()}` : "",
        safetyResult ? `VYVA result: ${safetyResult.label}. ${safetyResult.nextStep}` : "",
        "Do not start checkout or share details without my confirmation.",
      ].filter(Boolean).join("\n");
    requestShoppingReview(message);
  }

  function applySupportPackage(packageDefinition: ShoppingSupportPackageDefinition) {
    if (packageDefinition.serviceRequest) {
      const requestText = [
        packageDefinition.needText[locale],
        sourceRecommendation ? `${copy.packageSource}: ${sourceRecommendation}` : "",
      ].filter(Boolean).join("\n\n");
      navigate("/concierge", {
        state: {
          conciergePrefill: {
            kind: "home_care_quote",
            message: requestText,
            source: "symptom_report",
          },
        },
      });
      return;
    }

    setRoutePackageId(packageDefinition.id);
    setNeedText(packageDefinition.needText[locale]);
    setCategory(packageDefinition.category);
    setActiveMode(modeForCategory(packageDefinition.category));
    setPriorities(packageDefinition.priorities);
    setConstraintsText(packageDefinition.constraints[locale].join(", "));
    setPreferencesOpen(true);
    setResult(null);
    setError(null);
  }

  async function runShoppingSearch() {
    const trimmedNeed = needText.trim();
    if (!trimmedNeed) {
      setError(locale === "es" ? "Escriba una frase corta para empezar." : "Write a short sentence to start.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const constraints = constraintsText
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const personalizedConstraints = selectedProfileOptions.map((option) => option.constraints[locale]);
      const personalizedPriorities = Array.from(new Set([
        ...priorities,
        ...selectedProfileOptions.flatMap((option) => option.priorities),
      ]));
      const next = await requestRecommendations({
        needText: trimmedNeed,
        category,
        priorities: personalizedPriorities,
        constraints: Array.from(new Set([...constraints, ...personalizedConstraints])),
        locale: language,
        packageId: routePackageId,
      });
      setResult(next);
      setSavedIds((current) => current.filter((id) => next.recommendations.some((item) => item.product.id === id)));
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      setError(shoppingErrorMessage(err, copy));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void runShoppingSearch();
  }

  function toggleSaved(id: string) {
    setSavedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  return (
    <main className="vyva-page pb-[150px]" data-testid="concierge-shopping-screen">
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate("/concierge")}
          className="vyva-tap inline-flex items-center gap-2 rounded-[16px] border border-vyva-border bg-white px-3 py-2 font-body text-[14px] font-extrabold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={18} />
          {copy.back}
        </button>
        <div className="inline-flex min-h-[48px] items-center gap-2 rounded-[16px] border border-vyva-border bg-white px-3 py-2 font-body text-[14px] font-extrabold text-vyva-purple shadow-sm" aria-live="polite">
          <ShoppingBasket size={18} />
          {copy.shortlist}: {savedIds.length}
        </div>
      </div>

      <header className="mt-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
            <PackageCheck size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[29px] leading-[1.05] text-vyva-text-1">
              {copy.title}
            </h1>
            <p className="mt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-2">
              {copy.subtitle}
            </p>
          </div>
        </div>
        <p className="mt-2 inline-flex rounded-[12px] bg-[#F0FDFA] px-3 py-2 font-body text-[14px] font-black text-[#0F766E]">
          {copy.noCheckout}
        </p>
      </header>

      {shoppingCanvasEnabled && (
        <section className="mt-4 rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_12px_28px_rgba(15,118,110,0.10)]" data-testid="shopping-delivery-canvas-entry">
          {shoppingCanvasOpen ? (
            <div className="flex min-w-0 justify-center" data-testid="shopping-delivery-canvas-frame">
              <ShoppingVoiceCanvas copy={SHOPPING_CANVAS_COPY[locale]} voiceCommands={SHOPPING_CANVAS_COMMANDS[locale]} retailers={canvasRetailers} addresses={canvasAddresses} onCancel={() => setShoppingCanvasOpen(false)} onDone={() => setShoppingCanvasOpen(false)} onConfirm={(draft, context) => executeShoppingPreparation(apiFetch, draft, { signal: context.signal, language: language || locale, messages: { prepareFailed: locale === "es" ? "No pudimos preparar la solicitud." : "We couldn’t prepare the request." } })} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><h2 className="font-body text-[19px] font-extrabold text-vyva-text-1">{locale === "es" ? "Prepara una compra o entrega" : "Prepare shopping or delivery"}</h2><p className="mt-1 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">{locale === "es" ? "Confirma artículos, cantidades, precio y entrega antes de preparar cualquier solicitud." : "Confirm items, quantities, cost, and delivery before any request is prepared."}</p></div>
              <button type="button" onClick={() => setShoppingCanvasOpen(true)} className="vyva-tap min-h-[52px] rounded-[16px] bg-[#0F766E] px-5 py-3 font-body text-[16px] font-extrabold text-white" data-testid="button-open-shopping-delivery-canvas">{locale === "es" ? "Empezar" : "Start"}</button>
            </div>
          )}
        </section>
      )}

      <section className="mt-4 rounded-[22px] border border-[#D8B4FE] bg-white p-4 shadow-[0_14px_34px_rgba(107,33,168,0.12)]" data-testid="shopping-voice-guide">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
            <Mic size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-body text-[20px] font-extrabold leading-tight text-vyva-text-1">
              {copy.voiceTitle}
            </h2>
            <p className="mt-1 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
              {copy.voiceBody}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={startVoiceInput}
            className={`vyva-tap inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] px-4 py-3 font-body text-[16px] font-extrabold ${
              voiceStatus === "listening" ? "bg-[#FEF2F2] text-[#B91C1C]" : "bg-vyva-purple text-white"
            }`}
            data-testid="button-shopping-voice"
          >
            <Mic size={19} />
            {voiceStatus === "listening" ? copy.voiceListening : copy.voiceAsk}
          </button>
          <button
            type="button"
            onClick={readShoppingSummary}
            className="vyva-tap inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] border border-vyva-border bg-[#FFFCF8] px-4 py-3 font-body text-[16px] font-extrabold text-vyva-text-1"
            data-testid="button-shopping-read-summary"
          >
            {isSpeaking ? <VolumeX size={19} /> : <Volume2 size={19} />}
            {isSpeaking ? copy.stopReading : copy.readSummary}
          </button>
        </div>
        {voiceStatus === "captured" && (
          <p className="mt-3 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[13px] font-bold text-[#0A7C4E]" role="status">
            {copy.voiceCaptured}
          </p>
        )}
      </section>

      <section className="mt-4" data-testid="shopping-mode-picker">
        <h2 className="font-body text-[15px] font-black uppercase tracking-[0.08em] text-vyva-purple">
          {copy.modesTitle}
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {SHOPPING_MODES.map((mode) => {
            const selected = mode.id === activeMode;
            const Icon = mode.Icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => applyShoppingMode(mode)}
                aria-pressed={selected}
                className={`vyva-tap flex min-h-[84px] items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                  selected ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-white"
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${
                  selected ? "bg-vyva-purple text-white" : "bg-[#F5F3FF] text-vyva-purple"
                }`}>
                  <Icon size={21} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1">
                    {mode.label[locale]}
                  </span>
                  <span className="sr-only">
                    {mode.body[locale]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeMode === "check" && (
        <section id="shopping-product-check" className="mt-4 scroll-mt-[88px] rounded-[20px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_12px_28px_rgba(15,118,110,0.08)]" data-testid="shopping-safety-check">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#0F766E]">
              <ShieldCheck size={23} />
            </div>
            <div className="min-w-0">
              <h2 className="font-body text-[19px] font-extrabold leading-tight text-vyva-text-1">
                {copy.safetyCheckTitle}
              </h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                {copy.safetyCheckBody}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label htmlFor="shopping-product-check-text" className="font-body text-[15px] font-extrabold text-vyva-text-1">
              {copy.safetyCheckLabel}
            </label>
            <Textarea
              id="shopping-product-check-text"
              value={checkText}
              onChange={(event) => setCheckText(event.target.value)}
              placeholder={copy.safetyCheckPlaceholder}
              className="min-h-[86px] rounded-[14px] border-[#99F6E4] bg-white p-4 font-body text-[16px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-body text-[14px] font-extrabold text-vyva-text-1">
                {copy.safetySellerLabel}
                <input
                  value={checkSeller}
                  onChange={(event) => setCheckSeller(event.target.value)}
                  placeholder={copy.safetySellerPlaceholder}
                  className="mt-2 h-12 w-full rounded-[14px] border border-[#99F6E4] bg-white px-3 font-body text-[15px] text-vyva-text-1 placeholder:text-vyva-text-3"
                />
              </label>
              <label className="block font-body text-[14px] font-extrabold text-vyva-text-1">
                {copy.safetyPriceLabel}
                <input
                  value={checkPrice}
                  onChange={(event) => setCheckPrice(event.target.value)}
                  placeholder={copy.safetyPricePlaceholder}
                  inputMode="decimal"
                  className="mt-2 h-12 w-full rounded-[14px] border border-[#99F6E4] bg-white px-3 font-body text-[15px] text-vyva-text-1 placeholder:text-vyva-text-3"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={runSafetyCheck}
              className="vyva-tap inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 py-3 font-body text-[16px] font-extrabold text-white"
              data-testid="button-shopping-safety-check"
            >
              <ClipboardCheck size={19} />
              {copy.safetyCheckButton}
            </button>
          </div>

          {safetyResult && (
            <div className="mt-4 rounded-[16px] bg-white p-4" data-testid="shopping-safety-result">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-body text-[15px] font-black text-vyva-text-1">
                  {copy.safetyResultTitle}
                </span>
                <span className={`rounded-full px-2.5 py-1 font-body text-[12px] font-black ${
                  safetyResult.verdict === "good"
                    ? "bg-[#ECFDF5] text-[#0A7C4E]"
                    : safetyResult.verdict === "check"
                      ? "bg-[#FFF7ED] text-[#9A3412]"
                      : "bg-[#FEF2F2] text-[#B91C1C]"
                }`}>
                  {safetyResult.label}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {safetyResult.reasons.map((reason) => (
                  <p key={reason} className="flex gap-2 rounded-[12px] bg-[#F8F4EF] px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#0F766E]" />
                    <span>{reason}</span>
                  </p>
                ))}
              </div>
              <p className="mt-3 rounded-[12px] bg-[#F0FDFA] px-3 py-2 font-body text-[14px] font-bold leading-relaxed text-vyva-text-1">
                <span className="font-black">{copy.safetyNextStep}: </span>
                {safetyResult.nextStep}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={applySafetyCheckAsNeed}
                  className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#99F6E4] bg-[#F0FDFA] px-4 py-3 font-body text-[15px] font-extrabold text-[#0F766E]"
                >
                  <Search size={17} />
                  {copy.useAsNeed}
                </button>
                <button
                  type="button"
                  onClick={requestSafetyResultReview}
                  className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#D8B4FE] bg-[#F5F3FF] px-4 py-3 font-body text-[15px] font-extrabold text-vyva-purple"
                >
                  <UserCheck size={17} />
                  {copy.careReview}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeRoutePackage && (
        <section
          className="mt-4 rounded-[20px] border border-[#D8B4FE] bg-white p-4 shadow-[0_14px_34px_rgba(107,33,168,0.12)]"
          data-testid="shopping-support-packages"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
              <PackageCheck size={23} />
            </div>
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                {copy.packageTitle}
              </p>
              <p className="mt-1 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
                {copy.packageBody}
              </p>
              {sourceRecommendation && (
                <p className="mt-2 rounded-[14px] bg-[#FFFCF8] px-3 py-2 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {copy.packageSource}: {sourceRecommendation}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="list">
            {supportPackages.map((packageDefinition) => {
              const selected = packageDefinition.id === routePackageId;
              return (
                <button
                  key={packageDefinition.id}
                  type="button"
                  onClick={() => applySupportPackage(packageDefinition)}
                  aria-pressed={selected}
                  data-testid={`button-shopping-package-${packageDefinition.id}`}
                  className={`vyva-tap flex min-h-[136px] flex-col items-start rounded-[16px] border px-3 py-3 text-left transition ${
                    selected ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF8]"
                  }`}
                >
                  <span className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                    {packageDefinition.label[locale]}
                  </span>
                  <span className="sr-only">
                    {packageDefinition.description[locale]}
                  </span>
                  <span className={`mt-2 rounded-full px-2 py-1 font-body text-[11px] font-black ${
                    packageDefinition.serviceRequest ? "bg-[#EEF2FF] text-[#4338CA]" : "bg-[#F0FDFA] text-[#0F766E]"
                  }`}>
                    {packageDefinition.serviceRequest ? copy.packageServiceNotice : copy.packageNoCheckout}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 font-body text-[13px] font-black text-vyva-purple">
                    {packageDefinition.ctaLabel[locale]}
                    <ChevronRight size={15} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} className="mt-4 rounded-[18px] border border-vyva-border bg-white p-4 shadow-[0_10px_24px_rgba(60,38,20,0.08)]">
        <label htmlFor="shopping-need" className="font-body text-[17px] font-extrabold text-vyva-text-1">
          {copy.needLabel}
        </label>
        <Textarea
          id="shopping-need"
          value={needText}
          onChange={(event) => setNeedText(event.target.value)}
          placeholder={copy.needPlaceholder}
          className="mt-3 min-h-[92px] rounded-[14px] border-vyva-border bg-[#FFFCF8] p-4 font-body text-[17px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
        />

        <div className="mt-4">
          <h2 className="font-body text-[15px] font-extrabold text-vyva-text-1">
            {copy.categoryTitle}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const selected = option.id === category;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategory(option.id)}
                  aria-pressed={selected}
                  className={`vyva-tap flex min-h-[46px] min-w-[132px] flex-1 items-center gap-2 rounded-[14px] border px-3 py-2 text-left ${
                    selected ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF8]"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] font-body text-[14px] font-black ${
                    selected ? "bg-vyva-purple text-white" : "bg-white text-vyva-purple"
                  }`}>
                    {option.icon}
                  </span>
                  <span className="min-w-0 font-body text-[14px] font-extrabold leading-tight text-vyva-text-1">
                    {categoryLabel(option.id, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="mt-4 rounded-[16px] border border-[#EDE2D1] bg-[#FFFCF8] p-3" data-testid="shopping-personal-needs">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F5F3FF] text-vyva-purple">
              <UserCheck size={17} />
            </div>
            <div>
              <h2 className="font-body text-[15px] font-extrabold leading-tight text-vyva-text-1">
                {copy.personalTitle}
              </h2>
              <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                {copy.personalBody}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERSONAL_NEED_OPTIONS.map((option) => {
              const selected = profileNeeds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleProfileNeed(option.id)}
                  aria-pressed={selected}
                  className={`vyva-tap min-h-[42px] rounded-[13px] border px-3 py-2 font-body text-[13px] font-extrabold ${
                    selected ? "border-vyva-purple bg-vyva-purple text-white" : "border-vyva-border bg-white text-vyva-text-1"
                  }`}
                >
                  {option.label[locale]}
                </button>
              );
            })}
          </div>
        </section>

        <Button
          type="submit"
          disabled={loading}
          className="vyva-primary-action mt-4 h-auto w-full rounded-[16px] py-4 text-[18px] shadow-[0_12px_26px_rgba(107,33,168,0.22)] hover:bg-vyva-purple/90"
          data-testid="button-shopping-find"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          {loading ? copy.loading : copy.find}
        </Button>

        {error && (
          <p role="alert" className="mt-3 rounded-[14px] border border-[#FED7AA] bg-[#FFFCF7] px-3 py-2 font-body text-[14px] font-semibold leading-relaxed text-[#9A3412]">
            {error}
          </p>
        )}

        <div className="mt-4">
          <p className="font-body text-[12px] font-black uppercase text-vyva-text-2">
            {copy.tryIdeas}
          </p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {IDEA_CHIPS.map((idea) => (
              <button
                key={idea.en}
                type="button"
                onClick={() => applyIdea(idea)}
                className="vyva-tap flex min-w-[168px] items-center justify-between gap-2 rounded-[14px] border border-vyva-border bg-[#FFFCF8] px-3 py-2 text-left font-body text-[13px] font-bold leading-snug text-vyva-text-1"
              >
                <span>{locale === "es" ? idea.es : idea.en}</span>
                <ChevronRight size={16} className="shrink-0 text-vyva-purple" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPreferencesOpen((open) => !open)}
          aria-expanded={preferencesOpen}
          className="vyva-tap mt-4 flex w-full items-center justify-between gap-3 rounded-[14px] border border-vyva-border bg-[#FFFCF8] px-3 py-2.5 text-left font-body text-[14px] font-extrabold text-vyva-text-1"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-vyva-purple" />
            {locale === "es" ? "Mas preferencias" : "More preferences"}
          </span>
          <ChevronRight size={18} className={`shrink-0 text-vyva-purple transition-transform ${preferencesOpen ? "rotate-90" : ""}`} />
        </button>

        {preferencesOpen && (
          <div className="mt-3 rounded-[14px] border border-vyva-border bg-[#FFFCF8] p-3">
            <h2 className="font-body text-[15px] font-extrabold text-vyva-text-1">
              {copy.prioritiesTitle}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((option) => {
                const selected = priorities.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => togglePriority(option.id)}
                    aria-pressed={selected}
                    className={`vyva-tap min-h-[44px] rounded-[12px] border px-3 py-2 font-body text-[14px] font-extrabold ${
                      selected ? "border-vyva-purple bg-vyva-purple text-white" : "border-vyva-border bg-white text-vyva-text-1"
                    }`}
                  >
                    {locale === "es" ? option.es : option.en}
                  </button>
                );
              })}
            </div>

            <label htmlFor="shopping-constraints" className="mt-4 block font-body text-[15px] font-extrabold text-vyva-text-1">
              {copy.constraintsLabel}
            </label>
            <Textarea
              id="shopping-constraints"
              value={constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              placeholder={copy.constraintsPlaceholder}
              className="mt-2 min-h-[70px] rounded-[12px] border-vyva-border bg-white p-3 font-body text-[15px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
            />
          </div>
        )}
      </form>

      <section ref={resultsRef} className="mt-5 scroll-mt-[88px]" aria-live="polite">
        {!result && !loading && (
          <div className="rounded-[18px] border border-vyva-border bg-white p-4 text-center shadow-[0_8px_20px_rgba(60,38,20,0.06)]">
            <Sparkles size={28} className="mx-auto text-vyva-purple" />
            <h2 className="mt-2 font-body text-[18px] font-extrabold text-vyva-text-1">{copy.emptyTitle}</h2>
            <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">{copy.emptyBody}</p>
          </div>
        )}

        {result && result.recommendations.length === 0 && (
          <div className="rounded-[18px] border border-[#FDBA74] bg-[#FFF7ED] p-4">
            <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">{result.querySummary}</h2>
            <p className="mt-2 font-body text-[15px] leading-relaxed text-[#9A3412]">{result.uncertaintyNote}</p>
            <div className="mt-3 grid gap-2">
              {result.nextQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => applyFollowUpQuestion(question)}
                  className="vyva-tap flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2 text-left font-body text-[14px] font-semibold text-vyva-text-1"
                >
                  <span>{question}</span>
                  <ChevronRight size={16} className="shrink-0 text-vyva-purple" />
                </button>
              ))}
            </div>
          </div>
        )}

        {result && result.recommendations.length > 0 && (
          <>
            <div className="mb-3">
              <h2 className="font-display text-[24px] italic leading-tight text-vyva-text-1">{copy.resultsTitle}</h2>
              <p className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                {result.querySummary}
              </p>
            </div>
            <div className="grid gap-3" data-testid="shopping-recommendation-results">
              {result.recommendations.map((item) => (
                <RecommendationCard
                  key={item.product.id}
                  item={item}
                  locale={locale}
                  copy={copy}
                  saved={savedIds.includes(item.product.id)}
                  onToggleSave={() => toggleSaved(item.product.id)}
                  onCareReview={() => requestRecommendationReview(item)}
                />
              ))}
            </div>

            <section className="mt-4 rounded-[18px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_8px_20px_rgba(15,118,110,0.08)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#0F766E]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">
                    {copy.compareTitle}
                  </h2>
                  <p className="mt-1 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">
                    {result.comparison.summary}
                  </p>
                </div>
              </div>
              {result.comparison.differences.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {result.comparison.differences.map((line) => (
                    <p key={line} className="rounded-[12px] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-3 rounded-[12px] bg-white/80 px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-[#0F766E]">
                {result.uncertaintyNote}
              </p>
              <div className="mt-3 grid gap-2 rounded-[16px] bg-white p-3">
                <p className="font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                  {copy.prepareRequestBody}
                </p>
                <button
                  type="button"
                  onClick={requestComparisonReview}
                  className="vyva-tap inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#0F766E] px-4 py-3 font-body text-[16px] font-extrabold text-white shadow-[0_10px_22px_rgba(15,118,110,0.18)]"
                  data-testid="button-shopping-prepare-request"
                >
                  <ClipboardCheck size={18} />
                  {copy.prepareRequest}
                </button>
              </div>
            </section>
          </>
        )}
      </section>

      {savedRecommendations.length > 0 && (
        <section className="mt-4 rounded-[18px] border border-vyva-border bg-white p-4 shadow-[0_8px_20px_rgba(60,38,20,0.06)]" data-testid="shopping-shortlist">
          <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">
            {copy.shortlistTitle}
          </h2>
          <div className="mt-3 grid gap-2">
            {savedRecommendations.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 rounded-[14px] bg-[#FFFCF8] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F5F3FF] font-body font-black text-vyva-purple">
                  {item.product.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[15px] font-extrabold text-vyva-text-1">{item.product.name}</p>
                  <p className="font-body text-[12px] font-semibold text-vyva-text-2">{item.product.priceLabel}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 rounded-[16px] border border-vyva-border bg-[#FFFCF8] p-4 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
        {copy.caveat}
      </p>
    </main>
  );
};

export default ConciergeShoppingScreen;
