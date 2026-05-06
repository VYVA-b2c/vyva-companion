import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Users, CheckCheck, Clock, Heart, X, Sparkles,
  Star, Footprints, Dices, Trees, Paintbrush, BookOpen,
  Mic, Plus, Shield,
} from "lucide-react";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useHeroMessage } from "@/hooks/useHeroMessage";

// ─── Static data ───────────────────────────────────────────────────────────────

const INTEREST_CATEGORIES = [
  {
    id: "games",
    icon: Dices,
    color: "#4F46E5",
    bg: "#EEF2FF",
    interests: ["chess", "bridge", "bingo", "cards", "dominoes", "sudoku"],
  },
  {
    id: "outdoors",
    icon: Trees,
    color: "#0A7C4E",
    bg: "#ECFDF5",
    interests: ["walking", "gardening", "birdwatching", "cycling", "fishing"],
  },
  {
    id: "creative",
    icon: Paintbrush,
    color: "#B0355A",
    bg: "#FDF2F8",
    interests: ["painting", "knitting", "music", "crafts", "writing"],
  },
  {
    id: "learning",
    icon: BookOpen,
    color: "#C9890A",
    bg: "#FEF3C7",
    interests: ["reading", "languages", "history", "crosswords", "documentary"],
  },
] as const;

const VALUES_OPTIONS = [
  "family", "health", "community", "friendship",
  "faith", "humor", "nature", "independence",
] as const;

const PREFERRED_ACTIVITY_OPTIONS = [
  "chat_together", "walk_together", "play_games", "watch_movies",
  "crafts_together", "book_club", "cook_together", "garden_together",
] as const;

const GROUPS = [
  { id: "garden", icon: "🌿", nameKey: "community.groups.garden", members: 5, live: true, bg: "#F5F3FF" },
  { id: "chess",  icon: "♟️", nameKey: "community.groups.chess",  members: 3, live: false, bg: "#FDF3DC" },
  { id: "reading",icon: "📖", nameKey: "community.groups.reading",members: 4, live: false, bg: "#FEE8ED" },
  { id: "music",  icon: "🎵", nameKey: "community.groups.music",  members: 6, live: false, bg: "#E2F5EF" },
];

const MOODS = [
  { key: "happy",   emoji: "😊" },
  { key: "calm",    emoji: "😌" },
  { key: "lonely",  emoji: "😔" },
  { key: "tired",   emoji: "😴" },
  { key: "excited", emoji: "🎉" },
];

const GROUP_MEMBERS = [
  { initial: "M", nameKey: "community.groupPanel.you",     bg: "#6B21A8", online: true },
  { initial: "R", nameKey: "community.groupPanel.memberR", bg: "#D4607A", online: true },
  { initial: "C", nameKey: "community.groupPanel.memberC", bg: "#2A8C78", online: false },
  { initial: "J", nameKey: "community.groupPanel.memberJ", bg: "#E8A020", online: false },
  { initial: "A", nameKey: "community.groupPanel.memberA", bg: "#7A7290", online: false },
];

const AVATAR_COLORS = [
  "#6B21A8", "#0A7C4E", "#B0355A", "#C9890A", "#4F46E5", "#0E7490",
];

// ─── API types ────────────────────────────────────────────────────────────────

interface CompanionProfile {
  id: string;
  user_id: string;
  interests: string[];
  hobbies: string[];
  values: string[];
  preferred_activities: string[];
}

interface ProfilePayload {
  interests: string[];
  hobbies: string[];
  values: string[];
  preferred_activities: string[];
}

interface Suggestion {
  userId: string;
  name: string;
  age: number | null;
  sharedInterests: string[];
  allInterests: string[];
  sharedCount: number;
  suggestedActivityKey: string;
  avatarUrl?: string | null;
}

interface CompanionConnection {
  id: string;
  otherId: string;
  name: string;
  status: string;
  suggestedActivity: string;
  isIncoming: boolean;
  createdAt: string;
  avatarUrl?: string | null;
}

