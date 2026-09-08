import { useTranslation } from "react-i18next";
import {
  Building2,
  CheckCircle,
  ClipboardList,
  FileText,
  MapPin,
  MessageSquareReply,
  Phone,
  Pill,
  ReceiptText,
  Save,
  ShieldCheck,
  ShoppingBasket,
  Star,
  Tags,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  showVyvaFollowUpActionsFor,
  type ShowVyvaFollowUpAction,
  type ShowVyvaFollowUpActionId,
  type ShowVyvaFollowUpContext,
  type ShowVyvaFollowUpIcon,
  type ShowVyvaFollowUpTone,
} from "../../shared/showVyvaFollowUp";

type ShowVyvaFollowUpPanelProps = {
  context: ShowVyvaFollowUpContext;
  actions?: ShowVyvaFollowUpAction[];
  title?: string;
  subtitle?: string;
  confirmation?: string;
  testIdSuffix?: string;
  onSelect: (action: ShowVyvaFollowUpAction) => void;
};

const ICONS: Record<ShowVyvaFollowUpIcon, LucideIcon> = {
  building: Building2,
  phone: Phone,
  save: Save,
  concierge: ClipboardList,
  basket: ShoppingBasket,
  quote: Wrench,
  check: CheckCircle,
  pill: Pill,
  shield: ShieldCheck,
  document: FileText,
  reply: MessageSquareReply,
  price: Tags,
  map: MapPin,
  star: Star,
  terms: ReceiptText,
};

const TONES: Record<ShowVyvaFollowUpTone, { bg: string; text: string; border: string }> = {
  primary: { bg: "#6B21A8", text: "#FFFFFF", border: "#6B21A8" },
  safe: { bg: "#ECFDF5", text: "#047857", border: "#BBF7D0" },
  warm: { bg: "#FFF7ED", text: "#B45309", border: "#FED7AA" },
  quiet: { bg: "#FFFFFF", text: "#3D2C47", border: "#EDE5DB" },
};

export default function ShowVyvaFollowUpPanel({
  context,
  actions,
  title,
  subtitle,
  confirmation,
  testIdSuffix = context,
  onSelect,
}: ShowVyvaFollowUpPanelProps) {
  const { t } = useTranslation();
  const items = actions ?? showVyvaFollowUpActionsFor(context);

  if (!items.length) return null;

  return (
    <section
      data-testid={`show-vyva-follow-up-${testIdSuffix}`}
      className="mt-3 rounded-[18px] border border-[#EDE5DB] bg-white/85 p-3 shadow-[0_10px_24px_rgba(63,45,35,0.07)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F0FDFA] text-[#0F766E]">
          <ShieldCheck size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {t("showVyva.followUp.kicker", "Next safe step")}
          </p>
          <h3 className="mt-0.5 font-body text-[17px] font-black leading-tight text-vyva-text-1">
            {title ?? t(`showVyva.followUp.title.${context}`, "What should VYVA do next?")}
          </h3>
          <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
            {subtitle ?? t(`showVyva.followUp.subtitle.${context}`, "Choose one step. You stay in control.")}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((action) => {
          const Icon = ICONS[action.icon];
          const tone = TONES[action.tone];
          return (
            <button
              key={action.id}
              type="button"
              data-testid={`button-show-vyva-follow-up-${action.id}-${testIdSuffix}`}
              onClick={() => onSelect(action)}
              className="vyva-tap flex min-h-[58px] items-center gap-3 rounded-[16px] border px-3 py-2 text-left transition active:scale-[0.98]"
              style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white/70">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[14px] font-black leading-tight">
                  {t(`showVyva.followUp.action.${action.id}.label`, action.label)}
                </span>
                <span className="sr-only">
                  {t(`showVyva.followUp.action.${action.id}.detail`, action.detail)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 rounded-[13px] bg-[#FFFCF8] px-3 py-2 font-body text-[12px] font-bold leading-snug text-[#6F5F59]">
        {confirmation ?? t(
          "showVyva.followUp.confirmation",
          "VYVA prepares the next step first. You confirm before anything is sent, bought, booked, called, uploaded, or shared.",
        )}
      </p>
    </section>
  );
}

export type { ShowVyvaFollowUpAction, ShowVyvaFollowUpActionId };
