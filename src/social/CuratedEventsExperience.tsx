import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookmarkCheck,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Languages,
  MapPin,
  Monitor,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import type {
  ParticipationEvent,
  ParticipationEventFormat,
  ParticipationEventRecommendation,
  ParticipationEventResponseAction,
  ParticipationPulse,
  SocialLanguage,
} from "./types";

type PulseResponse = {
  pulse: ParticipationPulse;
};

type RespondInput = {
  eventId: string;
  response: ParticipationEventResponseAction;
};

type CuratedEventsVariant = "activities" | "participate";
type EventFilter = "for_you" | "nearby" | "online" | "saved";

type CuratedEventsExperienceProps = {
  variant?: CuratedEventsVariant;
  afterEvents?: ReactNode;
};

function participationLanguage(language?: string | null): SocialLanguage {
  const base = language?.split("-")[0]?.toLowerCase();
  if (base === "es" || base === "de") return base;
  return "en";
}

const copyByLanguage: Record<SocialLanguage, {
  back: string;
  loading: string;
  error: string;
  activitiesHeadline: string;
  longevityNearbyHeadline: string;
  longevityNearbyReassurance: string;
  featured: string;
  forYou: string;
  nearby: string;
  online: string;
  saved: string;
  savedTitle: string;
  savedEmpty: string;
  interested: string;
  maybe: string;
  notForMe: string;
  askVyva: string;
  interestedSaved: string;
  maybeSaved: string;
  notForMeSaved: string;
  checkRequested: string;
  profileSignalTitle: string;
  secondaryTitle: string;
  nearbyTitle: string;
  onlineTitle: string;
  savedFilterTitle: string;
  emptyFilter: string;
  inPerson: string;
  hybrid: string;
  dateTbc: string;
  confirmFirst: string;
  responseCounts: (interested: number, maybe: number) => string;
}> = {
  es: {
    back: "Volver",
    loading: "Preparando actividades...",
    error: "No se pudieron cargar las actividades. Intentalo de nuevo.",
    activitiesHeadline: "Para ti",
    longevityNearbyHeadline: "Ideas cerca de ti",
    longevityNearbyReassurance: "VYVA busca paseos suaves, programas locales y actividades con apoyo cerca de casa.",
    featured: "Sugerido",
    forYou: "Para ti",
    nearby: "Cerca",
    online: "Online",
    saved: "Guardado",
    savedTitle: "Guardado",
    savedEmpty: "Tus opciones guardadas apareceran aqui.",
    interested: "Me interesa",
    maybe: "Quizas",
    notForMe: "No es para mi",
    askVyva: "Comprobar",
    interestedSaved: "Interes guardado",
    maybeSaved: "Guardado para luego",
    notForMeSaved: "No se mostrara primero",
    checkRequested: "Comprobacion pedida",
    profileSignalTitle: "Basado en",
    secondaryTitle: "Mas",
    nearbyTitle: "Cerca",
    onlineTitle: "Opciones online",
    savedFilterTitle: "Guardado",
    emptyFilter: "No hay opciones aqui todavia.",
    inPerson: "En persona",
    hybrid: "Ambos",
    dateTbc: "Fecha por confirmar",
    confirmFirst: "Tu confirmas primero",
    responseCounts: (interested, maybe) => `${interested} interesados - ${maybe} quizas`,
  },
  de: {
    back: "Zurueck",
    loading: "Aktivitaeten werden vorbereitet...",
    error: "Aktivitaeten konnten nicht geladen werden. Bitte versuche es erneut.",
    activitiesHeadline: "Fuer dich",
    longevityNearbyHeadline: "Ideen in deiner Naehe",
    longevityNearbyReassurance: "VYVA sucht ruhige Spaziergaenge, lokale Programme und passende Aktivitaeten in deiner Naehe.",
    featured: "Vorschlag",
    forYou: "Fuer dich",
    nearby: "In der Naehe",
    online: "Online",
    saved: "Gespeichert",
    savedTitle: "Gespeichert",
    savedEmpty: "Gespeicherte Optionen erscheinen hier.",
    interested: "Interesse",
    maybe: "Vielleicht",
    notForMe: "Nein danke",
    askVyva: "Pruefen",
    interestedSaved: "Interesse gespeichert",
    maybeSaved: "Fuer spaeter gespeichert",
    notForMeSaved: "Wird nicht zuerst gezeigt",
    checkRequested: "Pruefung angefragt",
    profileSignalTitle: "Basierend auf",
    secondaryTitle: "Mehr",
    nearbyTitle: "In der Naehe",
    onlineTitle: "Online",
    savedFilterTitle: "Gespeichert",
    emptyFilter: "Hier gibt es noch keine Optionen.",
    inPerson: "Vor Ort",
    hybrid: "Beides",
    dateTbc: "Datum offen",
    confirmFirst: "Du bestaetigst zuerst",
    responseCounts: (interested, maybe) => `${interested} interessiert - ${maybe} vielleicht`,
  },
  en: {
    back: "Back",
    loading: "Preparing activities...",
    error: "Activities could not load. Please try again.",
    activitiesHeadline: "For you",
    longevityNearbyHeadline: "Nearby ideas",
    longevityNearbyReassurance: "VYVA looks for gentle walks, local programs, and social activities close to home.",
    featured: "Suggested",
    forYou: "For you",
    nearby: "Nearby",
    online: "Online",
    saved: "Saved",
    savedTitle: "Saved",
    savedEmpty: "Saved options will appear here.",
    interested: "Interested",
    maybe: "Maybe",
    notForMe: "No thanks",
    askVyva: "Check",
    interestedSaved: "Interest saved",
    maybeSaved: "Saved for later",
    notForMeSaved: "This will not be shown first",
    checkRequested: "Check requested",
    profileSignalTitle: "Based on",
    secondaryTitle: "More",
    nearbyTitle: "Nearby",
    onlineTitle: "Online",
    savedFilterTitle: "Saved",
    emptyFilter: "No options here yet.",
    inPerson: "In person",
    hybrid: "Both",
    dateTbc: "Date TBC",
    confirmFirst: "You confirm first",
    responseCounts: (interested, maybe) => `${interested} interested - ${maybe} maybe`,
  },
};

