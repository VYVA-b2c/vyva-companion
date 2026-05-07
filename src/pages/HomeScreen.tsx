import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Brain, Users, ConciergeBell, Mic, RefreshCw, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";
import { useServiceGate } from "@/hooks/useServiceGate";
import {
  personaliseCardOrder,
  getChatNavigationCount,
  incrementChatNavigationCount,
  type PersonalisationData,
} from "@/lib/personaliseCards";

const SectionHeader = ({ title }: { title: string }) => (
  <p className="vyva-section-title mb-3">
    {title}
  </p>
);

type HoyCard = {
  id: string;
  emoji: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
  route: string;
};

type HomeAgentCard = {
  id: "health" | "cognitive" | "social" | "concierge";
  icon: LucideIcon;
  path: string;
  voiceContext: string;
  theme: "pink" | "purple" | "blue" | "green";
};

type WeatherData = {
  city: string;
  temperature: number;
  description: string;
};

const COORDS_WEATHER_CACHE_KEY = "vyva_coords_weather_cache";
const COORDS_WEATHER_TTL_MS = 30 * 60 * 1000;

function readCoordsWeatherCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(COORDS_WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: WeatherData; ts: number };
    if (Date.now() - parsed.ts > COORDS_WEATHER_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCoordsWeatherCache(data: WeatherData) {
  try {
    localStorage.setItem(COORDS_WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    return;
  }
}

const HOME_AGENT_CARDS: HomeAgentCard[] = [
  { id: "health", icon: Heart, path: "/health", voiceContext: "health", theme: "pink" },
  { id: "cognitive", icon: Brain, path: "/activities", voiceContext: "cognitive", theme: "purple" },
  { id: "social", icon: Users, path: "/social-rooms", voiceContext: "social", theme: "blue" },
  { id: "concierge", icon: ConciergeBell, path: "/concierge", voiceContext: "concierge", theme: "green" },
];

const HOME_AGENT_THEMES: Record<HomeAgentCard["theme"], {
  iconBg: string;
  iconColor: string;
  micColor: string;
  glow: string;
}> = {
  pink: {
    iconBg: "linear-gradient(135deg, #FFE7E7 0%, #FFF7F2 100%)",
    iconColor: "#E74C43",
    micColor: "#E74C43",
    glow: "rgba(231,76,67,0.12)",
  },
  purple: {
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    iconColor: "#7C3AED",
    micColor: "#7C3AED",
    glow: "rgba(124,58,237,0.13)",
  },
  blue: {
    iconBg: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)",
    iconColor: "#2F66D0",
    micColor: "#2F66D0",
    glow: "rgba(47,102,208,0.12)",
  },
  green: {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    micColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
  },
};

const HOY_CARDS: HoyCard[] = [
  { id: "symptomCheck", emoji: "🩺", bg: "#FFF7ED", badgeBg: "#FFEDD5", badgeText: "#C2410C", route: "/health/symptom-check" },
  { id: "specialistFinder", emoji: "👩‍⚕️", bg: "#F4F0FF", badgeBg: "#EDE9FE", badgeText: "#6D28D9", route: "/health" },
  { id: "gamesRoom", emoji: "♟️", bg: "#F0FDF4", badgeBg: "#DCFCE7", badgeText: "#15803D", route: "/social-rooms/games-room" },
  { id: "musicSalon", emoji: "🎼", bg: "#EEF4FF", badgeBg: "#DBEAFE", badgeText: "#1D4ED8", route: "/social-rooms/music-salon" },
  { id: "billReview", emoji: "⚡", bg: "#F0FDFA", badgeBg: "#CCFBF1", badgeText: "#0F766E", route: "/concierge" },
  { id: "breathing",  emoji: "🫁", bg: "#EEF4FF", badgeBg: "#DBEAFE", badgeText: "#1D4ED8", route: "/health" },
  { id: "chatPrompt", emoji: "💬", bg: "#F4F0FF", badgeBg: "#EDE9FE", badgeText: "#6D28D9", route: "/chat" },
  { id: "brainGame",  emoji: "🧠", bg: "#FFF7ED", badgeBg: "#FFEDD5", badgeText: "#C2410C", route: "/activities" },
  { id: "movement",   emoji: "🤸", bg: "#ECFDF5", badgeBg: "#D1FAE5", badgeText: "#065F46", route: "/health" },
  { id: "healthTip",  emoji: "❤️", bg: "#FFF1F2", badgeBg: "#FFE4E6", badgeText: "#BE123C", route: "/health" },
  { id: "wordGame",   emoji: "📝", bg: "#F0FDF4", badgeBg: "#DCFCE7", badgeText: "#15803D", route: "/activities" },
  { id: "concierge",  emoji: "🛎️", bg: "#F0FDFA", badgeBg: "#CCFBF1", badgeText: "#0F766E", route: "/concierge" },
  { id: "meds",       emoji: "💊", bg: "#FDF4FF", badgeBg: "#FAE8FF", badgeText: "#86198F", route: "/meds" },
  { id: "social",     emoji: "🤝", bg: "#FFFBEB", badgeBg: "#FEF3C7", badgeText: "#B45309", route: "/social-rooms" },
];

function dateSeededCardOrder(): HoyCard[] {
  const today = new Date();
  const seed =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();
  const arr = [...HOY_CARDS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.abs((seed * (i + 1) * 2654435761) | 0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const HomeScreen = () => {
  const { guardPath } = useServiceGate();
  const { t } = useTranslation();
  const [todayKey, setTodayKey] = useState(todayDateString);
  const [todayRefreshIndex, setTodayRefreshIndex] = useState(0);
  const [isRefreshingTodayCards, setIsRefreshingTodayCards] = useState(false);

  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(() => setTodayKey(todayDateString()), msUntilMidnight);
    return () => clearTimeout(timer);
  }, [todayKey]);

  const { data: personalisationData } = useQuery<{
    conditions: string[];
    hobbies: string[];
    hasMedications: boolean;
  }>({
    queryKey: ["/api/profile/personalisation"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const orderedCards = useMemo(() => {
    void todayKey;
    const dateSorted = dateSeededCardOrder();
    if (!personalisationData) return dateSorted;
    const pData: PersonalisationData = {
      conditions: personalisationData.conditions,
      hobbies: personalisationData.hobbies,
      hasMedications: personalisationData.hasMedications,
      chatNavigationCount: getChatNavigationCount(),
    };
    return personaliseCardOrder(dateSorted, pData);
  }, [todayKey, personalisationData]);

  const visibleTodayCards = useMemo(() => {
    if (orderedCards.length === 0) return [];
    const cardCount = Math.min(3, orderedCards.length);
    const start = (todayRefreshIndex * cardCount) % orderedCards.length;
    return Array.from({ length: cardCount }, (_, offset) => orderedCards[(start + offset) % orderedCards.length]);
  }, [orderedCards, todayRefreshIndex]);

  const { data: personalPlanData, isFetching: isFetchingPersonalPlan } = useQuery<{
    cards: HoyCard[];
    source: string;
    generatedAt: string;
  }>({
    queryKey: ["/api/home/personal-plan", todayKey, todayRefreshIndex, personalisationData],
    queryFn: async () => {
      const response = await apiFetch("/api/home/personal-plan", {
        method: "POST",
        body: JSON.stringify({
          refreshIndex: todayRefreshIndex,
          conditions: personalisationData?.conditions ?? [],
          hobbies: personalisationData?.hobbies ?? [],
          hasMedications: personalisationData?.hasMedications ?? false,
          chatNavigationCount: getChatNavigationCount(),
        }),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const displayedTodayCards = personalPlanData?.cards?.length ? personalPlanData.cards : visibleTodayCards;
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current) return;
    autoScrollRef.current = setInterval(() => {
      const el = carouselRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      if (atEnd) {
        stopAutoScroll();
        el.scrollTo({ left: 0, behavior: "smooth" });
        resumeTimerRef.current = setTimeout(() => startAutoScroll(), 600);
      } else {
        el.scrollBy({ left: 1 });
      }
    }, 20);
  }, [stopAutoScroll]);

  const pauseAndResume = () => {
    stopAutoScroll();
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      startAutoScroll();
    }, 3000);
  };

  useEffect(() => {
    startAutoScroll();
    return () => {
      stopAutoScroll();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [startAutoScroll, stopAutoScroll]);
  const { firstName: profileFirstName } = useProfile();
  const { startVoice, stopVoice, status: voiceStatus, isSpeaking, isConnecting, transcript } = useVyvaVoice();
  const isVoiceActive = voiceStatus !== "idle";

  const firstName = profileFirstName || "";

  const { data: profileWeatherData, isLoading: profileWeatherLoading, isError: profileWeatherError, error: profileWeatherRawError } = useQuery<{
    city: string;
    temperature: number;
    description: string;
  }>({
    queryKey: ["/api/weather"],
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    retry: false,
  });

  const [coordsWeatherData, setCoordsWeatherData] = useState<WeatherData | null>(() => readCoordsWeatherCache());
  const geoAttemptedRef = useRef(false);

  const noCityInProfile =
    profileWeatherError &&
    profileWeatherRawError instanceof Error &&
    profileWeatherRawError.message.startsWith("404");

  const fetchIpWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather/by-ip");
      if (res.ok) {
        const data = await res.json();
        writeCoordsWeatherCache(data);
        setCoordsWeatherData(data);
      }
    } catch (err) {
      console.warn("[home] IP weather lookup failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!noCityInProfile) return;
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    if (readCoordsWeatherCache()) {
      return;
    }

    if (!navigator.geolocation) {
      fetchIpWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/weather/by-coords?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            writeCoordsWeatherCache(data);
            setCoordsWeatherData(data);
          }
        } catch (err) {
          console.warn("[home] coordinate weather lookup failed:", err);
        }
      },
      () => {
        fetchIpWeather();
      },
      { timeout: 8000 }
    );
  }, [fetchIpWeather, noCityInProfile]);

  const weatherData = profileWeatherData ?? coordsWeatherData;

  const timeGreetingKey = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 11) return "morning";
    if (hour >= 12 && hour <= 16) return "afternoon";
    if (hour >= 17 && hour <= 20) return "evening";
    return "night";
  }, []);

  const greetingText = useMemo(() => {
    const period = timeGreetingKey;
    const SESSION_KEY = "home.greetingVariant";
    let variant = parseInt(sessionStorage.getItem(SESSION_KEY) || "0", 10);
    if (!variant || variant < 1 || variant > 5) {
      variant = Math.floor(Math.random() * 5) + 1;
      sessionStorage.setItem(SESSION_KEY, String(variant));
    }
    if (firstName) {
      return t(`home.greeting.${period}.withName.${variant}`, { name: firstName });
    }
    return t(`home.greeting.${period}.withoutName.${variant}`);
  }, [firstName, timeGreetingKey, t]);

  const handleNavigate = (path: string) => {
    if (path === "/chat") incrementChatNavigationCount();
    guardPath(path);
  };

  const handleRefreshTodayCards = () => {
    setTodayRefreshIndex((current) => current + 1);
    setIsRefreshingTodayCards(true);
    pauseAndResume();
    carouselRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    window.setTimeout(() => setIsRefreshingTodayCards(false), 550);
  };

  const handleCardVoice = (card: HomeAgentCard) => {
    if (isVoiceActive) {
      stopVoice();
      return;
    }
    startVoice(card.voiceContext);
  };

  return (
    <div className="vyva-page">
      <VoiceHero
        heroSurface="home"
        headline={
          <span className="block">{greetingText}</span>
        }
        weatherData={weatherData}
        contextHint="companion"
        onChatClick={() => handleNavigate("/chat")}
      />

      <div className="mt-[22px]">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-body text-[16px] font-semibold text-vyva-text-2">{t("home.whatNow")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {HOME_AGENT_CARDS.map((card) => {
            const theme = HOME_AGENT_THEMES[card.theme];
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                data-testid={`card-home-agent-${card.id}`}
                role="button"
                tabIndex={0}
                aria-label={t(`home.voiceCards.${card.id}.openLabel`)}
                onClick={() => handleNavigate(card.path)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleNavigate(card.path);
                  }
                }}
                className="group relative min-h-[188px] overflow-visible rounded-[28px] border bg-[#FFFCF8] px-4 py-4 text-left transition-transform active:scale-[0.99]"
                style={{
                  borderColor: "#EDE2D1",
                  boxShadow: `0 16px 34px ${theme.glow}, 0 2px 10px rgba(43,31,24,0.05)`,
                }}
              >
                <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px]"
                      style={{ background: theme.iconBg }}
                    >
                      <Icon size={30} strokeWidth={2.5} style={{ color: theme.iconColor }} />
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCardVoice(card);
                      }}
                      aria-label={t(`home.voiceCards.${card.id}.micLabel`)}
                      data-testid={`button-home-agent-voice-${card.id}`}
                      className={`relative z-20 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-white transition-transform active:scale-95 ${isVoiceActive ? "mic-pulse-listening" : ""}`}
                      style={{
                        border: "1px solid #EFE4D5",
                        boxShadow: "0 10px 22px rgba(43,31,24,0.08)",
                        color: theme.micColor,
                      }}
                    >
                      <Mic size={25} strokeWidth={2.4} />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <h2 className="font-body text-[21px] font-extrabold leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">
                      {t(`home.voiceCards.${card.id}.title`)}
                    </h2>
                    <p className="mt-2 font-body text-[14px] font-medium leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                      {t(`home.voiceCards.${card.id}.subtitle`)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-[18px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="vyva-section-title">
            {t("home.todayForYou.sectionTitle")}
          </p>
          <button
            type="button"
            onClick={handleRefreshTodayCards}
            aria-label={t("home.todayForYou.refreshLabel")}
            title={t("home.todayForYou.refreshLabel")}
            data-testid="button-refresh-today-for-you"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E5D8F7] bg-white text-[#7B24D4] shadow-[0_8px_20px_rgba(92,44,145,0.10)] transition-transform active:scale-95"
          >
            <RefreshCw
              size={20}
              strokeWidth={2.4}
              className={(isRefreshingTodayCards || isFetchingPersonalPlan) ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
        <div
          ref={carouselRef}
          className="grid grid-cols-1 gap-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          data-testid="carousel-today-for-you"
          onMouseDown={pauseAndResume}
          onTouchStart={pauseAndResume}
        >
          {displayedTodayCards.map((card) => (
            <div
              key={card.id}
              data-testid={`card-today-for-you-${card.id}`}
              className="flex flex-col overflow-hidden rounded-[26px]"
              style={{
                background: card.bg,
                border: "1px solid #EDE2D1",
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              }}
            >
              <div className="px-[18px] pt-[18px] pb-[14px] flex flex-col gap-[10px] flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className="font-body text-[11px] font-semibold px-[10px] py-[4px] rounded-full"
                    style={{ background: card.badgeBg, color: card.badgeText }}
                  >
                    {t(`home.todayForYou.cards.${card.id}.badge`)}
                  </span>
                  <span className="text-[26px]" aria-hidden="true">{card.emoji}</span>
                </div>

                <p className="font-body text-[17px] font-semibold text-vyva-text-1 leading-[1.35]">
                  {t(`home.todayForYou.cards.${card.id}.title`)}
                </p>

                <p className="font-body text-[13px] text-vyva-text-2 leading-[1.5] flex-1">
                  {t(`home.todayForYou.cards.${card.id}.text`)}
                </p>

                <button
                  data-testid={`button-today-for-you-${card.id}`}
                  onClick={() => handleNavigate(card.route)}
                  className="w-full mt-1 py-[10px] rounded-[14px] font-body text-[14px] font-semibold text-white transition-all active:scale-[0.975]"
                  style={{ background: card.badgeText }}
                >
                  {t(`home.todayForYou.cards.${card.id}.cta`)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isVoiceActive && (
        <VoiceCallOverlay
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          transcript={transcript}
          onEnd={stopVoice}
        />
      )}
    </div>
  );
};

export default HomeScreen;
