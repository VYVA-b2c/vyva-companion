import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HeartHandshake, UserRound, UsersRound } from "lucide-react";
import { OnboardingStepLayout } from "@/components/onboarding/OnboardingStepLayout";
import { currentCareTeamInviteReturnPath } from "@/lib/careTeamInviteReturn";
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
    title: "Set up your VYVA profile",
    subtitle: "One last setup detail so VYVA knows whose care profile to create.",
    continue: "Continue",
    saving: "Setting up...",
    choices: {
      self: {
        title: "For me",
        subtitle: "Create a profile for my own health, reminders, and support.",
      },
      someone_else: {
        title: "For someone I support",
        subtitle: "Create a profile for a family member or person I care for.",
      },
    },
  },
  es: {
    eyebrow: "Configuración del perfil",
    title: "Configura tu perfil VYVA",
    subtitle: "Un último detalle para saber qué perfil de cuidado debemos crear.",
    continue: "Continuar",
    saving: "Preparando...",
    choices: {
      self: {
        title: "Para mí",
        subtitle: "Crear mi perfil de salud, recordatorios y apoyo.",
      },
      someone_else: {
        title: "Para alguien a quien apoyo",
        subtitle: "Crear un perfil para un familiar o una persona que cuido.",
      },
    },
  },
  fr: {
    eyebrow: "Configuration du profil",
    title: "Configurez votre profil VYVA",
    subtitle: "Un dernier détail pour savoir quel profil de soin créer.",
    continue: "Continuer",
    saving: "Préparation...",
    choices: {
      self: {
        title: "Pour moi",
        subtitle: "Créer mon profil de santé, rappels et accompagnement.",
      },
      someone_else: {
        title: "Pour une personne que j’aide",
        subtitle: "Créer un profil pour un proche ou une personne accompagnée.",
      },
    },
  },
  de: {
    eyebrow: "Profil einrichten",
    title: "VYVA-Profil einrichten",
    subtitle: "Ein letzter Schritt, damit VYVA weiß, welches Pflegeprofil erstellt werden soll.",
    continue: "Weiter",
    saving: "Einrichten...",
    choices: {
      self: {
        title: "Für mich",
        subtitle: "Mein eigenes Profil für Gesundheit, Erinnerungen und Unterstützung erstellen.",
      },
      someone_else: {
        title: "Für jemanden, den ich unterstütze",
        subtitle: "Ein Profil für ein Familienmitglied oder eine betreute Person erstellen.",
      },
    },
  },
  it: {
    eyebrow: "Configurazione profilo",
    title: "Configura il tuo profilo VYVA",
    subtitle: "Un ultimo dettaglio per sapere quale profilo di cura creare.",
    continue: "Continua",
    saving: "Preparazione...",
    choices: {
      self: {
        title: "Per me",
        subtitle: "Crea il mio profilo per salute, promemoria e supporto.",
      },
      someone_else: {
        title: "Per una persona che supporto",
        subtitle: "Crea un profilo per un familiare o una persona assistita.",
      },
    },
  },
  pt: {
    eyebrow: "Configuração do perfil",
    title: "Configure o seu perfil VYVA",
    subtitle: "Um último detalhe para saber que perfil de cuidado criar.",
    continue: "Continuar",
    saving: "A preparar...",
    choices: {
      self: {
        title: "Para mim",
        subtitle: "Criar o meu perfil de saúde, lembretes e apoio.",
      },
      someone_else: {
        title: "Para alguém que apoio",
        subtitle: "Criar um perfil para um familiar ou uma pessoa que acompanho.",
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
  const location = useLocation();
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.es;
  const [selected, setSelected] = useState<SetupChoice>(() => {
    const stateSetupFor = (location.state as { setupFor?: SetupChoice } | null)?.setupFor;
    const storedSetupFor = window.sessionStorage.getItem("vyva_setup_for");
    return stateSetupFor === "someone_else" || storedSetupFor === "someone_else" ? "someone_else" : "self";
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCareTeamInviteReturnPath = currentCareTeamInviteReturnPath();

  useEffect(() => {
    if (pendingCareTeamInviteReturnPath) {
      navigate(pendingCareTeamInviteReturnPath, { replace: true });
    }
  }, [navigate, pendingCareTeamInviteReturnPath]);

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
      window.sessionStorage.removeItem("vyva_setup_for");
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      navigate(data.nextRoute ?? "/onboarding/basics", { replace: true });
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  if (pendingCareTeamInviteReturnPath) return null;

  return (
    <OnboardingStepLayout
      action={{
        testId: "button-who-for-continue",
        label: copy.continue,
        savingLabel: copy.saving,
        isSaving: saving,
        disabled: saving,
        onClick: handleContinue,
      }}
      error={{ testId: "text-who-for-error", message: error }}
      eyebrow={copy.eyebrow}
      headerAlign="center"
      headerIcon={
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F5F3FF] text-vyva-purple shadow-[0_16px_40px_rgba(107,33,168,0.12)]">
          <HeartHandshake size={30} />
        </div>
      }
      maxWidthClassName="max-w-[540px]"
      subtitle={copy.subtitle}
      title={copy.title}
    >
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
                  <span className="sr-only">{option.subtitle}</span>
                </span>
                <span className={`h-5 w-5 rounded-full border-2 ${active ? "border-vyva-purple bg-vyva-purple" : "border-[#D8CFC2]"}`}>
                  {active && <span className="mx-auto mt-[5px] block h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
    </OnboardingStepLayout>
  );
}