type CuratedActivitiesCopy = (typeof copyByLanguage)[SocialLanguage];

function uniqueEvents<T extends ParticipationEvent>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function updateEventChoice(
  pulse: ParticipationPulse,
  eventId: string,
  response: ParticipationEventResponseAction,
): ParticipationPulse {
  const myResponse = response === "clear" ? null : response;
  const updateEvent = <T extends ParticipationEvent>(event: T): T => {
    if (event.id !== eventId) return event;
    return { ...event, myResponse } as T;
  };
  const featuredEvent = updateEvent(pulse.featuredEvent);
  const recommendations = pulse.recommendations.map(updateEvent);
  const savedEvents = uniqueEvents([
    featuredEvent,
    ...recommendations,
    ...pulse.savedEvents.map(updateEvent),
  ]).filter((event) => event.myResponse === "interested" || event.myResponse === "maybe");

  return {
    ...pulse,
    featuredEvent,
    recommendations,
    savedEvents,
  };
}

function responseLabel(event: ParticipationEvent, copy: CuratedActivitiesCopy) {
  if (event.myResponse === "interested") return copy.interestedSaved;
  if (event.myResponse === "maybe") return copy.maybeSaved;
  if (event.myResponse === "not_for_me") return copy.notForMeSaved;
  if (event.checkStatus === "requested") return copy.checkRequested;
  return "";
}

function eventFormatLabel(format: ParticipationEventFormat, copy: CuratedActivitiesCopy) {
  if (format === "online") return copy.online;
  if (format === "hybrid") return copy.hybrid;
  return copy.inPerson;
}