interface Connections {
  accepted: CompanionConnection[];
  pending: CompanionConnection[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// Maps top interest to a group id
const INTEREST_TO_GROUP: Record<string, string> = {
  gardening: "garden", walking: "garden", birdwatching: "garden", cycling: "garden", fishing: "garden",
  chess: "chess", bridge: "chess", bingo: "chess", cards: "chess", dominoes: "chess", sudoku: "chess",
  reading: "reading", languages: "reading", history: "reading", crosswords: "reading", documentary: "reading",
  music: "music", painting: "music", knitting: "music", crafts: "music", writing: "music",
};

function topGroupForInterests(interests: string[]): string {
  const counts: Record<string, number> = {};
  for (const i of interests) {
    const g = INTEREST_TO_GROUP[i];
    if (g) counts[g] = (counts[g] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "garden";
}

// ─── User Avatar ──────────────────────────────────────────────────────────────

function UserAvatar({
  name,
  avatarUrl,
  size = 58,
  fontSize = 22,
  online,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  fontSize?: number;
  online?: boolean;
}) {
  const bg = avatarColor(name);
  return (
    <div
      className="rounded-full flex-shrink-0 relative overflow-hidden"
      style={{ width: size, height: size, background: bg, flexShrink: 0 }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            (e.currentTarget.parentElement as HTMLElement).querySelector(".avatar-fallback")?.removeAttribute("style");
          }}
        />
      ) : null}
      <span
        className="avatar-fallback absolute inset-0 flex items-center justify-center font-display font-semibold text-white"
        style={{ fontSize, display: avatarUrl ? "none" : "flex" }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      {online !== undefined && (
        <span
          className="absolute bottom-[2px] right-[2px] rounded-full border-2 border-white"
          style={{ width: Math.max(10, Math.round(size * 0.22)), height: Math.max(10, Math.round(size * 0.22)), background: online ? "#2A8C78" : "#C4B5FD" }}
        />
      )}
    </div>
  );
}

function ChipToggle({
  label, active, color, bg, testId, onToggle,
}: {
  label: string; active: boolean; color: string; bg: string; testId: string; onToggle: () => void;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onToggle}
      className="rounded-full px-4 py-2 font-body text-[15px] font-medium border transition-all"
      style={active ? { background: color, color: "#fff", borderColor: color } : { background: bg, color, borderColor: color + "44" }}
    >
      {label}
    </button>
  );
}

// ─── Introduction modal ───────────────────────────────────────────────────────

function IntroModal({ name, onClose }: { name: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-6"
      style={{ background: "rgba(30,26,46,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] p-8 max-w-[340px] w-full text-center"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-[64px] h-[64px] rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "#F5F3FF" }}
        >
          <Sparkles size={28} style={{ color: "#6B21A8" }} />
        </div>
        <h3 className="font-display italic font-normal text-[22px] text-vyva-text-1 mb-2">
          {t("community.introModal.title")}
        </h3>
        <p className="font-body text-[15px] text-vyva-text-2 leading-relaxed mb-6">
          {t("community.introModal.body", { name })}
        </p>
        <button
          data-testid="button-intro-modal-close"
          onClick={onClose}
          className="w-full rounded-full py-3 font-body text-[15px] font-semibold text-white"
          style={{ background: "#6B21A8" }}
        >
          {t("community.introModal.ok")}
        </button>
      </div>
    </div>
  );
}

// ─── Interest Picker (first-time setup) ──────────────────────────────────────

function InterestPicker({
  initialProfile, onSave, saving,
}: {
  initialProfile: CompanionProfile | null | undefined;
  onSave: (payload: ProfilePayload) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set(initialProfile?.interests ?? [])
  );
  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    new Set(initialProfile?.values ?? [])
  );
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(
    new Set(initialProfile?.preferred_activities ?? [])
  );

  const toggleSet = (setFn: Dispatch<SetStateAction<Set<string>>>, key: string) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="px-[22px] pb-8">
      <div className="mb-6 mt-2">
        <h1 className="font-display italic font-normal text-[26px] text-vyva-text-1 leading-tight">
          {t("companions.setupTitle")}
        </h1>
        <p className="font-body text-[15px] text-vyva-text-2 mt-1">
          {t("companions.setupSubtitle")}
        </p>
      </div>

