import { useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarDays, Car, Check, ClipboardList, HeartPulse, Loader2, ShieldCheck, ShoppingBasket, Sparkles, Stethoscope, Users } from "lucide-react";

type SharedCheckinResult = {
  feeling_label?: string;
  overall_state?: "excellent" | "good" | "moderate" | "tired" | "low";
  vyva_reading?: string;
  why_today?: string | null;
  trend_note?: string | null;
  personal_plan?: string | null;
  app_suggestion?: string | null;
  right_now?: string[];
  today_actions?: string[];
  highlight?: string;
  flag_caregiver?: boolean;
  watch_for?: string | null;
};

type SharedCheckinPayload = {
  report: {
    name?: string;
    language?: string;
    result?: SharedCheckinResult;
    text?: string;
  };
  created_at?: string;
  expires_at?: string;
};

type SharedCheckinServiceAction = {
  key: "doctor_help" | "appointment" | "ride" | "order" | "quote";
  label: string;
  description: string;
  to: "/health/doctor" | "/concierge" | "/concierge/shopping";
  state: unknown;
};

const toneStyles: Record<string, { bg: string; border: string; text: string; label: string }> = {
  excellent: { bg: "#ECFDF5", border: "#BBF7D0", text: "#047857", label: "Muy bien" },
  good: { bg: "#F0FDF4", border: "#BBF7D0", text: "#047857", label: "Estable" },
  moderate: { bg: "#F5F3FF", border: "#DDD6FE", text: "#6B21A8", label: "Atencion suave" },
  tired: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", label: "Cuidar el ritmo" },
  low: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C", label: "Atencion importante" },
};

function formatSharedDate(value?: string, language = "es") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function listItems(items?: string[]) {
  return (items ?? []).filter(Boolean).slice(0, 4);
}

function normalizeSharedText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function sharedCheckinContext(result: SharedCheckinResult, name: string, language = "es") {
  const rightNow = listItems(result.right_now).map((item) => `- ${item}`).join("\n");
  const today = listItems(result.today_actions).map((item) => `- ${item}`).join("\n");

  return [
    language === "es" ? `Informe VYVA compartido para ${name}` : `Shared VYVA report for ${name}`,
    result.feeling_label ? `Status: ${result.feeling_label}` : "",
    result.vyva_reading ? `Reading: ${result.vyva_reading}` : "",
    result.highlight ? `Important: ${result.highlight}` : "",
    result.watch_for ? `Watch for: ${result.watch_for}` : "",
    rightNow ? `Right now:\n${rightNow}` : "",
    today ? `For today:\n${today}` : "",
  ].filter(Boolean).join("\n");
}

export function sharedCheckinServiceActionsFor(result: SharedCheckinResult, name: string, language = "es"): SharedCheckinServiceAction[] {
  const text = normalizeSharedText([
    result.feeling_label ?? "",
    result.vyva_reading ?? "",
    result.highlight ?? "",
    result.watch_for ?? "",
    result.app_suggestion ?? "",
    ...(result.right_now ?? []),
    ...(result.today_actions ?? []),
  ].join(" "));
  const needsCare =
    Boolean(result.flag_caregiver || result.watch_for)
    || /\b(doctor|medic|medical|clinician|clinic|hospital|urgent|emergency|chest|pain|breath|fall|faint|confusion|medico|medica|clinica|hospital|urgente|emergencia|pecho|dolor|respirar|caida|confusion)\b/.test(text);
  const needsOrder = /\b(hydrat|water|fluids|electrolyte|pharmacy|delivery|groceries|order|agua|liquidos|electrolitos|farmacia|entrega|compra|pedido|domicilio)\b/.test(text);
  const needsQuote = /\b(someone stay|stay with you|not be alone|home care|home help|support at home|companion|quote|acompan|no estar solo|no estes solo|ayuda en casa|apoyo en casa|cuidador|cuidadora|presupuesto)\b/.test(text);

  if (!needsCare && !needsOrder && !needsQuote) return [];

  const context = sharedCheckinContext(result, name, language);
  const isSpanish = language.startsWith("es");
  const actions: SharedCheckinServiceAction[] = [];
  if (needsCare) {
    actions.push({
      key: "doctor_help",
      label: isSpanish ? "Hablar con doctor" : "Doctor help",
      description: isSpanish ? "Abrir ayuda medica con este informe." : "Open doctor support with this report.",
      to: "/health/doctor",
      state: {
        autoStartVoice: true,
        latestSymptomReport: context,
        source: "shared_checkin",
      },
    });
    actions.push({
      key: "appointment",
      label: isSpanish ? "Pedir cita" : "Book appointment",
      description: isSpanish ? "Preparar una cita para confirmar." : "Prepare an appointment to confirm.",
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: isSpanish
            ? `Ayudame a preparar una cita de atencion basada en este informe compartido de VYVA. Confirma conmigo antes de reservar.\n\n${context}`
            : `Please help me schedule a care appointment based on this shared VYVA report. Ask me to confirm before booking.\n\n${context}`,
          source: "shared_checkin",
        },
      },
    });
    actions.push({
      key: "ride",
      label: isSpanish ? "Buscar transporte" : "Find transport",
      description: isSpanish ? "Comparar opciones seguras si hace falta." : "Compare safe transport options if needed.",
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "ride",
          message: isSpanish
            ? `Ayudame a preparar transporte seguro para atencion basada en este informe compartido de VYVA. Confirma conmigo antes de reservar.\n\n${context}`
            : `Please help me find safe transport options for care based on this shared VYVA report. Ask me to confirm before contacting anyone.\n\n${context}`,
          source: "shared_checkin",
        },
      },
    });
  }

  if (needsOrder) {
    actions.push({
      key: "order",
      label: isSpanish ? "Pedir entrega" : "Order delivery",
      description: isSpanish ? "Preparar compra o farmacia a domicilio." : "Prepare grocery or pharmacy delivery.",
      to: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: isSpanish
            ? `Ayudame a preparar compra o farmacia a domicilio basada en este informe compartido de VYVA. Confirma conmigo antes de pedir o pagar.\n\n${context}`
            : `Please help me prepare grocery or pharmacy delivery based on this shared VYVA report. Ask me to confirm before ordering or paying.\n\n${context}`,
          category: "groceries",
          priorities: ["delivery", "simplicity", "safety"],
        },
      },
    });
  }

  if (needsQuote) {
    actions.push({
      key: "quote",
      label: isSpanish ? "Ayuda en casa" : "Home help",
      description: isSpanish ? "Pedir presupuesto para apoyo o compania." : "Request a quote for support or company.",
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "home_care_quote",
          message: isSpanish
            ? `Ayudame a pedir presupuesto para apoyo o compania en casa basado en este informe compartido de VYVA. Confirma conmigo antes de solicitar nada.\n\n${context}`
            : `Please help me request a quote for companion or home support based on this shared VYVA report. Ask me to confirm before requesting anything.\n\n${context}`,
          source: "shared_checkin",
        },
      },
    });
  }

  return actions;
}