function splitQueryValues(values: string[]): string[] {
  return values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

function uniqueQueryValues(values: string[]): string[] {
  return Array.from(new Set(splitQueryValues(values)));
}

function initialFilterFromSearch(params: URLSearchParams): EventFilter {
  const filter = (params.get("filter") ?? params.get("format") ?? "").trim().toLowerCase();
  if (filter === "nearby" || filter === "online" || filter === "saved") return filter;
  if (filter === "for_you" || filter === "for-you") return "for_you";

  const source = (params.get("source") ?? "").trim().toLowerCase();
  const intent = (params.get("intent") ?? "").trim().toLowerCase();
  if (source === "longevity" && intent.includes("nearby")) return "nearby";
  return "for_you";
}

function participationPulseUrl(language: SocialLanguage, params: URLSearchParams): string {
  const query = new URLSearchParams({ lang: language });
  const interests = uniqueQueryValues([...params.getAll("interests"), ...params.getAll("interest")]);
  const preferredTimes = uniqueQueryValues([...params.getAll("preferredTimes"), ...params.getAll("time")]);
  const city = params.get("city")?.trim();
  const region = params.get("region")?.trim();
  const countryCode = (params.get("countryCode") ?? params.get("country"))?.trim();

  if (interests.length > 0) query.set("interests", interests.join(","));
  if (preferredTimes.length > 0) query.set("preferredTimes", preferredTimes.join(","));
  if (city) query.set("city", city);
  if (region) query.set("region", region);
  if (countryCode) query.set("countryCode", countryCode);

  return `/api/social/participate/pulse?${query.toString()}`;
}

function isLongevityNearbyCue(params: URLSearchParams): boolean {
  return (params.get("source") ?? "").trim().toLowerCase() === "longevity"
    && initialFilterFromSearch(params) === "nearby";
}

function eventDateLabel(event: ParticipationEvent, copy: CuratedActivitiesCopy, language: SocialLanguage) {
  if (!event.startsAt) return event.timeLabel || copy.dateTbc;

  const date = new Date(event.startsAt);
  if (Number.isNaN(date.getTime())) return copy.dateTbc;

  return new Intl.DateTimeFormat(language, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function SignalChip({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <span className="inline-flex min-h-[34px] items-center gap-2 rounded-full border border-[#DDE8DD] bg-white px-3 font-body text-[12px] font-black text-[#2F4A44] shadow-sm">
      <Icon size={15} strokeWidth={2.4} className="text-[#0F766E]" />
      <span className="max-w-[14rem] truncate">{label}</span>
    </span>
  );
}

function EventMetaItem({
  icon: Icon,
  label,
}: {
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 font-body text-[14px] font-black leading-tight text-[#31453F]">
      <Icon size={16} strokeWidth={2.4} className="shrink-0 text-[#0F766E]" />
      <span className="truncate">
        {label}
      </span>
    </span>
  );
}

function FitReasonLine({ reasons }: { reasons: ParticipationFitReason[] }) {
  const seen = new Set<string>();
  const highlights = reasons
    .filter((reason) => reason.kind !== "safety")
    .filter((reason) => {
      const key = reason.label.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);

  if (highlights.length === 0) return null;

  return (
    <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-[#F5FAF7] px-3 py-2.5">
      <Sparkles size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#0F766E]" />
      <p className="font-body text-[13px] font-bold leading-snug text-[#3F5750]">
        {highlights.map((reason) => reason.label).join(" · ")}
      </p>
    </div>
  );
}

function EventActionButton({
  children,
  onClick,
  tone,
  active = false,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  tone: "green" | "blue" | "plain" | "rose";
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    green: active ? "border-[#035F46] bg-[#035F46] text-white" : "border-[#047857] bg-[#047857] text-white",
    blue: active ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#E5DED3] bg-white text-vyva-text-1",
    rose: active ? "border-[#BE123C] bg-[#BE123C] text-white" : "border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]",
    plain: "border-[#E5DED3] bg-white text-vyva-text-1",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`vyva-tap flex min-h-[44px] items-center justify-center rounded-full border px-4 font-body text-[14px] font-black leading-tight shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${tones} ${className}`}
    >
      {children}
    </button>
  );
}

function EventPanel({
  event,
  copy,
  language,
  testIdPrefix,
  featured = false,
  onRespond,
  onAskVyva,
  pending = false,
}: {
  event: ParticipationEventRecommendation | ParticipationEvent;
  copy: CuratedActivitiesCopy;
  language: SocialLanguage;
  testIdPrefix: string;
  featured?: boolean;
  onRespond: (eventId: string, response: ParticipationEventResponseAction) => void;
  onAskVyva: (eventId: string) => void;
  pending?: boolean;
}) {
  const statusLabel = responseLabel(event, copy);
  const dateLabel = eventDateLabel(event, copy, language);
  const placeLabel = event.locationLabel || eventFormatLabel(event.format, copy);
  const safetyReason = event.fitReasons.find((reason) => reason.kind === "safety")?.label;

  return (
    <article
      className={`rounded-[20px] border bg-white p-5 shadow-[0_10px_26px_rgba(52,42,30,0.06)] ${featured ? "border-[#B7E4D2]" : "border-[#E8DED4]"}`}
      data-testid={featured ? `${testIdPrefix}-featured-event` : `${testIdPrefix}-event-${event.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {featured ? copy.featured : copy.forYou}
          </p>
          <h2 className="mt-1.5 font-body text-[24px] font-black leading-tight text-vyva-text-1">
            {event.title}
          </h2>
          <p className="mt-1.5 max-w-[42rem] font-body text-[15px] font-semibold leading-snug text-vyva-text-2">
            {event.summary}
          </p>
        </div>
        {statusLabel ? (
          <span className="inline-flex min-h-[34px] items-center rounded-full bg-[#F5F3FF] px-3 font-body text-[12px] font-black text-[#6B21A8]">
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[#EFE6DC] py-3">
        <EventMetaItem icon={Clock3} label={dateLabel} />
        <EventMetaItem icon={event.format === "online" ? Monitor : event.format === "hybrid" ? Sparkles : MapPin} label={placeLabel} />
        <EventMetaItem icon={ShieldCheck} label={event.costLabel} />
      </div>

      <FitReasonLine reasons={event.fitReasons} />

      {event.needsLiveCheck || safetyReason ? (
        <p className="mt-3 inline-flex items-center gap-2 font-body text-[12px] font-black text-[#7A5B1B]">
          <ShieldCheck size={15} strokeWidth={2.4} className="shrink-0" />
          {safetyReason ?? copy.confirmFirst}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-[15rem]">
          <EventActionButton
            tone="green"
            active={event.myResponse === "interested"}
            disabled={pending}
            className="w-full min-h-[50px]"
            onClick={() => onRespond(event.id, event.myResponse === "interested" ? "clear" : "interested")}
          >
            <CheckCircle2 size={18} className="mr-2" />
            {copy.interested}
          </EventActionButton>
        </div>
        <EventActionButton
          tone="plain"
          disabled={pending}
          onClick={() => onAskVyva(event.id)}
        >
          <Sparkles size={18} className="mr-2 text-[#6B21A8]" />
          {copy.askVyva}
        </EventActionButton>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <EventActionButton
            tone="blue"
            active={event.myResponse === "maybe"}
            disabled={pending}
            onClick={() => onRespond(event.id, event.myResponse === "maybe" ? "clear" : "maybe")}
          >
            <CalendarCheck size={17} className="mr-2" />
            {copy.maybe}
          </EventActionButton>
          <EventActionButton
            tone="rose"
            active={event.myResponse === "not_for_me"}
            disabled={pending}
            onClick={() => onRespond(event.id, event.myResponse === "not_for_me" ? "clear" : "not_for_me")}
          >
            <ThumbsDown size={16} className="mr-2" />
            {copy.notForMe}
          </EventActionButton>
        </div>
      </div>

    </article>
  );
}

function filterMatches(event: ParticipationEvent, filter: EventFilter) {
  if (filter === "nearby") return event.format === "nearby" || event.format === "hybrid";
  if (filter === "online") return event.format === "online" || event.format === "hybrid";
  return true;
}

function FilterButton({
  active,
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 font-body text-[14px] font-black shadow-sm transition active:scale-[0.98] ${
        active
          ? "border-[#0F766E] bg-[#0F766E] text-white"
          : "border-[#DDE8DD] bg-white text-[#2F4A44]"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

export default function CuratedEventsExperience({
  variant = "activities",
  afterEvents,
}: CuratedEventsExperienceProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { language: appLanguage } = useLanguage();
  const language = participationLanguage(appLanguage);
  const copy = copyByLanguage[language];
  const searchKey = searchParams.toString();
  const handoffFilter = initialFilterFromSearch(searchParams);
  const queryUrl = useMemo(() => participationPulseUrl(language, searchParams), [language, searchParams]);
  const queryKey = [queryUrl] as const;
  const testIdPrefix = variant === "activities" ? "activities" : "participate";
  const [activeFilter, setActiveFilter] = useState<EventFilter>(handoffFilter);
  const longevityNearbyCue = isLongevityNearbyCue(searchParams);

  useEffect(() => {
    setActiveFilter(handoffFilter);
  }, [handoffFilter, searchKey]);

  const { data, isLoading, isError } = useQuery<PulseResponse>({ queryKey });
  const pulse = data?.pulse;

  const respondMutation = useMutation({
    mutationFn: async ({ eventId, response }: RespondInput) => {
      const res = await apiFetch(`/api/social/participate/events/${eventId}/respond`, {
        method: "POST",
        body: JSON.stringify({ response, lang: language }),
      });
      if (!res.ok) throw new Error("Could not save response");
      return res.json();
    },
    onMutate: async ({ eventId, response }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PulseResponse>(queryKey);
      if (previous?.pulse) {
        queryClient.setQueryData<PulseResponse>(queryKey, {
          pulse: updateEventChoice(previous.pulse, eventId, response),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const askVyvaMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiFetch(`/api/social/participate/events/${eventId}/ask-vyva`, {
        method: "POST",
        body: JSON.stringify({ lang: language }),
      });
      if (!res.ok) throw new Error("Could not ask VYVA to check");
      return res.json() as Promise<{ conciergePrefill: unknown }>;
    },
    onSuccess: (payload) => {
      void queryClient.invalidateQueries({ queryKey });
      navigate("/concierge", {
        state: {
          conciergePrefill: payload.conciergePrefill,
        },
      });
    },
  });

  const filteredRecommendations = useMemo(() => {
    if (!pulse) return [];
    if (activeFilter === "for_you") return pulse.recommendations;
    if (activeFilter === "saved") return pulse.savedEvents;

    const allEvents = uniqueEvents([pulse.featuredEvent, ...pulse.recommendations]);
    return allEvents
      .filter((event) => event.id !== pulse.featuredEvent.id)
      .filter((event) => filterMatches(event, activeFilter));
  }, [activeFilter, pulse]);

  if (isLoading) {
    return (
      <main className="vyva-page flex min-h-[60vh] items-center justify-center">
        <p className="font-body text-[17px] font-bold text-vyva-text-2">{copy.loading}</p>
      </main>
    );
  }

  if (isError || !pulse) {
    return (
      <main className="vyva-page">
        {variant === "participate" ? (
          <button
            type="button"
            onClick={() => navigate("/social-rooms")}
            className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
          >
            <ArrowLeft size={18} />
            {copy.back}
          </button>
        ) : null}
        <section className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-5">
          <p className="font-body text-[16px] font-bold text-[#991B1B]">{copy.error}</p>
        </section>
      </main>
    );
  }

  const signalChips = [
    ...(pulse.profileSignals.locationLabel ? [{ icon: MapPin, label: pulse.profileSignals.locationLabel }] : []),
    ...pulse.profileSignals.interests.slice(0, 2).map((interest) => ({ icon: HeartHandshake, label: interest })),
    { icon: Languages, label: pulse.profileSignals.languageLabel },
  ];
  const pending = respondMutation.isPending || askVyvaMutation.isPending;
  const filteredTitle = activeFilter === "nearby"
    ? copy.nearbyTitle
    : activeFilter === "online"
      ? copy.onlineTitle
      : activeFilter === "saved"
        ? copy.savedFilterTitle
        : copy.secondaryTitle;

  return (
    <main className="vyva-page pb-[120px]" data-testid={`${testIdPrefix}-screen`}>
      {variant === "participate" ? (
        <button
          type="button"
          onClick={() => navigate("/social-rooms")}
          className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={18} />
          {copy.back}
        </button>
      ) : null}

      <section className="rounded-[24px] border border-[#D6E7DC] bg-[#F7FBF8] p-4 shadow-[0_10px_26px_rgba(47,79,65,0.07)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[34px] font-semibold leading-[1.02] text-[#223B35]">
              {longevityNearbyCue ? copy.longevityNearbyHeadline : copy.activitiesHeadline}
            </h1>
            <p className="mt-2 max-w-[32rem] font-body text-[15px] font-semibold leading-snug text-[#526B63]">
              {longevityNearbyCue ? copy.longevityNearbyReassurance : pulse.reassurance}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#CDE9D8] bg-white px-3 py-2">
            <ShieldCheck size={16} className="shrink-0 text-[#0F766E]" />
            <p className="font-body text-[13px] font-black leading-tight text-[#0F766E]">
              {copy.confirmFirst}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {copy.profileSignalTitle}
          </p>
          <div className="flex flex-wrap gap-2" data-testid={`${testIdPrefix}-profile-signals`}>
            {signalChips.map((chip, index) => (
              <SignalChip key={`${chip.label}-${index}`} icon={chip.icon} label={chip.label} />
            ))}
          </div>
        </div>
      </section>

      {pulse.emptyProfileNudge ? (
        <section className="mt-4 rounded-[22px] border border-[#F8D97B] bg-[#FFFBEB] p-4" data-testid={`${testIdPrefix}-profile-nudge`}>
          <p className="font-body text-[17px] font-black text-[#6B4A00]">{pulse.emptyProfileNudge.title}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-relaxed text-[#80621A]">{pulse.emptyProfileNudge.body}</p>
          <button
            type="button"
            onClick={() => navigate(pulse.emptyProfileNudge?.path ?? "/onboarding/profile/hobbies")}
            className="vyva-tap mt-3 min-h-[46px] rounded-full bg-[#B45309] px-5 font-body text-[14px] font-black text-white"
          >
            {pulse.emptyProfileNudge.actionLabel}
          </button>
        </section>
      ) : null}

      <div className="mt-5">
        <EventPanel
          event={pulse.featuredEvent}
          copy={copy}
          language={language}
          testIdPrefix={testIdPrefix}
          featured
          pending={pending}
          onRespond={(eventId, response) => respondMutation.mutate({ eventId, response })}
          onAskVyva={(eventId) => askVyvaMutation.mutate(eventId)}
        />
      </div>

      <section className="mt-5" data-testid={`${testIdPrefix}-filters`}>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={activeFilter === "for_you"}
            icon={Sparkles}
            label={copy.forYou}
            testId={`${testIdPrefix}-filter-for-you`}
            onClick={() => setActiveFilter("for_you")}
          />
          <FilterButton
            active={activeFilter === "nearby"}
            icon={MapPin}
            label={copy.nearby}
            testId={`${testIdPrefix}-filter-nearby`}
            onClick={() => setActiveFilter("nearby")}
          />
          <FilterButton
            active={activeFilter === "online"}
            icon={Monitor}
            label={copy.online}
            testId={`${testIdPrefix}-filter-online`}
            onClick={() => setActiveFilter("online")}
          />
          <FilterButton
            active={activeFilter === "saved"}
            icon={BookmarkCheck}
            label={copy.saved}
            testId={`${testIdPrefix}-filter-saved`}
            onClick={() => setActiveFilter("saved")}
          />
        </div>
      </section>

      <section className="mt-6" data-testid={`${testIdPrefix}-more-recommendations`}>
        <h2 className="mb-3 font-body text-[22px] font-black text-vyva-text-1">{filteredTitle}</h2>
        {filteredRecommendations.length > 0 ? (
          <div className="grid gap-4">
            {filteredRecommendations.map((event) => (
              <EventPanel
                key={event.id}
                event={event}
                copy={copy}
                language={language}
                testIdPrefix={testIdPrefix}
                pending={pending}
                onRespond={(eventId, response) => respondMutation.mutate({ eventId, response })}
                onAskVyva={(eventId) => askVyvaMutation.mutate(eventId)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-[20px] border border-[#E8DED4] bg-white p-4 font-body text-[15px] font-bold text-vyva-text-2">
            {copy.emptyFilter}
          </p>
        )}
      </section>

      {activeFilter !== "saved" ? (
        <section className="mt-6 rounded-[24px] border border-[#E8DED4] bg-[#FFFCF8] p-5" data-testid={`${testIdPrefix}-saved-events`}>
          <h2 className="font-body text-[21px] font-black text-vyva-text-1">{copy.savedTitle}</h2>
          {pulse.savedEvents.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {pulse.savedEvents.map((event) => (
                <div key={`saved-${event.id}`} className="rounded-[18px] border border-[#E5DED3] bg-white px-4 py-3">
                  <p className="font-body text-[16px] font-black text-vyva-text-1">{event.title}</p>
                  <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{responseLabel(event, copy)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 font-body text-[14px] font-bold text-vyva-text-2">{copy.savedEmpty}</p>
          )}
        </section>
      ) : null}

      {afterEvents}
    </main>
  );
}
