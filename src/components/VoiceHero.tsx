import React, { useMemo } from "react";
import { Mic, MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import VyvaAvatar from "@/components/VyvaAvatar";

const WEATHER_EMOJI: Record<string, string> = {
  "weather.clear": "☀️",
  "weather.partlyCloudy": "⛅",
  "weather.overcast": "☁️",
  "weather.cloudy": "🌤️",
  "weather.fog": "🌫️",
  "weather.drizzle": "🌦️",
  "weather.rain": "🌧️",
  "weather.snow": "❄️",
  "weather.showers": "🌧️",
  "weather.snowShowers": "🌨️",
  "weather.thunderstorm": "⛈️",
};

interface WeatherData {
  city: string;
  temperature: number;
  description: string;
}

interface VoiceHeroProps {
  sourceText?: string;
  headline: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  contextHint?: string;
  onChatClick?: () => void;
  weatherData?: WeatherData | null;
}

const VoiceHero: React.FC<VoiceHeroProps> = ({ sourceText, headline, subtitle, children, contextHint, onChatClick, weatherData }) => {
  const { t } = useTranslation();
  const { startVoice, stopVoice, status, isSpeaking, isConnecting, transcript } = useVyvaVoice();

  const isActive = status === "connected";
  const showOverlay = isActive || isConnecting;

  const handleTalk = () => {
    if (isActive) {
      stopVoice();
    } else {
      startVoice(contextHint);
    }
  };

  const statusLabel = isConnecting
    ? t("voiceHero.connecting")
    : isActive
    ? isSpeaking
      ? t("voiceHero.speaking")
      : t("voiceHero.listening")
    : t("voiceHero.talkToVyva");

  const timeOfDay = useMemo((): "morning" | "afternoon" | "evening" => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 11) return "morning";
    if (hour >= 12 && hour <= 17) return "afternoon";
    return "evening";
  }, []);

  const weatherEmoji = weatherData?.description ? (WEATHER_EMOJI[weatherData.description] ?? "🌡️") : "🌡️";
  const weatherLabel = weatherData
    ? `${weatherEmoji} ${weatherData.city} · ${weatherData.temperature}°`
    : null;

  if (weatherData !== undefined) {
    return (
      <>
        {showOverlay && (
          <VoiceCallOverlay
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            transcript={transcript}
            onEnd={stopVoice}
          />
        )}

        <div className="mt-[14px] rounded-[24px] relative overflow-visible hero-purple" style={{ paddingTop: "0" }}>
          {/* En Vivo badge — top right */}
          <div className="absolute top-[14px] right-[16px] flex items-center gap-1.5 px-[10px] py-[4px] rounded-full z-10" style={{ background: isActive ? "rgba(52,211,153,0.3)" : "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
            <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
            <span className="text-[11px] font-body" style={{ color: "#34D399" }}>{isActive ? t("voiceHero.active") : t("voiceHero.live")}</span>
          </div>

          {/* Avatar — anchored to card bottom-right */}
          <img
            src="/assets/vyva/avatar-calm.png"
            alt="VYVA"
            draggable={false}
            className="absolute pointer-events-none select-none vyva-avatar"
            style={{
              width: "auto",
              height: "190px",
              bottom: "16px",
              right: "-40px",
              filter: timeOfDay ? { morning: "brightness(1.06) saturate(1.08)", afternoon: "brightness(1.0) saturate(1.0)", evening: "brightness(0.92) saturate(0.9) sepia(0.08)" }[timeOfDay] : undefined,
            }}
          />

          <div className="flex min-h-[208px]">
            {/* Left column — text + CTA */}
            <div className="flex-[0_0_58%] flex flex-col gap-0 px-[22px] pt-[26px] pb-[16px] min-w-0">
              {/* Headline */}
              <h1 className="font-display italic font-normal text-[28px] text-white leading-[1.08] mb-auto max-w-[11ch]">
                {headline}
              </h1>

              {/* CTA button */}
              <button
                onClick={handleTalk}
                disabled={isConnecting}
                data-testid="button-voice-hero-talk"
                className={`w-full flex items-center justify-center gap-2 rounded-full py-[12px] px-[20px] mt-[18px] min-h-[50px] transition-all ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
                style={
                  isActive
                    ? {
                        background: "rgba(52,211,153,0.2)",
                        border: "1px solid rgba(52,211,153,0.4)",
                      }
                    : {
                        background: "#ffffff",
                        border: "none",
                      }
                }
              >
                {isActive ? (
                  <X size={17} style={{ color: "rgba(255,255,255,0.9)" }} />
                ) : (
                  <Mic size={17} style={{ color: "#6B21A8" }} />
                )}
                <span
                  className="font-body text-[15px] font-semibold"
                  style={{ color: isActive ? "#ffffff" : "#6B21A8" }}
                >
                  Hablamos?
                </span>
              </button>
            </div>
          </div>

          {/* Weather strip */}
          {weatherLabel && (
            <div
              className="flex items-center gap-2 px-[20px] py-[8px] rounded-b-[24px]"
              style={{ background: "rgba(0,0,0,0.12)", borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.82 }}
            >
              <span className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                {weatherLabel}
              </span>
            </div>
          )}

          {children}
        </div>
      </>
    );
  }

  return (
    <>
      {showOverlay && (
        <VoiceCallOverlay
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          transcript={transcript}
          onEnd={stopVoice}
        />
      )}

      <div className="mt-[14px] rounded-[24px] p-[24px_22px] relative overflow-hidden hero-purple">
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Source row */}
        <div className="flex items-center justify-between mb-4">
          {sourceText ? (
            <div className="flex items-center gap-2">
              <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
                <Mic size={16} className="text-white" />
              </div>
              <span className="font-body text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{sourceText}</span>
            </div>
          ) : <div />}
          <div className="flex items-center gap-2">
            {onChatClick && (
              <button
                type="button"
                onClick={onChatClick}
                aria-label="Jump to chat"
                data-testid="button-home-chat-jump"
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-opacity active:opacity-80"
                style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)" }}
              >
                <MessageCircle size={16} style={{ color: "rgba(255,255,255,0.92)" }} />
              </button>
            )}
            <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: isActive ? "rgba(52,211,153,0.3)" : "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
              <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
              <span className="text-[11px] font-body" style={{ color: "#34D399" }}>{isActive ? t("voiceHero.active") : t("voiceHero.live")}</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-display italic font-normal text-[26px] text-white leading-[1.3]">
          {headline}
        </h1>
        {subtitle && (
          <p className="font-body text-[14px] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>{subtitle}</p>
        )}

        {/* Screen-specific content */}
        {children}

        {/* Talk / Active button */}
        <button
          onClick={handleTalk}
          disabled={isConnecting}
          data-testid="button-voice-hero-talk"
          className={`w-full flex items-center justify-center gap-2 rounded-full py-[13px] px-[20px] mt-4 min-h-[56px] transition-all ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
          style={{
            background: isActive ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.13)",
            border: isActive ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {isActive ? (
            <X size={18} style={{ color: "rgba(255,255,255,0.9)" }} />
          ) : (
            <Mic size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
          )}
          <span className="font-body text-[16px] font-medium text-white">{statusLabel}</span>
        </button>
      </div>
    </>
  );
};

export default VoiceHero;
