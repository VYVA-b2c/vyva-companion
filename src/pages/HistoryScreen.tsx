import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enGB, es, de, fr, it, pt, cy } from "date-fns/locale";
import type { Locale } from "date-fns";

interface HistoryItem {
  id: number;
  scan_type: "wound" | "home" | "scam";
  result_title: string;
  level: string;
  advice?: string | null;
  explanation?: string | null;
  hazards?: string[] | null;
  steps?: string[] | null;
  image_data?: string | null;
  date: string;
}

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enGB,
  es,
  de,
  fr,
  it,
  pt,
  cy,
};

function normalizeLevel(level: string): string {
  return level.toLowerCase().replace(/\s+/g, "-");
}

function getLevelColor(level: string): string {
  const l = normalizeLevel(level);
  if (["safe", "minor", "low-risk"].includes(l)) return "text-emerald-600 bg-emerald-50";
  if (["moderate", "suspicious"].includes(l)) return "text-amber-600 bg-amber-50";
  if (["serious", "scam", "high-risk"].includes(l)) return "text-red-600 bg-red-50";
  return "text-slate-600 bg-slate-50";
}

function getLevelIcon(level: string) {
  const l = normalizeLevel(level);
  if (["safe", "minor", "low-risk"].includes(l)) return ShieldCheck;
  if (["serious", "scam", "high-risk"].includes(l)) return AlertTriangle;
  return ShieldAlert;
}

function getBadgeColor(type: string): string {
  if (type === "wound") return "bg-rose-100 text-rose-700";
  if (type === "home")  return "bg-sky-100 text-sky-700";
  return "bg-violet-100 text-violet-700";
}

function HistoryCard({ item, dateLocale }: { item: HistoryItem; dateLocale: Locale }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const level = item.level ?? "";
  const LevelIcon = getLevelIcon(level);
  const levelColor = getLevelColor(level);
  const badgeColor = getBadgeColor(item.scan_type);
  const levelLabel = level.replace(/-/g, " ");

  const hasDetails =
    !!item.advice ||
    !!item.explanation ||
    (item.hazards && item.hazards.length > 0) ||
    (item.steps && item.steps.length > 0);

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
      data-testid={`history-card-${item.scan_type}-${item.id}`}
    >
      <button
        className="w-full text-left p-4 flex gap-3 items-start"
        onClick={() => hasDetails && setExpanded((e) => !e)}
        data-testid={`history-card-toggle-${item.id}`}
        aria-expanded={expanded}
      >
        {item.image_data && (
          <img
            src={item.image_data}
            alt={item.result_title}
            className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            data-testid={`history-thumbnail-${item.id}`}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
              {t(`history.badge.${item.scan_type}`)}
            </span>
            {levelLabel && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${levelColor}`}>
                <LevelIcon size={11} />
                {levelLabel}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
            {item.result_title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: dateLocale })}
          </p>
        </div>

        {hasDetails && (
          <div className="flex-shrink-0 self-center text-slate-400 ml-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {expanded && hasDetails && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-slate-50">
          {(item.advice || item.explanation) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-1">
                {t("history.advice")}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {item.advice ?? item.explanation}
              </p>
            </div>
          )}

          {item.hazards && item.hazards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {t("history.hazards")}
              </p>
              <ul className="flex flex-col gap-1">
                {item.hazards.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.steps && item.steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {t("history.steps")}
              </p>
              <ol className="flex flex-col gap-1">
                {item.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_FNS_LOCALES[i18n.language.split("-")[0]] ?? enGB;

  const { data, isLoading } = useQuery<HistoryItem[]>({
    queryKey: ["/api/history/scans"],
  });

  return (
    <div className="min-h-screen bg-vyva-background pb-28">
      <div className="sticky top-0 z-10 bg-vyva-background pt-10 pb-3 px-5 border-b border-slate-100">
        <p className="text-xs font-semibold text-vyva-accent uppercase tracking-widest mb-0.5">
          {t("history.subtitle")}
        </p>
        <h1 className="text-2xl font-bold text-slate-800" data-testid="history-title">
          {t("history.title")}
        </h1>
      </div>

      <div className="px-4 pt-4">
        {isLoading && (
          <div className="flex flex-col gap-3" data-testid="history-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border border-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            data-testid="history-empty"
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ClipboardList size={28} className="text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-700 mb-1">
              {t("history.empty")}
            </p>
            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
              {t("history.emptySubtitle")}
            </p>
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="flex flex-col gap-3" data-testid="history-list">
            {data.map((item) => (
              <HistoryCard
                key={`${item.scan_type}-${item.id}`}
                item={item}
                dateLocale={dateLocale}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
