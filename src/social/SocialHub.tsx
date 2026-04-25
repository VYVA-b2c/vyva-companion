import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/contexts/ProfileContext";
import SocialStyles from "./SocialStyles";
import HeroCarousel from "./HeroCarousel";
import RoomCard from "./RoomCard";
import RoomListRow from "./RoomListRow";
import { filterRoomsByCategory, getGreeting, getSocialCopy, getSocialLanguage, sortHeroRooms } from "./roomUtils";
import type { SocialHubResponse, SocialLanguage, SocialRoom, SocialRoomCategory } from "./types";

function buildFallbackRooms(language: SocialLanguage): SocialRoom[] {
  const localized = {
    garden: {
      name: language === "en" ? "Garden Corner" : language === "de" ? "Der Gartenchat" : "El Rincón del Jardín",
      topic:
        language === "en"
          ? "Happy plants for a bright window"
          : language === "de"
            ? "Fröhliche Pflanzen für ein helles Fenster"
            : "Plantas alegres para una ventana luminosa",
      opener:
        language === "en"
          ? "Hello, I’m Rosa. Which plant keeps you company at home?"
          : language === "de"
            ? "Hallo, ich bin Rosa. Welche Pflanze begleitet dich zu Hause?"
            : "Hola, soy Rosa. ¿Qué planta te acompaña en casa?",
      contentTitle:
        language === "en"
          ? "Three signs your plant feels happy"
          : language === "de"
            ? "Drei Zeichen, dass deine Pflanze zufrieden ist"
            : "Tres señales de que tu planta está contenta",
      liveBadge: language === "en" ? "5 in the room" : language === "de" ? "5 im Raum" : "5 en la sala",
      cta: language === "en" ? "Ask Rosa" : language === "de" ? "Rosa fragen" : "Preguntar a Rosa",
      credential:
        language === "en"
          ? "Botanist · 40 years gardening"
          : language === "de"
            ? "Botanikerin · 40 Jahre Gärtnern"
            : "Botánica · 40 años cultivando",
    },
    chess: {
      name: language === "en" ? "Chess Corner" : language === "de" ? "Die Schachecke" : "El Club de Ajedrez",
      topic: language === "en" ? "Mate in one move" : language === "de" ? "Matt in einem Zug" : "Mate en una jugada",
      opener:
        language === "en"
          ? "Hello, I’m Lorenzo. Shall we look for one calm winning move?"
          : language === "de"
            ? "Hallo, ich bin Lorenzo. Suchen wir einen ruhigen Gewinnzug?"
            : "Hola, soy Lorenzo. ¿Buscamos una jugada ganadora con calma?",
      contentTitle:
        language === "en"
          ? "Look for the calmest move"
          : language === "de"
            ? "Suche den ruhigsten Zug"
            : "Busca la jugada más tranquila",
      liveBadge: language === "en" ? "4 in the room" : language === "de" ? "4 im Raum" : "4 en la sala",
      cta: language === "en" ? "Analyse with Lorenzo" : language === "de" ? "Mit Lorenzo analysieren" : "Analizar con Lorenzo",
      credential:
        language === "en"
          ? "FIDE Master · National referee"
          : language === "de"
            ? "FIDE-Meister · Nationaler Schiedsrichter"
            : "Maestro FIDE · Árbitro nacional",
    },
    kitchen: {
      name: language === "en" ? "Kitchen Table" : language === "de" ? "Der Küchentisch" : "La Mesa de la Cocina",
      topic:
        language === "en"
          ? "A simple lunch with familiar flavours"
          : language === "de"
            ? "Ein einfaches Mittagessen mit vertrauten Aromen"
            : "Una comida sencilla con sabores de siempre",
      opener:
        language === "en"
          ? "Hello, I’m Lola. What dish makes your kitchen feel like home?"
          : language === "de"
            ? "Hallo, ich bin Lola. Welches Gericht lässt deine Küche wie Zuhause fühlen?"
            : "Hola, soy Lola. ¿Qué plato hace que tu cocina se sienta como casa?",
      contentTitle:
        language === "en"
          ? "One warm idea for today"
          : language === "de"
            ? "Eine warme Idee für heute"
            : "Una idea cálida para hoy",
      liveBadge: language === "en" ? "6 in the room" : language === "de" ? "6 im Raum" : "6 en la sala",
      cta: language === "en" ? "Cook with Lola" : language === "de" ? "Mit Lola kochen" : "Cocinar con Lola",
      credential:
        language === "en"
          ? "Chef · Mediterranean cuisine"
          : language === "de"
            ? "Köchin · Mediterrane Küche"
            : "Chef · Cocina mediterránea",
    },
    memory: {
      name: language === "en" ? "Memory Lane" : language === "de" ? "Die Erinnerungsstraße" : "Camino de Recuerdos",
      topic:
        language === "en"
          ? "Which memory comes first today?"
          : language === "de"
            ? "Welche Erinnerung kommt dir heute zuerst?"
            : "¿Qué recuerdo te viene primero hoy?",
      opener:
        language === "en"
          ? "Hello, I’m Sofía. Which memory arrives first when you pause for a moment?"
          : language === "de"
            ? "Hallo, ich bin Sofía. Welche Erinnerung kommt zuerst, wenn du kurz innehältst?"
            : "Hola, soy Sofía. ¿Qué recuerdo llega primero cuando haces una pausa?",
      contentTitle:
        language === "en"
          ? "A gentle memory prompt"
          : language === "de"
            ? "Ein sanfter Erinnerungsimpuls"
            : "Una invitación suave a recordar",
      liveBadge: language === "en" ? "3 in the room" : language === "de" ? "3 im Raum" : "3 en la sala",
      cta: language === "en" ? "Remember with Sofía" : language === "de" ? "Mit Sofía erinnern" : "Recordar con Sofía",
      credential:
        language === "en"
          ? "Historian · Oral memory"
          : language === "de"
            ? "Historikerin · Mündliche Erinnerung"
            : "Historiadora · Memoria oral",
    },
  };

  const today = new Date().toISOString().slice(0, 10);

  return [
    {
      slug: "garden-chat",
      name: localized.garden.name,
      category: "activity",
      agentSlug: "rosa",
      agentFullName: "Rosa Villanueva",
      agentColour: "#059669",
      agentCredential: localized.garden.credential,
      ctaLabel: localized.garden.cta,
      topicTags: ["gardening", "plants"],
      timeSlots: ["morning", "afternoon"],
      featured: true,
      participantCount: 5,
      sessionDate: today,
      topic: localized.garden.topic,
      opener: localized.garden.opener,
      quote: "",
      activityType: "advice",
      contentTag: "",
      contentTitle: localized.garden.contentTitle,
      contentBody: "",
      options: [],
      liveBadge: localized.garden.liveBadge,
      heroScore: 90,
    },
    {
      slug: "chess-corner",
      name: localized.chess.name,
      category: "activity",
      agentSlug: "lorenzo",
      agentFullName: "Lorenzo García",
      agentColour: "#1E1B4B",
      agentCredential: localized.chess.credential,
      ctaLabel: localized.chess.cta,
      topicTags: ["chess", "strategy"],
      timeSlots: ["afternoon", "evening"],
      featured: true,
      participantCount: 4,
      sessionDate: today,
      topic: localized.chess.topic,
      opener: localized.chess.opener,
      quote: "",
      activityType: "quiz",
      contentTag: "",
      contentTitle: localized.chess.contentTitle,
      contentBody: "",
      options: [],
      liveBadge: localized.chess.liveBadge,
      heroScore: 80,
    },
    {
      slug: "kitchen-table",
      name: localized.kitchen.name,
      category: "useful",
      agentSlug: "lola",
      agentFullName: "Lola Martínez",
      agentColour: "#C2410C",
      agentCredential: localized.kitchen.credential,
      ctaLabel: localized.kitchen.cta,
      topicTags: ["cooking", "recipes"],
      timeSlots: ["morning", "afternoon"],
      featured: false,
      participantCount: 6,
      sessionDate: today,
      topic: localized.kitchen.topic,
      opener: localized.kitchen.opener,
      quote: "",
      activityType: "recipe",
      contentTag: "",
      contentTitle: localized.kitchen.contentTitle,
      contentBody: "",
      options: [],
      liveBadge: localized.kitchen.liveBadge,
      heroScore: 70,
    },
    {
      slug: "memory-lane",
      name: localized.memory.name,
      category: "social",
      agentSlug: "sofia",
      agentFullName: "Sofía Montoya",
      agentColour: "#6D6352",
      agentCredential: localized.memory.credential,
      ctaLabel: localized.memory.cta,
      topicTags: ["memories", "storytelling"],
      timeSlots: ["afternoon", "evening"],
      featured: false,
      participantCount: 3,
      sessionDate: today,
      topic: localized.memory.topic,
      opener: localized.memory.opener,
      quote: "",
      activityType: "story",
      contentTag: "",
      contentTitle: localized.memory.contentTitle,
      contentBody: "",
      options: [],
      liveBadge: localized.memory.liveBadge,
      heroScore: 60,
    },
  ];
}

