import { useState } from "react";
import { MessageCircle, Phone, HeartPulse, Brain, Shield, Share2, Clock, AlertTriangle, Mic, Users } from "lucide-react";
import { margaret } from "@/data/mockData";

interface ToggleRowProps {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  sub: string;
  value?: boolean;
  onToggle?: () => void;
  rightContent?: React.ReactNode;
}

const ToggleRow = ({ icon: Icon, iconBg, iconColor, label, sub, value, onToggle, rightContent }: ToggleRowProps) => (
  <div className="flex items-center gap-3 px-4 py-[13px] border-t border-vyva-border">
    <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
      <Icon size={18} style={{ color: iconColor }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-body text-[15px] font-medium text-vyva-text-1">{label}</p>
      <p className="font-body text-[12px] text-vyva-text-2">{sub}</p>
    </div>
    {rightContent || (
      onToggle ? (
        <button
          onClick={onToggle}
          className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${value ? "bg-vyva-purple" : ""}`}
          style={!value ? { background: "#DDD5C8" } : {}}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${value ? "left-[22px]" : "left-0.5"}`} />
        </button>
      ) : null
    )}
  </div>
);

const SettingsScreen = () => {
  const [toggles, setToggles] = useState({
    medReminders: true, adherence: true, fall: false, location: false,
    brainCoach: true, shareFamily: true, shareCarer: true, shareDoctor: false,
  });

  const toggle = (key: keyof typeof toggles) => setToggles(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="px-[22px]">
      {/* Profile */}
      <div className="mt-[14px] rounded-[22px] bg-vyva-warm2 p-[18px] flex items-center gap-[14px]">
        <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#6B21A8" }}>
          <span className="font-body text-[20px] font-medium text-white">{margaret.initials}</span>
        </div>
        <div>
          <h1 className="font-display text-[20px] font-medium text-vyva-text-1">{margaret.name}</h1>
          <p className="font-body text-[13px] text-vyva-text-2">Your VYVA preferences · Always in your control</p>
        </div>
      </div>

      {/* Companion */}
      <Section title="COMPANION" badge="Always on" badgeColor="bg-vyva-purple-light text-vyva-purple">
        <ToggleRow icon={MessageCircle} iconBg="#F5F3FF" iconColor="#6B21A8" label="Daily conversations" sub="VYVA chats with you each day"
          rightContent={<span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full bg-vyva-gold-light text-vyva-gold">Core</span>} />
        <ToggleRow icon={Phone} iconBg="#F5F3FF" iconColor="#6B21A8" label="Check-ins" sub="Regular wellbeing checks"
          rightContent={<span className="font-body text-[12px] font-medium px-2 py-0.5 rounded-full bg-vyva-gold-light text-vyva-gold">Core</span>} />
      </Section>

      {/* Medication */}
      <Section title="MEDICATION MANAGEMENT">
        <ToggleRow icon={HeartPulse} iconBg="#ECFDF5" iconColor="#0A7C4E" label="Medication reminders" sub="Alerts when meds are due" value={toggles.medReminders} onToggle={() => toggle("medReminders")} />
        <ToggleRow icon={HeartPulse} iconBg="#ECFDF5" iconColor="#0A7C4E" label="Adherence tracking" sub="Track what you've taken" value={toggles.adherence} onToggle={() => toggle("adherence")} />
      </Section>

      {/* Safety */}
      <Section title="SAFETY MONITORING" badge="Your choice" badgeColor="bg-vyva-rose-light text-vyva-rose">
        <ToggleRow icon={Shield} iconBg="#FEF2F2" iconColor="#B91C1C" label="Fall detection" sub="Alert family if a fall is detected" value={toggles.fall} onToggle={() => toggle("fall")} />
        <ToggleRow icon={Shield} iconBg="#FEF2F2" iconColor="#B91C1C" label="Location sharing" sub="Share your location with family" value={toggles.location} onToggle={() => toggle("location")} />
        <div className="px-[14px] py-[10px] bg-vyva-gold-light border-t border-[#FDE68A] flex items-start gap-2">
          <AlertTriangle size={14} className="text-vyva-gold mt-0.5 flex-shrink-0" />
          <span className="font-body text-[12px]" style={{ color: "#92400E" }}>Off by default. Only enabled with your explicit agreement.</span>
        </div>
      </Section>

      {/* Brain Coach */}
      <Section title="BRAIN COACH">
        <ToggleRow icon={Brain} iconBg="#EDE9FE" iconColor="#6B21A8" label="Brain coach sessions" sub="Daily brain training activities" value={toggles.brainCoach} onToggle={() => toggle("brainCoach")} />
        <ToggleRow icon={Clock} iconBg="#EDE9FE" iconColor="#6B21A8" label="Session frequency" sub="How often to suggest activities"
          rightContent={<span className="font-body text-[14px] text-vyva-text-2">Daily</span>} />
      </Section>

      {/* Sharing */}
      <Section title="WHAT I SHARE & WITH WHOM">
        <ToggleRow icon={Users} iconBg="#F0FDFA" iconColor="#0F766E" label="Share with family" sub="Sarah & James see daily updates" value={toggles.shareFamily} onToggle={() => toggle("shareFamily")} />
        <ToggleRow icon={Users} iconBg="#F0FDFA" iconColor="#0F766E" label="Share with carer" sub="Linda sees health notes & meds" value={toggles.shareCarer} onToggle={() => toggle("shareCarer")} />
        <ToggleRow icon={Share2} iconBg="#F0FDFA" iconColor="#0F766E" label="Share with doctor" sub="Health summaries on request" value={toggles.shareDoctor} onToggle={() => toggle("shareDoctor")} />
      </Section>

      <div className="h-4" />
    </div>
  );
};

const Section = ({ title, badge, badgeColor, children }: { title: string; badge?: string; badgeColor?: string; children: React.ReactNode }) => (
  <div className="mt-3 bg-white rounded-[18px] border border-vyva-border overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
    <div className="flex items-center justify-between px-4 py-[11px] bg-vyva-warm border-b border-vyva-border">
      <span className="font-body text-[12px] font-medium text-vyva-text-2 uppercase tracking-wider">{title}</span>
      {badge && <span className={`font-body text-[11px] font-medium px-2 py-0.5 rounded-[7px] ${badgeColor}`}>{badge}</span>}
    </div>
    {children}
  </div>
);

export default SettingsScreen;
