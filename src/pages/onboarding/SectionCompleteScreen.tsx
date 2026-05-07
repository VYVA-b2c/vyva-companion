import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

const SECTION_LABELS: Record<string, { title: string; message: string }> = {
  gp: { title: "GP details saved", message: "VYVA now knows who to contact about your health." },
  providers: { title: "Providers saved", message: "Your pharmacy and specialist details are on file." },
  basics: { title: "Basics saved", message: "Your personal details are looking good." },
  contact: { title: "Contact details saved", message: "We know where to reach you." },
  health: { title: "Health conditions saved", message: "VYVA will keep this in mind during conversations." },
  medications: { title: "Medications saved", message: "Reminders and adherence tracking are ready." },
  allergies: { title: "Allergies saved", message: "Important — VYVA will remember these." },
  "care-team": { title: "Care team added", message: "Your loved ones can now receive updates." },
  careteam:    { title: "Care team added", message: "Your loved ones can now receive updates." },
  emergency: { title: "Emergency plan saved", message: "You're better prepared for any situation." },
};

const DEFAULT = { title: "Section complete!", message: "Thanks for filling in this section." };

const SectionCompleteScreen = () => {
  const navigate = useNavigate();
  const { section = "" } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const info = SECTION_LABELS[section] ?? DEFAULT;
  const returnTo = searchParams.get("returnTo");

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-center px-6 gap-8">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl"
        style={{ background: "#ECFDF5" }}
        data-testid="icon-section-complete"
      >
        <CheckCircle2 size={48} className="text-vyva-green" />
      </div>

      <div className="text-center space-y-2">
        <h1
          className="font-display text-[26px] font-semibold text-vyva-text-1"
          data-testid="text-section-complete-title"
        >
          {info.title}
        </h1>
        <p
          className="font-body text-[15px] text-vyva-text-2 max-w-[280px] leading-relaxed"
          data-testid="text-section-complete-message"
        >
          {info.message}
        </p>
      </div>

      <div className="w-full max-w-[380px] space-y-3">
        <button
          data-testid="button-complete-back-to-profile"
          onClick={() => navigate(returnTo || "/onboarding/profile")}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white"
          style={{ background: "#6B21A8" }}
        >
          {returnTo ? "Continue" : "Back to my profile"}
        </button>
        <button
          data-testid="button-complete-go-home"
          onClick={() => navigate("/")}
          className="w-full py-3 rounded-full font-body text-[15px] font-medium text-vyva-text-2"
        >
          Go to VYVA
        </button>
      </div>
    </div>
  );
};

export default SectionCompleteScreen;
