import { CONTACT_CHANNEL_OPTIONS, type ContactChannelId } from "@/lib/contactChannels";

type ContactChannelPickerProps = {
  value: ContactChannelId;
  onChange: (value: ContactChannelId) => void;
  t: (key: string, fallback?: string) => string;
  testIdPrefix: string;
  ariaLabel?: string;
};

export function ContactChannelPicker({ value, onChange, t, testIdPrefix, ariaLabel }: ContactChannelPickerProps) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label={ariaLabel}>
      {CONTACT_CHANNEL_OPTIONS.map((channel) => {
        const Icon = channel.icon;
        const active = value === channel.id;

        return (
          <button
            key={channel.id}
            data-testid={`${testIdPrefix}-${channel.id}`}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(channel.id)}
            className={`flex w-full items-center gap-3 rounded-[22px] border-2 p-4 text-left transition-colors ${
              active ? "border-vyva-purple bg-[#F5F3FF]" : "border-[#EFE7DB] bg-white hover:border-[#E1D6C8]"
            }`}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
              style={{ background: channel.iconBg }}
            >
              <Icon size={20} style={{ color: channel.iconColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[15px] font-extrabold text-vyva-text-1">{t(channel.labelKey)}</p>
              <p className="sr-only">{t(channel.subKey)}</p>
            </div>
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                active ? "bg-vyva-purple" : "border-2 border-[#E4D4F4] bg-white"
              }`}
              aria-hidden="true"
            >
              {active && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
