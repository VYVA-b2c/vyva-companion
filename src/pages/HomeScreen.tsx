import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Brain, Users, ConciergeBell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { useProfile } from "@/contexts/ProfileContext";
import {
  personaliseCardOrder,
  getChatNavigationCount,
  incrementChatNavigationCount,
  type PersonalisationData,
} from "@/lib/personaliseCards";

const SectionHeader = ({ title }: { title: string }) => (
  <p className="mb-3 font-display text-[24px] text-vyva-text-1">
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

const HOY_CARDS: HoyCard[] = [
  { id: "breathing",  emoji: "🫁", bg: "#EEF4FF", badgeBg: "#DBEAFE", badgeText: "#1D4ED8", route: "/health" },
  { id: "chatPrompt", emoji: "💬", bg: "#F4F0FF", badgeBg: "#EDE9FE", badgeText: "#6D28D9", route: "/chat" },
  { id: "brainGame",  emoji: "🧠", bg: "#FFF7ED", badgeBg: "#FFEDD5", badgeText: "#C2410C", route: "/activities" },
  { id: "movement",   emoji: "🤸", bg: "#ECFDF5", badgeBg: "#D1FAE5", badgeText: "#065F46", route: "/health" },
  { id: "healthTip",  emoji: "❤️", bg: "#FFF1F2", badgeBg: "#FFE4E6", badgeText: "#BE123C", route: "/health" },
  { id: "wordGame",   emoji: "📝", bg: "#F0FDF4", badgeBg: "#DCFCE7", badgeText: "#15803D", route: "/activities" },
  { id: "concierge",  emoji: "🛎️", bg: "#F0FDFA", badgeBg: "#CCFBF1", badgeText: "#0F766E", route: "/concierge" },
  { id: "meds",       emoji: "💊", bg: "#FDF4FF", badgeBg: "#FAE8FF", badgeText: "#86198F", route: "/meds" },
  { id: "social",     emoji: "🤝", bg: "#FFFBEB", badgeBg: "#FEF3C7", badgeText: "#B45309", route: "/companions" },
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [chatMessage, setChatMessage] = useState("");
  const [chatFocused, setChatFocused] = useState(false);
  const [todayKey, setTodayKey] = useState(todayDateString);

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
  const chatRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoScroll = () => {
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
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

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
  }, []);
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

  const COORDS_WEATHER_CACHE_KEY = "vyva_coords_weather_cache";
  const COORDS_WEATHER_TTL_MS = 30 * 60 * 1000;

  function readCoordsWeatherCache(): { city: string; temperature: number; description: string } | null {
    try {
      const raw = localStorage.getItem(COORDS_WEATHER_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: { city: string; temperature: number; description: string }; ts: number };
      if (Date.now() - parsed.ts > COORDS_WEATHER_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  function writeCoordsWeatherCache(data: { city: string; temperature: number; description: string }) {
    try {
      localStorage.setItem(COORDS_WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch {
    }
  }

  const [coordsWeatherData, setCoordsWeatherData] = useState<{
    city: string;
    temperature: number;
    description: string;
  } | null>(() => readCoordsWeatherCache());
  const geoAttemptedRef = useRef(false);

  const noCityInProfile =
    profileWeatherError &&
    profileWeatherRawError instanceof Error &&
    profileWeatherRawError.message.startsWith("404");

  const fetchIpWeather = async () => {
    try {
      const res = await fetch("/api/weather/by-ip");
      if (res.ok) {
        const data = await res.json();
        writeCoordsWeatherCache(data);
        setCoordsWeatherData(data);
      }
    } catch {
    }
  };

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
        } catch {
        }
      },
      () => {
        fetchIpWeather();
      },
      { timeout: 8000 }
    );
  }, [noCityInProfile]);

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

  const chatExamples = t("home.chatExamples", { returnObjects: true }) as string[];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderFade, setPlaceholderFade] = useState(true);
  const placeholderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current);
    if (chatFocused || chatMessage) return;
    const timer = setInterval(() => {
      setPlaceholderFade(false);
      placeholderTimerRef.current = setTimeout(() => {
        setPlaceholderIdx((prev) => (prev + 1) % chatExamples.length);
        setPlaceholderFade(true);
        placeholderTimerRef.current = null;
      }, 180);
    }, 3500);
    return () => {
      clearInterval(timer);
      if (placeholderTimerRef.current) clearTimeout(placeholderTimerRef.current);
    };
  }, [chatFocused, chatMessage, chatExamples.length]);

  const QUICK_TILES = [
    { icon: Heart,         iconBg: "#FFF1EF", iconColor: "#E05B4B", label: t("home.quickTiles.health.label"),    hint: t("home.quickTiles.health.hint"),    path: "/health" },
    { icon: Brain,         iconBg: "#F4F0FF", iconColor: "#7C3AED", label: t("home.quickTiles.cognitive.label"), hint: t("home.quickTiles.cognitive.hint"), path: "/activities" },
    { icon: Users,         iconBg: "#EEF4FF", iconColor: "#3B6FE0", label: t("home.quickTiles.social.label"),    hint: t("home.quickTiles.social.hint"),    path: "/social-rooms" },
    { icon: ConciergeBell, iconBg: "#EEF9F2", iconColor: "#059669", label: t("home.quickTiles.concierge.label"), hint: t("home.quickTiles.concierge.hint"), path: "/concierge" },
  ];

  const handleNavigate = (path: string) => {
    if (path === "/chat") incrementChatNavigationCount();
    navigate(path);
  };

  const handleChatSend = () => {
    if (!chatMessage.trim()) return;
    incrementChatNavigationCount();
    navigate(`/chat?q=${encodeURIComponent(chatMessage.trim())}`);
    setChatMessage("");
  };

  return (
    <div className="px-[22px] pb-4">
      <VoiceHero
        headline={
          <span className="block">{greetingText}</span>
        }
        weatherData={weatherData}
        contextHint="companion"
        onChatClick={() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />

      <div ref={chatRef} className="mt-[22px]">
        <p className="font-body text-[16px] font-semibold text-vyva-text-2 mb-4">¿Qué hacemos ahora?</p>
        <div className="grid grid-cols-2 gap-[10px]">
          {QUICK_TILES.map((tile) => (
            <button
              key={tile.path}
              data-testid={`button-home-quick-${tile.path.replace("/", "")}`}
              onClick={() => tile.path && handleNavigate(tile.path)}
              className="min-w-0 flex flex-col items-start gap-3 rounded-[24px] px-4 py-4 border transition-all active:scale-[0.975] active:shadow-[0_3px_14px_rgba(0,0,0,0.08)]"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)", background: "#FFFCF8", borderColor: "#EDE2D1" }}
            >
              <div
                className="w-[54px] h-[54px] rounded-[16px] flex items-center justify-center flex-shrink-0"
                style={{ background: tile.iconBg }}
              >
                <tile.icon size={26} style={{ color: tile.iconColor }} />
              </div>
              <span className="font-body text-[15px] font-semibold text-vyva-text-1 leading-tight text-left">
                {tile.label}
              </span>
              <span className="font-body text-[12px] text-vyva-text-2 leading-tight text-left">
                {tile.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-[18px]">
        <SectionHeader title={t("home.todayForYou.sectionTitle")} />
        <div
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto pb-2 -mx-[22px] px-[22px]"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          data-testid="carousel-today-for-you"
          onMouseDown={pauseAndResume}
          onTouchStart={pauseAndResume}
        >
          {orderedCards.map((card) => (
            <div
              key={card.id}
              data-testid={`card-today-for-you-${card.id}`}
              className="flex-shrink-0 flex flex-col rounded-[24px] overflow-hidden"
              style={{
                width: "220px",
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

      <div className="mt-[18px]">
        <div
          className="rounded-[26px] px-[18px] pt-[18px] pb-[14px] flex flex-col gap-3"
          style={{ background: "linear-gradient(145deg, #3D0D82 0%, #6B21A8 58%, #8B3FC8 100%)" }}
          data-testid="card-chat-input"
        >
          <div
            className="font-body text-[13px] font-medium mb-[-4px]"
            style={{
              color: "rgba(255,255,255,0.45)",
              opacity: (!chatMessage && !chatFocused) ? (placeholderFade ? 1 : 0) : 0,
              transition: "opacity 0.18s ease",
              minHeight: "18px",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            {chatExamples[placeholderIdx]}
          </div>

          <textarea
            data-testid="input-chat-message"
            value={chatMessage}
            onChange={(e) => {
              setChatMessage(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onFocus={() => setChatFocused(true)}
            onBlur={() => setChatFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleChatSend();
              }
            }}
            placeholder={chatFocused ? t("home.chatPlaceholder") : ""}
            rows={3}
            className="w-full bg-transparent resize-none outline-none font-body text-[18px] text-white placeholder:text-white/40 leading-[1.6] overflow-hidden"
            style={{ minHeight: "72px", maxHeight: "180px" }}
          />
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