      <div className="space-y-5">
        {INTEREST_CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: cat.bg }}>
                  <CatIcon size={16} style={{ color: cat.color }} />
                </div>
                <span className="font-body text-[15px] font-semibold text-vyva-text-1">
                  {t(`companions.interests.title.${cat.id}`)}
                </span>
              </div>
              <div className="flex flex-wrap gap-[10px]">
                {cat.interests.map((interest) => (
                  <ChipToggle
                    key={interest}
                    label={t(`companions.interests.${interest}`)}
                    active={selectedInterests.has(interest)}
                    color={cat.color}
                    bg={cat.bg}
                    testId={`interest-toggle-${interest}`}
                    onToggle={() => toggleSet(setSelectedInterests, interest)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: "#FDF4FF" }}>
              <Star size={16} style={{ color: "#7C3AED" }} />
            </div>
            <span className="font-body text-[15px] font-semibold text-vyva-text-1">
              {t("companions.profile.valuesTitle")}
            </span>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            {VALUES_OPTIONS.map((v) => (
              <ChipToggle
                key={v}
                label={t(`companions.profile.values.${v}`)}
                active={selectedValues.has(v)}
                color="#7C3AED"
                bg="#FDF4FF"
                testId={`value-toggle-${v}`}
                onToggle={() => toggleSet(setSelectedValues, v)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: "#ECFDF5" }}>
              <Footprints size={16} style={{ color: "#0A7C4E" }} />
            </div>
            <span className="font-body text-[15px] font-semibold text-vyva-text-1">
              {t("companions.profile.preferredActivitiesTitle")}
            </span>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            {PREFERRED_ACTIVITY_OPTIONS.map((a) => (
              <ChipToggle
                key={a}
                label={t(`companions.profile.preferredActivities.${a}`)}
                active={selectedActivities.has(a)}
                color="#0A7C4E"
                bg="#ECFDF5"
                testId={`activity-toggle-${a}`}
                onToggle={() => toggleSet(setSelectedActivities, a)}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        data-testid="button-save-interests"
        onClick={() =>
          onSave({
            interests:            [...selectedInterests],
            hobbies:              [],
            values:               [...selectedValues],
            preferred_activities: [...selectedActivities],
          })
        }
        disabled={selectedInterests.size === 0 || saving}
        className="mt-8 w-full rounded-full py-4 font-body text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: "#6B21A8" }}
      >
        {saving ? "…" : t("companions.saveInterests")}
      </button>
    </div>
  );
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────

function HeroBanner() {
  const { t } = useTranslation();
  const heroMessage = useHeroMessage("companions", {
    fallbackHeadline: "Conecta hoy",
    fallbackSourceText: "Mi comunidad",
    fallbackCtaLabel: t("common.explore", "Explorar"),
    fallbackContextHint: "community",
  });

  return (
    <div
      className="rounded-[20px] px-[24px] py-[28px] flex flex-col gap-3 relative overflow-hidden"
      style={{ background: "#3C2570" }}
    >
      <div
        className="absolute top-[-40px] right-[-40px] w-[180px] h-[180px] rounded-full pointer-events-none"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
      <div
        className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full pointer-events-none"
        style={{ background: "rgba(255,255,255,0.03)" }}
      />

      <span
        className="font-body text-[12px] font-semibold tracking-widest uppercase"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {heroMessage?.sourceText ?? "Mi comunidad"}
      </span>

      <p
        data-testid="text-community-message"
        className="min-w-0 break-words font-display italic font-normal text-[26px] text-white leading-tight"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
          overflowWrap: "anywhere",
          minHeight: "64px",
        }}
      >
        {heroMessage?.headline ?? "Conecta hoy"}
      </p>

      <div className="flex items-center justify-between mt-1">
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-[12px] font-medium"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        >
          <span
            className="w-[6px] h-[6px] rounded-full flex-shrink-0"
            style={{ background: "#4ADE80" }}
          />
          {t("common.active", "Activo")}
        </span>
        <button
          data-testid="button-explorar-community"
          className="font-body text-[14px] font-medium rounded-full px-4 py-2 transition-opacity active:opacity-70"
          style={{
            color: "rgba(255,255,255,0.75)",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
          }}
        >
          {heroMessage?.ctaLabel ?? t("common.explore", "Explorar")}
        </button>
      </div>
    </div>
  );
}

// ─── Mood row ─────────────────────────────────────────────────────────────────

function MoodRow() {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  return (
    <div>
      <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mb-3">
        {t("community.mood.title")}
      </h2>
      <div className="flex gap-2 flex-wrap">
        {MOODS.map((m) => {
          const isActive = active === m.key;
          return (
            <button
              key={m.key}
              data-testid={`button-mood-${m.key}`}
              onClick={() => setActive(isActive ? null : m.key)}
              className="flex items-center gap-2 rounded-full px-4 py-3 font-body text-[15px] border transition-all"
              style={
                isActive
                  ? { background: "#6B21A8", color: "#fff", borderColor: "#6B21A8" }
                  : { background: "#fff", color: "#1E1A2E", borderColor: "rgba(107,33,168,0.15)" }
              }
            >
              <span className="text-[19px]">{m.emoji}</span>
              {t(`community.mood.${m.key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Groups strip ─────────────────────────────────────────────────────────────

function GroupsStrip({ defaultActiveGroup = "garden" }: { defaultActiveGroup?: string }) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState(defaultActiveGroup);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
          {t("community.groups.title")}
        </h2>
        <button className="font-body text-[15px] font-medium" style={{ color: "#6B21A8" }}>
          {t("community.groups.seeAll")}
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {GROUPS.map((g) => {
          const isActive = activeGroup === g.id;
          return (
            <button
              key={g.id}
              data-testid={`button-group-${g.id}`}
              onClick={() => setActiveGroup(g.id)}
              className="flex items-center gap-3 rounded-full px-4 py-3 min-h-[48px] border flex-shrink-0 transition-all text-left"
              style={
                isActive
                  ? { background: "#F5F3FF", borderColor: "#6B21A8" }
                  : { background: "#fff", borderColor: "rgba(107,33,168,0.12)" }
              }
            >
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[18px] flex-shrink-0"
                style={{ background: g.bg }}
              >
                {g.icon}
              </div>
              <div className="min-w-0">
                <p className="font-body text-[15px] font-semibold text-vyva-text-1 whitespace-nowrap">
                  {t(g.nameKey)}
                </p>
                <p className="font-body text-[15px] text-vyva-text-2">
                  {g.members} {t("community.groups.members")}
                </p>
              </div>
              {g.live && (
                <span
                  className="w-[8px] h-[8px] rounded-full flex-shrink-0"
                  style={{ background: "#2A8C78", animation: "vyva-blink 2s ease-in-out infinite" }}
                />
              )}
            </button>
          );
        })}
        <button
          data-testid="button-group-add"
          className="w-[62px] h-[62px] rounded-full flex items-center justify-center flex-shrink-0 border-2 border-dashed transition-all"
          style={{ background: "#F5F3FF", borderColor: "#6B21A8", color: "#6B21A8" }}
          title={t("community.groups.join")}
        >
          <Plus size={22} />
        </button>
      </div>
    </div>
  );
}

// ─── Active Group Panel ───────────────────────────────────────────────────────

const GROUP_META: Record<string, { icon: string; bg: string; color: string }> = {
  garden:  { icon: "🌿", bg: "#F5F3FF", color: "#6B21A8" },
  chess:   { icon: "♟️", bg: "#FDF3DC", color: "#E8A020" },
  reading: { icon: "📖", bg: "#FEE8ED", color: "#B0355A" },
  music:   { icon: "🎵", bg: "#E2F5EF", color: "#2A8C78" },
};

function ActiveGroupPanel({ activeGroupId = "garden" }: { activeGroupId?: string }) {
  const { t } = useTranslation();
  const meta = GROUP_META[activeGroupId] ?? GROUP_META.garden;
  return (
    <div
      className="rounded-[16px] border border-vyva-border overflow-hidden bg-white"
      style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.07)" }}
    >
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: meta.color }}
      >
        <div
          className="w-[48px] h-[48px] rounded-[12px] flex items-center justify-center text-[24px] flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display italic font-normal text-[17px] text-white">
            {t(`community.groups.${activeGroupId}`, t("community.groupPanel.name"))}
          </p>
          <p className="font-body text-[15px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            {t("community.groupPanel.schedule")}
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5 flex-shrink-0"
          style={{ background: "#2A8C78" }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full bg-white"
            style={{ animation: "vyva-blink 2s ease-in-out infinite" }}
          />
          <span className="font-body text-[15px] font-medium text-white">
            {t("community.groupPanel.liveNow")}
          </span>
        </div>
      </div>

      <div className="flex gap-5 px-5 py-4 flex-wrap">
        {GROUP_MEMBERS.map((m) => (
          <div key={m.initial} className="flex flex-col items-center gap-2">
            <div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center font-body font-bold text-white text-[20px] relative"
              style={{ background: m.bg }}
            >
              {m.initial}
              {m.online && (
                <span
                  className="absolute bottom-[2px] right-[2px] w-[13px] h-[13px] rounded-full border-2 border-white"
                  style={{ background: "#2A8C78" }}
                />
              )}
            </div>
            <span className="font-body text-[15px] font-medium text-vyva-text-1">
              {t(m.nameKey)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mx-5 mb-5 rounded-[12px] px-4 py-3" style={{ background: meta.bg }}>
        <span className="text-[24px]">🌱</span>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[15px] font-semibold" style={{ color: "#5A3800" }}>
            {t("community.groupPanel.topic")}
          </p>
          <p className="font-body text-[15px]" style={{ color: "#7A5010" }}>
            {t("community.groupPanel.topicSub")}
          </p>
        </div>
        <button
          data-testid="button-join-call"
          className="rounded-full px-4 min-h-[48px] font-body text-[15px] font-semibold text-white flex-shrink-0 transition-all active:scale-95"
          style={{ background: "#E8A020" }}
        >
          {t("community.groupPanel.joinCall")}
        </button>
      </div>
    </div>
  );
}

// ─── API-based Match Card ──────────────────────────────────────────────────────

function ApiMatchCard({
  s, onIntroduce, onConnect, connecting,
}: {
  s: Suggestion;
  onIntroduce: (name: string) => void;
  onConnect: (s: Suggestion) => void;
  connecting: string | null;
}) {
  const { t } = useTranslation();
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  const matchPct = Math.min(95, 55 + s.sharedInterests.length * 10);

  const handleIntroduce = () => {
    onConnect(s);
    onIntroduce(s.name);
  };

  return (
    <div
      className="bg-white rounded-[16px] border border-vyva-border overflow-hidden"
      data-testid={`card-suggestion-${s.userId}`}
      style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.07)" }}
    >
      <div className="p-5 flex items-start gap-4">
        <UserAvatar name={s.name} avatarUrl={s.avatarUrl} size={58} fontSize={22} />
        <div className="flex-1 min-w-0">
          <p className="font-display italic font-normal text-[17px] text-vyva-text-1">
            {s.name}{s.age != null ? `, ${s.age}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "#F5F3FF" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${matchPct}%`, background: "#6B21A8", transition: "width 0.8s ease" }}
              />
            </div>
            <span className="font-body text-[15px] font-semibold whitespace-nowrap" style={{ color: "#6B21A8" }}>
              {matchPct}% {t("community.matches.match")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-5 pb-4">
        {s.sharedInterests.map((i) => (
          <span
            key={i}
            className="rounded-full px-3 py-1 font-body text-[15px] font-medium"
            style={{ background: "#FDF3DC", color: "#7A5010" }}
          >
            {t(`companions.interests.${i}`, i)}
          </span>
        ))}
        <span
          className="rounded-full px-3 py-1 font-body text-[15px] font-medium"
          style={{ background: "#F5F3FF", color: "#3C2570" }}
        >
          {t(`companions.activityPrompt.${s.suggestedActivityKey}`, s.suggestedActivityKey)}
        </span>
      </div>

      <div className="flex gap-2 px-5 pb-5 border-t border-vyva-border pt-4">
        <button
          data-testid={`button-connect-${s.userId}`}
          onClick={handleIntroduce}
          disabled={connecting === s.userId}
          className="flex-1 rounded-full py-3 min-h-[48px] font-body text-[15px] font-semibold text-white disabled:opacity-60 transition-all active:scale-95"
          style={{ background: "#6B21A8" }}
        >
          {connecting === s.userId ? "…" : t("community.matches.introduce")}
        </button>
        <button
          data-testid={`button-skip-${s.userId}`}
          onClick={() => setSkipped(true)}
          className="rounded-full px-5 py-3 min-h-[48px] border border-vyva-border font-body text-[15px] text-vyva-text-2 transition-all active:scale-95"
        >
          {t("community.matches.skip")}
        </button>
      </div>
    </div>
  );
}

// ─── Connections section ───────────────────────────────────────────────────────

function ConnectionsSection({
  connections, onRespond, responding,
}: {
  connections: Connections;
  onRespond: (id: string, status: "accepted" | "declined") => void;
  responding: string | null;
}) {
  const { t } = useTranslation();
  const { accepted, pending } = connections;
  if (accepted.length === 0 && pending.length === 0) return null;

  return (
    <div>
      <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1 mb-3">
        {t("companions.tabs.myCompanions")}
      </h2>
      <div className="space-y-3">
        {pending.filter((c) => c.isIncoming).map((c) => (
          <div
            key={c.id}
            data-testid={`card-connection-${c.id}`}
            className="bg-white rounded-[16px] border border-vyva-border p-4"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size={44} fontSize={16} />
              <div className="flex-1 min-w-0">
                <p className="font-body text-[15px] font-semibold text-vyva-text-1 truncate">{c.name}</p>
                <p className="font-body text-[15px] text-vyva-text-2">{t("companions.connection.incoming")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                data-testid={`button-decline-${c.id}`}
                onClick={() => onRespond(c.id, "declined")}
                disabled={responding === c.id}
                className="flex-1 rounded-full py-2.5 min-h-[48px] border border-vyva-border font-body text-[15px] text-vyva-text-2 disabled:opacity-40"
              >
                <X size={14} className="inline mr-1" />
                {t("companions.connection.decline")}
              </button>
              <button
                data-testid={`button-accept-${c.id}`}
                onClick={() => onRespond(c.id, "accepted")}
                disabled={responding === c.id}
                className="flex-1 rounded-full py-2.5 min-h-[48px] font-body text-[15px] font-semibold text-white disabled:opacity-60"
                style={{ background: "#6B21A8" }}
              >
                <Heart size={14} className="inline mr-1" />
                {t("companions.connection.accept")}
              </button>
            </div>
          </div>
        ))}

        {pending.filter((c) => !c.isIncoming).map((c) => (
          <div
            key={c.id}
            data-testid={`card-connection-${c.id}`}
            className="bg-white rounded-[16px] border border-vyva-border p-4 flex items-center gap-3"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          >
            <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size={44} fontSize={16} />
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-semibold text-vyva-text-1 truncate">{c.name}</p>
              <p className="font-body text-[15px] text-vyva-text-2">{t("companions.connection.pending")}</p>
            </div>
            <Clock size={16} style={{ color: "#C4B5FD" }} />
          </div>
        ))}

        {accepted.map((c) => (
          <div
            key={c.id}
            data-testid={`card-connection-${c.id}`}
            className="bg-white rounded-[16px] border border-vyva-border p-4 flex items-center gap-3"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
          >
            <UserAvatar name={c.name} avatarUrl={c.avatarUrl} size={44} fontSize={16} />
            <div className="flex-1 min-w-0">
              <p className="font-body text-[15px] font-semibold text-vyva-text-1 truncate">{c.name}</p>
              <p className="font-body text-[15px] text-vyva-text-2">{t("companions.connection.accepted")}</p>
            </div>
            <CheckCheck size={18} style={{ color: "#0A7C4E" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Social Gate ──────────────────────────────────────────────────────────────

function SocialGate({ onJoin }: { onJoin: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center">
      <div
        className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-6"
        style={{ background: "#F5F3FF" }}
      >
        <Users size={36} style={{ color: "#6B21A8" }} />
      </div>
      <h1 className="font-display italic font-normal text-[26px] text-vyva-text-1 leading-tight mb-3">
        {t("community.gate.title")}
      </h1>
      <p className="font-body text-[16px] text-vyva-text-2 leading-relaxed mb-8 max-w-[300px]">
        {t("community.gate.description")}
      </p>
      <button
        data-testid="button-join-community"
        onClick={onJoin}
        className="w-full max-w-[320px] rounded-full py-4 font-body text-[16px] font-semibold text-white transition-opacity active:opacity-80"
        style={{ background: "#6B21A8" }}
      >
        {t("community.gate.cta")}
      </button>
    </div>
  );
}

// ─── Consent Sheet ────────────────────────────────────────────────────────────

function ConsentSheet({
  open, onConfirm, onDismiss, loading,
}: {
  open: boolean; onConfirm: () => void; onDismiss: () => void; loading: boolean;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{ background: "rgba(30,26,46,0.55)" }}
      onClick={onDismiss}
    >
      <div
        className="bg-white rounded-t-[24px] w-full max-w-[480px] px-6 pt-6 pb-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="w-[40px] h-[4px] rounded-full bg-gray-200 mx-auto mb-6" />

        <div
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "#F5F3FF" }}
        >
          <Shield size={24} style={{ color: "#6B21A8" }} />
        </div>

        <h2 className="font-display italic font-normal text-[22px] text-vyva-text-1 text-center mb-4">
          {t("community.consent.title")}
        </h2>

        <ul className="space-y-3 mb-6">
          <li className="flex items-start gap-3">
            <span
              className="w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center mt-[1px]"
              style={{ background: "#F5F3FF" }}
            >
              <Users size={12} style={{ color: "#6B21A8" }} />
            </span>
            <p className="font-body text-[15px] text-vyva-text-2 leading-relaxed">
              {t("community.consent.bullet1")}
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span
              className="w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center mt-[1px]"
              style={{ background: "#F5F3FF" }}
            >
              <Shield size={12} style={{ color: "#6B21A8" }} />
            </span>
            <p className="font-body text-[15px] text-vyva-text-2 leading-relaxed">
              {t("community.consent.bullet2")}
            </p>
          </li>
        </ul>

        <p className="font-body text-[13px] text-vyva-text-3 text-center mb-6">
          {t("community.consent.settingsNote")}
        </p>

        <div className="flex flex-col gap-3">
          <button
            data-testid="button-consent-confirm"
            onClick={onConfirm}
            disabled={loading}
            className="w-full rounded-full py-4 font-body text-[16px] font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#6B21A8" }}
          >
            {loading ? (
              <>
                <span
                  className="inline-block w-[18px] h-[18px] rounded-full border-2 border-white/30 border-t-white animate-spin"
                />
                {t("community.consent.confirmBtn")}
              </>
            ) : t("community.consent.confirmBtn")}
          </button>
          <button
            data-testid="button-consent-dismiss"
            onClick={onDismiss}
            disabled={loading}
            className="w-full rounded-full py-4 font-body text-[16px] font-medium text-vyva-text-2 transition-opacity disabled:opacity-50"
            style={{ background: "#F5F3FF" }}
          >
            {t("community.consent.dismissBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────

function GroupCallToast({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed right-4 z-[250] max-w-[300px] w-[calc(100%-32px)] rounded-[16px] p-5 flex gap-3 items-start"
      style={{
        bottom: "calc(72px + 16px)",
        background: "#3C2570",
        boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
        animation: "vyva-slide-up 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}
      data-testid="toast-group-call"
    >
      <button
        data-testid="button-toast-close"
        onClick={onDismiss}
        className="absolute top-1 right-1 w-[48px] h-[48px] flex items-center justify-center font-body text-[20px] leading-none rounded-full"
        style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none" }}
        aria-label={t("common.close", "Close")}
      >
        ×
      </button>
      <div
        className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "#E8A020" }}
      >
        <Mic size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <p className="font-body text-[15px] font-semibold text-white mb-1">
          {t("community.toast.title")}
        </p>
        <p className="font-body text-[15px] leading-snug" style={{ color: "rgba(255,255,255,0.75)" }}>
          {t("community.toast.body")}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            data-testid="button-toast-yes"
            onClick={onDismiss}
            className="rounded-full px-4 py-2 min-h-[48px] font-body text-[15px] font-semibold text-white"
            style={{ background: "#E8A020", border: "none" }}
          >
            {t("community.toast.yes")}
          </button>
          <button
            data-testid="button-toast-no"
            onClick={onDismiss}
            className="rounded-full px-4 py-2 min-h-[48px] font-body text-[15px]"
            style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.8)" }}
          >
            {t("community.toast.no")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface SocialStatus {
  social_enabled: boolean | null;
  discoverable: boolean | null;
}

const CompanionsScreen = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editingInterests, setEditingInterests] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [introModal, setIntroModal] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [showConsentSheet, setShowConsentSheet] = useState(false);

  const socialStatusQuery = useQuery<SocialStatus>({
    queryKey: ["/api/companions/social-status"],
    retry: false,
  });

  const profileQuery = useQuery<CompanionProfile | null>({
    queryKey: ["/api/companions/profile"],
    retry: false,
    enabled: !!socialStatusQuery.data?.social_enabled,
  });

  const suggestionsQuery = useQuery<Suggestion[]>({
    queryKey: ["/api/companions/suggestions"],
    enabled: !!profileQuery.data?.interests?.length,
  });

  const connectionsQuery = useQuery<Connections>({
    queryKey: ["/api/companions/connections"],
    enabled: !!socialStatusQuery.data?.social_enabled,
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: ProfilePayload) => {
      const res = await apiFetch("/api/companions/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setEditingInterests(false);
      queryClient.invalidateQueries({ queryKey: ["/api/companions/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companions/suggestions"] });
    },
    onError: () => {
      toast({ title: t("companions.errors.saveInterestsFailed"), variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (payload: { recipientId: string; suggestedActivityKey: string }) => {
      const res = await apiFetch("/api/companions/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setConnecting(null);
      queryClient.invalidateQueries({ queryKey: ["/api/companions/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companions/connections"] });
      toast({ title: t("companions.connection.requestSent") });
    },
    onError: () => {
      setConnecting(null);
      toast({ title: t("companions.errors.connectFailed"), variant: "destructive" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const res = await apiFetch(`/api/companions/connect/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setResponding(null);
      queryClient.invalidateQueries({ queryKey: ["/api/companions/connections"] });
    },
    onError: () => {
      setResponding(null);
      toast({ title: t("companions.errors.respondFailed"), variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/companions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setShowConsentSheet(false);
      queryClient.invalidateQueries({ queryKey: ["/api/companions/social-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companions/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companions/suggestions"] });
    },
    onError: () => {
      toast({ title: t("companions.errors.activateFailed"), variant: "destructive" });
    },
  });

  useEffect(() => {
    const t = setTimeout(() => setShowToast(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const socialStatus = socialStatusQuery.data;
  const profile = profileQuery.data;

  if (socialStatusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="font-body text-[15px] text-vyva-text-2">{t("companions.loading")}</div>
      </div>
    );
  }

  if (!socialStatus?.social_enabled) {
    return (
      <>
        <SocialGate onJoin={() => setShowConsentSheet(true)} />
        <ConsentSheet
          open={showConsentSheet}
          onConfirm={() => activateMutation.mutate()}
          onDismiss={() => setShowConsentSheet(false)}
          loading={activateMutation.isPending}
        />
      </>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="font-body text-[15px] text-vyva-text-2">{t("companions.loading")}</div>
      </div>
    );
  }

  if (editingInterests) {
    return (
      <InterestPicker
        initialProfile={profile}
        onSave={(payload) => saveProfileMutation.mutate(payload)}
        saving={saveProfileMutation.isPending}
      />
    );
  }

  const apiSuggestions = suggestionsQuery.data ?? [];
  const connections: Connections = connectionsQuery.data ?? { accepted: [], pending: [] };
  const activeGroupId = profile?.interests?.length
    ? topGroupForInterests(profile.interests)
    : "garden";

  const handleConnect = (s: Suggestion) => {
    setConnecting(s.userId);
    connectMutation.mutate({ recipientId: s.userId, suggestedActivityKey: s.suggestedActivityKey });
  };

  const handleRespond = (id: string, status: "accepted" | "declined") => {
    setResponding(id);
    respondMutation.mutate({ id, status });
  };

  return (
    <div>
      <style>{`
        @keyframes vyva-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.2); }
          50%       { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
        }
        @keyframes vyva-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        @keyframes vyva-slide-up {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes vyva-section-in {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vyva-card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        .vyva-section-reveal {
          animation: vyva-section-in 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }
        .vyva-card-reveal {
          animation: vyva-card-in 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
      `}</style>

      <div className="px-[18px] pb-24 space-y-6 pt-3">

        {/* Page title row */}
        <div className="flex items-center justify-between vyva-section-reveal" style={{ animationDelay: "0s" }}>
          <h1 className="font-display italic font-normal text-[24px] text-vyva-text-1">
            {t("community.title")}
          </h1>
          <button
            data-testid="button-edit-interests"
            onClick={() => setEditingInterests(true)}
            className="font-body text-[15px] font-medium"
            style={{ color: "#6B21A8" }}
          >
            {t("companions.editInterests")}
          </button>
        </div>

        {/* Hero banner */}
        <div className="vyva-section-reveal" style={{ animationDelay: "0.05s" }}>
          <HeroBanner />
        </div>

        {/* Mood check-in */}
        <div className="vyva-section-reveal" style={{ animationDelay: "0.08s" }}>
          <MoodRow />
        </div>

        {/* My Groups */}
        <div className="vyva-section-reveal" style={{ animationDelay: "0.11s" }}>
          <GroupsStrip defaultActiveGroup={activeGroupId} />
        </div>

        {/* Active group panel */}
        <div className="vyva-section-reveal" style={{ animationDelay: "0.13s" }}>
          <ActiveGroupPanel activeGroupId={activeGroupId} />
        </div>

        {/* People you might like */}
        <div className="vyva-section-reveal" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display italic font-normal text-[18px] text-vyva-text-1">
              {t("community.matches.title")}
            </h2>
            <button className="font-body text-[15px] font-medium" style={{ color: "#6B21A8" }}>
              {t("community.matches.seeMore")}
            </button>
          </div>

          {suggestionsQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl bg-white/70 h-40 animate-pulse" />
              ))}
            </div>
          ) : apiSuggestions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {apiSuggestions.map((s, idx) => (
                <div
                  key={s.userId}
                  className="vyva-card-reveal"
                  style={{ animationDelay: `${0.05 * idx}s` }}
                >
                  <ApiMatchCard
                    s={s}
                    onIntroduce={(name) => setIntroModal(name)}
                    onConnect={handleConnect}
                    connecting={connecting}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl py-10 px-6 text-center"
              style={{ background: "rgba(255,255,255,0.55)" }}
            >
              <p className="font-body text-[15px] text-vyva-text-2">
                {t("community.matches.noSuggestions", "Cuando más personas se unan, te mostraremos compañeros con intereses similares.")}
              </p>
            </div>
          )}
        </div>

        {/* My Companions (connections from API) */}
        <ConnectionsSection
          connections={connections}
          onRespond={handleRespond}
          responding={responding}
        />

      </div>

      {/* Introduction modal */}
      {introModal && (
        <IntroModal name={introModal} onClose={() => setIntroModal(null)} />
      )}

      {/* Group call toast */}
      {showToast && (
        <GroupCallToast onDismiss={() => setShowToast(false)} />
      )}
    </div>
  );
};

export default CompanionsScreen;
