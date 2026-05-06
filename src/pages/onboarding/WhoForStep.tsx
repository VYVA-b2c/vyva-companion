import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, HeartHandshake, UserRound, UsersRound } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";

type SetupChoice = "self" | "someone_else";

type WhoForCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  continue: string;
  saving: string;
  choices: Record<SetupChoice, { title: string; subtitle: string }>;
};

const COPY: Record<LanguageCode, WhoForCopy> = {
  en: {
    eyebrow: "Profile setup",
    title: "Who is VYVA for?",
    subtitle: "Your login stays yours. The care profile belongs to the person receiving support.",
    continue: "Continue",
    saving: "Setting up...",
    choices: {
      self: {
        title: "Myself",
        subtitle: "I am the person who will use VYVA.",
      },
      someone_else: {
        title: "Someone I care for",
        subtitle: "I am a family member or caregiver setting this up.",
      },
    },
  },
  es: {
    eyebrow: "Configuración del perfil",
    title: "¿Para quién es VYVA?",
    subtitle: "Tu cuenta sigue siendo tuya. El perfil de cuidado pertenece a la persona que recibe apoyo.",
    continue: "Continuar",
    saving: "Preparando...",
    choices: {
      self: {
        title: "Para mí",
        subtitle: "Soy la persona que usará VYVA.",
      },
      someone_else: {
        title: "Para alguien que cuido",
        subtitle: "Soy familiar o cuidador y lo estoy configurando.",
      },
    },
  },
  fr: {
    eyebrow: "Configuration du profil",
    title: "Pour qui est VYVA ?",
    subtitle: "Votre compte reste le vôtre. Le profil de soin appartient à la personne accompagnée.",
    continue: "Continuer",
    saving: "Préparation...",
    choices: {
      self: {
        title: "Pour moi",
        subtitle: "Je suis la personne qui utilisera VYVA.",
      },
      someone_else: {
        title: "Pour une personne aidée",
        subtitle: "Je suis un proche ou un aidant et je configure VYVA.",
      },
    },
  },
  de: {
    eyebrow: "Profil einrichten",
    title: "Für wen ist VYVA?",
    subtitle: "Dein Login bleibt deiner. Das Pflegeprofil gehört der Person, die Unterstützung erhält.",
    continue: "Weiter",
    saving: "Einrichten...",
    choices: {
      self: {
        title: "Für mich",
        subtitle: "Ich bin die Person, die VYVA nutzen wird.",
      },
      someone_else: {
        title: "Für jemanden, den ich betreue",
        subtitle: "Ich richte VYVA als Familienmitglied oder Betreuungsperson ein.",
      },
    },
  },
  it: {
    eyebrow: "Configurazione profilo",
    title: "Per chi è VYVA?",
    subtitle: "Il tuo accesso resta tuo. Il profilo di cura appartiene alla persona assistita.",
    continue: "Continua",
    saving: "Preparazione...",
    choices: {
      self: {
        title: "Per me",
        subtitle: "Sono la persona che userà VYVA.",
      },
      someone_else: {
        title: "Per qualcuno di cui mi prendo cura",
        subtitle: "Sono un familiare o caregiver e lo sto configurando.",
      },
    },
  },
  pt: {
    eyebrow: "Configuração do perfil",
    title: "Para quem é a VYVA?",
    subtitle: "O seu acesso continua a ser seu. O perfil de cuidado pertence à pessoa apoiada.",
    continue: "Continuar",
    saving: "A preparar...",
    choices: {
      self: {
        title: "Para mim",
        subtitle: "Sou a pessoa que vai usar a VYVA.",
      },
      someone_else: {
        title: "Para alguém de quem cuido",
        subtitle: "Sou familiar ou cuidador e estou a configurar.",
      },
    },
  },
  cy: {
    eyebrow: "Profile setup",
    title: "Who is VYVA for?",
    subtitle: "Your login stays yours. The care profile belongs to the person receiving support.",
    continue: "Continue",
    saving: "Setting up...",
    choices: {
      self: {
        title: "Myself",
        subtitle: "I am the person who will use VYVA.",
      },
      someone_else: {
        title: "Someone I care for",
        subtitle: "I am a family member or caregiver setting this up.",
      },
    },
  },
};

const CHOICES: Array<{
  id: SetupChoice;
  icon: typeof UserRound;
  testId: string;
}> = [
  {
    id: "self",
    icon: UserRound,
    testId: "button-setup-for-self",
  },
  {
    id: "someone_else",
    icon: UsersRound,
    testId: "button-setup-for-someone-else",
  },
];

export default function WhoForStep() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.es;
  const [selected, setSelected] = useState<SetupChoice>("self");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await apiFetch("/api/onboarding/start-profile", {
        method: "POST",
        body: JSON.stringify({ setup_for: selected, language }),
      });
      if (!res.ok) {
        setError(await friendlyError(null, res));
        return;
      }
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      navigate(data.nextRoute ?? "/onboarding/basics", { replace: true });
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingChrome mainClassName="flex min-h-[calc(100vh-92px)] max-w-[540px] flex-col justify-center">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F5F3FF] text-vyva-purple shadow-[0_16px_40px_rgba(107,33,168,0.12)]">
          <HeartHandshake size={30} />
        </div>
        <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 font-display text-[46px] leading-[0.96] text-[#2E1642] sm:text-[54px]">
          {copy.title}
        </h1>
        <p className="mx-auto mt-4 max-w-[380px] font-body text-[15px] leading-[1.55] text-vyva-text-2">
          {copy.subtitle}
        </p>
      </div>

      <div className="rounded-[34px] border border-[#EFE7DB] bg-white/95 p-4 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur">
        <div className="space-y-3">
          {CHOICES.map((choice) => {
            const Icon = choice.icon;
            const active = selected === choice.id;
            const option = copy.choices[choice.id];
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setSelected(choice.id)}
                data-testid={choice.testId}
                className={`flex w-full items-center gap-4 rounded-[24px] border-2 p-4 text-left transition ${
                  active
                    ? "border-vyva-purple bg-[#F5F3FF]"
                    : "border-[#EFE7DB] bg-white hover:border-[#E1D6C8]"
                }`}
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-vyva-purple shadow-vyva-input">
                  <Icon size={23} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[16px] font-extrabold text-vyva-text-1">{option.title}</span>
                  <span className="mt-0.5 block font-body text-[13px] leading-[1.4] text-vyva-text-2">{option.subtitle}</span>
                </span>
                <span className={`h-5 w-5 rounded-full border-2 ${active ? "border-vyva-purple bg-vyva-purple" : "border-[#D8CFC2]"}`}>
                  {active && <span className="mx-auto mt-[5px] block h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p data-testid="text-who-for-error" className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          data-testid="button-who-for-continue"
          className="vyva-primary-action mt-5 w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
        >
          {saving ? copy.saving : copy.continue}
          {!saving && <ArrowRight size={17} />}
        </button>
      </div>
    </OnboardingChrome>
  );
}