const SharedCheckinReport = () => {
  const navigate = useNavigate();
  const token = window.location.pathname.split("/").pop() ?? "";
  const { data, isLoading, isError } = useQuery<SharedCheckinPayload>({
    queryKey: [`/api/checkins/shared/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/checkins/shared/${token}`);
      if (!res.ok) throw new Error("Report not found");
      return res.json();
    },
    retry: false,
  });

  const report = data?.report;
  const result = useMemo(() => report?.result ?? {}, [report?.result]);
  const language = report?.language ?? "es";
  const name = report?.name || (language === "es" ? "la persona" : "the person");
  const style = toneStyles[result.overall_state ?? "moderate"] ?? toneStyles.moderate;
  const createdLabel = formatSharedDate(data?.created_at, language);
  const title = result.feeling_label || (language === "es" ? "Lectura de bienestar VYVA" : "VYVA wellbeing reading");
  const medicalNote = language === "es"
    ? "Este informe es orientativo y no sustituye una valoracion medica."
    : "This report is for guidance and does not replace medical assessment.";
  const serviceActions = useMemo(
    () => sharedCheckinServiceActionsFor(result, name, language),
    [language, name, result],
  );

  const summaryCards = useMemo(() => {
    return [
      result.highlight ? { label: language === "es" ? "Lo importante" : "Important", text: result.highlight, icon: <Sparkles size={22} />, tone: "purple" } : null,
      result.why_today ? { label: language === "es" ? "Por que hoy" : "Why today", text: result.why_today, icon: <ClipboardList size={22} />, tone: "soft" } : null,
      result.personal_plan ? { label: language === "es" ? "Plan adaptado" : "Personal plan", text: result.personal_plan, icon: <ShieldCheck size={22} />, tone: "green" } : null,
    ].filter(Boolean) as Array<{ label: string; text: string; icon: ReactNode; tone: string }>;
  }, [language, result.highlight, result.personal_plan, result.why_today]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-6">
        <div className="rounded-[30px] bg-white p-8 text-center shadow-[0_18px_48px_rgba(63,45,35,0.12)]">
          <Loader2 className="mx-auto mb-4 animate-spin text-vyva-purple" size={36} />
          <p className="font-body text-[19px] font-semibold text-vyva-text-2">Preparando informe...</p>
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-6">
        <div className="max-w-[520px] rounded-[32px] border border-vyva-border bg-white p-8 text-center shadow-[0_18px_48px_rgba(63,45,35,0.12)]">
          <AlertTriangle className="mx-auto mb-4 text-[#B91C1C]" size={42} />
          <h1 className="font-display text-[34px] leading-tight text-vyva-text-1">Informe no disponible</h1>
          <p className="mt-3 font-body text-[18px] leading-relaxed text-vyva-text-2">
            El enlace puede haber caducado o no ser correcto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#FFF7ED_0%,transparent_35%),linear-gradient(180deg,#FAF7F2_0%,#F6EFE7_100%)] px-4 py-6">
      <article className="mx-auto max-w-[760px] overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_22px_70px_rgba(63,45,35,0.14)]">
        <header className="relative overflow-hidden bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFF7ED] p-7">
          <div className="absolute right-[-48px] top-[-48px] h-36 w-36 rounded-full bg-vyva-purple/10" />
          <div className="relative mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[28px] bg-white text-vyva-purple shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
            <HeartPulse size={38} />
          </div>
          <p className="relative font-body text-[14px] font-bold uppercase tracking-[0.16em] text-vyva-purple">
            Informe VYVA
          </p>
          <h1 className="relative mt-2 font-display text-[42px] leading-tight text-vyva-text-1">{title}</h1>
          <div className="relative mt-4 flex flex-wrap items-center gap-3 font-body text-[16px] text-vyva-text-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold">
              <CalendarDays size={18} />
              {createdLabel || "Hoy"}
            </span>
            <span className="rounded-full px-4 py-2 font-bold" style={{ background: style.bg, color: style.text }}>
              {style.label}
            </span>
          </div>
          <p className="relative mt-5 font-body text-[22px] leading-relaxed text-vyva-text-2">
            Lectura preparada para <strong className="text-vyva-text-1">{name}</strong>.
          </p>
        </header>

        <section className="grid gap-4 p-5 sm:p-7">
          {result.watch_for && (
            <section className="rounded-[28px] border border-[#FECACA] bg-[#FEF2F2] p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#B91C1C]">
                  <AlertTriangle size={25} />
                </span>
                <div>
                  <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-[#B91C1C]">
                    Atencion
                  </p>
                  <p className="mt-2 font-body text-[20px] font-semibold leading-relaxed text-vyva-text-1">{result.watch_for}</p>
                </div>
              </div>
            </section>
          )}

          {result.vyva_reading && (
            <section className="rounded-[28px] border border-vyva-border bg-[#FAF9F6] p-5">
              <p className="font-body text-[21px] leading-relaxed text-vyva-text-1">{result.vyva_reading}</p>
            </section>
          )}

          {summaryCards.map((card) => (
            <section
              key={card.label}
              className={`rounded-[28px] border p-5 ${
                card.tone === "green"
                  ? "border-[#BBF7D0] bg-[#ECFDF5]"
                  : card.tone === "purple"
                    ? "border-[#DDD6FE] bg-[#F5F3FF]"
                    : "border-vyva-border bg-white"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-vyva-purple shadow-sm">
                  {card.icon}
                </span>
                <div>
                  <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">{card.label}</p>
                  <p className="mt-2 font-body text-[20px] leading-relaxed text-vyva-text-1">{card.text}</p>
                </div>
              </div>
            </section>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <ReportList title={language === "es" ? "Ahora mismo" : "Right now"} items={listItems(result.right_now)} />
            <ReportList title={language === "es" ? "Para hoy" : "For today"} items={listItems(result.today_actions)} />
          </div>

          {result.app_suggestion && (
            <section className="rounded-[28px] border border-[#FED7AA] bg-[#FFF7ED] p-5">
              <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-[#9A3412]">
                Siguiente paso
              </p>
              <p className="mt-2 font-body text-[20px] leading-relaxed text-vyva-text-1">{result.app_suggestion}</p>
            </section>
          )}

          {serviceActions.length > 0 && (
            <section className="rounded-[28px] border border-[#DDD6FE] bg-[#F8F5FF] p-5" data-testid="shared-checkin-service-actions">
              <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">
                {language === "es" ? "Acceso rapido a servicios" : "Fast service access"}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {serviceActions.map((action) => {
                  const Icon = action.key === "doctor_help" ? Stethoscope : action.key === "appointment" ? CalendarDays : action.key === "ride" ? Car : action.key === "order" ? ShoppingBasket : Users;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      data-testid={`button-shared-checkin-service-${action.key}`}
                      onClick={() => navigate(action.to, { state: action.state })}
                      className="vyva-tap flex min-h-[96px] flex-col items-start justify-center gap-2 rounded-[20px] border border-white bg-white px-4 py-3 text-left shadow-[0_8px_22px_rgba(107,33,168,0.10)]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-vyva-purple text-white">
                        <Icon size={19} />
                      </span>
                      <span className="font-body text-[16px] font-black leading-tight text-vyva-text-1">{action.label}</span>
                      <span className="sr-only">{action.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <footer className="rounded-[24px] border border-vyva-border bg-white p-5 font-body text-[16px] leading-relaxed text-vyva-text-2">
            {medicalNote}
          </footer>
        </section>
      </article>
    </main>
  );
};

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[28px] border border-vyva-border bg-white p-5">
      <p className="mb-4 font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">{title}</p>
      <div className="grid gap-3">
        {items.length ? items.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-[18px] bg-[#FAF9F6] p-3">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-white">
              <Check size={17} />
            </span>
            <p className="font-body text-[17px] leading-relaxed text-vyva-text-1">{item}</p>
          </div>
        )) : (
          <p className="font-body text-[17px] text-vyva-text-2">Sin acciones añadidas.</p>
        )}
      </div>
    </section>
  );
}

export default SharedCheckinReport;