const SocialHub = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const language = getSocialLanguage(profile?.language);
  const copy = getSocialCopy(language);
  const [category, setCategory] = useState<"all" | SocialRoomCategory>("all");

  const { data, isLoading, isError } = useQuery<SocialHubResponse>({
    queryKey: [`/api/social/hub?lang=${language}`],
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const hubRooms = useMemo(() => {
    const rooms = data?.listRooms ?? [];
    return rooms.length ? rooms : buildFallbackRooms(language);
  }, [data?.listRooms, language]);

  const fallbackHeroRooms = useMemo(() => hubRooms.slice(0, 2), [hubRooms]);

  const fallbackAlsoForYou = useMemo(() => hubRooms.slice(2, 4), [hubRooms]);

  const filteredRooms = useMemo(
    () => filterRoomsByCategory(hubRooms, category),
    [category, hubRooms],
  );

  const heroRooms = useMemo(
    () => {
      const rooms = data?.heroRooms?.length ? data.heroRooms : fallbackHeroRooms;
      return sortHeroRooms(filterRoomsByCategory(rooms, category)).slice(0, 6);
    },
    [category, data?.heroRooms, fallbackHeroRooms],
  );

  const alsoForYou = useMemo(
    () => {
      const rooms = data?.alsoForYou?.length ? data.alsoForYou : fallbackAlsoForYou;
      return filterRoomsByCategory(rooms, category);
    },
    [category, data?.alsoForYou, fallbackAlsoForYou],
  );

  const filters: Array<"all" | SocialRoomCategory> = ["all", "activity", "social", "useful", "connection"];

  return (
    <div className="px-6 pb-10">
      <SocialStyles />

      <header className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-[18px] tracking-[0.28em] text-[#8E7FAA]">{copy.dayLabel}</p>
            <h1 className="mt-3 font-display text-[38px] leading-[1.12] text-[#2D1F42]">
              {getGreeting(language, data?.user.firstName ?? profile?.firstName)}
            </h1>
          </div>
          <button
            type="button"
            className="w-[64px] h-[64px] rounded-full border border-[#D9CCFF] bg-white flex items-center justify-center text-[#5B21B6] shadow-[0_10px_24px_rgba(91,33,182,0.08)]"
          >
            <Bell size={28} />
          </button>
        </div>
        <p className="mt-4 font-body text-[22px] text-[#6E5A8A]">
          {copy.subline(data?.activeCount ?? 0)}
        </p>
      </header>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-1">
        {filters.map((value) => {
          const active = value === category;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className="min-h-[64px] whitespace-nowrap rounded-full px-6 font-body text-[22px] font-semibold"
              style={
                active
                  ? { background: "#5B21B6", color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: "#5B21B6", border: "1px solid #D8C8FB" }
              }
            >
              {copy.filters[value]}
            </button>
          );
        })}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-[34px] text-[#2D1F42]">{copy.featuredNow}</h2>
        <div className="mt-4">
          <HeroCarousel
            rooms={heroRooms}
            language={language}
            onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[34px] text-[#2D1F42]">{copy.alsoForYou}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {(alsoForYou.length ? alsoForYou : filteredRooms.slice(0, 4)).map((room) => (
            <RoomCard
              key={room.slug}
              room={room}
              language={language}
              onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[34px] text-[#2D1F42]">{copy.allRooms}</h2>
        <div className="mt-4 space-y-4">
          {isLoading && (
            <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
              Cargando…
            </div>
          )}
          {isError && !filteredRooms.length && (
            <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
              {copy.noRooms}
            </div>
          )}
          {!isLoading && !isError && !filteredRooms.length && (
            <div className="rounded-[28px] bg-white p-6 font-body text-[22px] text-[#6E5A8A]">
              {copy.noRooms}
            </div>
          )}
          {filteredRooms.map((room) => (
            <RoomListRow
              key={room.slug}
              room={room}
              language={language}
              onEnter={(slug) => navigate(`/social-rooms/${slug}`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default SocialHub;

