import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Search, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VoiceHero from "@/components/VoiceHero";
import { EmptyState, FormField } from "@/components/vyva-ui";
import { apiFetch } from "@/lib/queryClient";
import type {
  BenefitsCountry,
  BenefitsLivingSituation,
  BenefitsProgramResult,
  BenefitsScreeningAnswers,
} from "../../shared/benefits";

const fieldClassName = "min-h-[54px] w-full rounded-[18px] border border-[#D9D3DF] bg-white px-4 font-body text-[17px] font-semibold text-vyva-text-1 outline-none focus:border-[#0A6B4A] focus:ring-2 focus:ring-[#BFE3D0]";

const currentBenefitOptions: Record<BenefitsCountry, { value: string; labelKey: string; fallback: string }[]> = {
  ES: [
    { value: "es-pnc", labelKey: "benefits.currentPrograms.esPnc", fallback: "Non-contributory pension" },
    { value: "es-imv", labelKey: "benefits.currentPrograms.esImv", fallback: "Minimum Living Income" },
  ],
  DE: [
    { value: "de-grundsicherung", labelKey: "benefits.currentPrograms.deGrundsicherung", fallback: "Basic income support in old age" },
    { value: "de-wohngeld", labelKey: "benefits.currentPrograms.deWohngeld", fallback: "Housing benefit" },
  ],
};

const initialAnswers: BenefitsScreeningAnswers = {
  country: "ES",
  region: "",
  age: 65,
  livingSituation: "alone",
  currentBenefits: [],
};

export default function BenefitsNavigatorScreen() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [answers, setAnswers] = useState<BenefitsScreeningAnswers>(initialAnswers);
  const [results, setResults] = useState<BenefitsProgramResult[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCurrentBenefit = (value: string, checked: boolean) => {
    setAnswers((current) => ({
      ...current,
      currentBenefits: checked
        ? [...current.currentBenefits, value]
        : current.currentBenefits.filter((item) => item !== value),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResults(null);
    try {
      const response = await apiFetch("/api/benefits/screenings?lang=" + encodeURIComponent(i18n.language), {
        method: "POST",
        body: JSON.stringify(answers),
      });
      if (!response.ok) throw new Error("screening failed");
      const payload = await response.json() as { results: BenefitsProgramResult[] };
      setResults(payload.results);
    } catch {
      setError(t("benefits.error", "We could not check benefits right now. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const askInes = (starter?: string) => {
    const suffix = starter ? "?starter=" + encodeURIComponent(starter) : "";
    navigate("/social-rooms/experts/ines" + suffix);
  };

  return (
    <main className="vyva-page pb-[120px]" data-testid="benefits-navigator-screen">
      <button
        type="button"
        onClick={() => navigate("/social-rooms")}
        className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
        data-testid="button-benefits-back"
      >
        <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
        {t("benefits.back", "Back to Community")}
      </button>

      <VoiceHero
        headline={t("benefits.heroTitle", "Find support you may be missing")}
        subtitle={t("benefits.heroSubtitle", "Answer a few questions, or talk to Inés for personal guidance.")}
        contextHint="Benefits Navigator. Help the user understand possible pensions, care benefits, and financial support. Never guarantee eligibility."
        voiceAgentSlug="ines"
        voiceDynamicVariables={{ app_entrypoint: "benefits_navigator", advisor_slug: "ines" }}
        talkLabel={t("benefits.talkToInes", "Talk to Inés")}
        chatLabel={t("benefits.chatWithInes", "Chat with Inés")}
        onChatClick={() => askInes()}
        showVoiceOverlay={false}
        compact
      />

      <section className="mt-5 rounded-[28px] border border-[#DCE9E2] bg-white p-5 shadow-vyva-card min-[640px]:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#EAF3EE] text-[#0A6B4A]">
            <ShieldCheck size={25} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <div>
            <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-[#0A6B4A]">
              {t("benefits.screenerEyebrow", "Quick check")}
            </p>
            <h1 className="font-display text-[30px] leading-tight text-vyva-text-1">
              {t("benefits.screenerTitle", "Tell us about your situation")}
            </h1>
            <p className="mt-1 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
              {t("benefits.screenerBody", "This is a first check, not an official decision.")}
            </p>
          </div>
        </div>

        <form className="mt-6 grid gap-5" onSubmit={handleSubmit} data-testid="benefits-screening-form">
          <FormField label={t("benefits.country", "Country")} htmlFor="benefits-country" required>
            <select
              id="benefits-country"
              value={answers.country}
              onChange={(event) => setAnswers((current) => ({
                ...current,
                country: event.target.value as BenefitsCountry,
                currentBenefits: [],
              }))}
              className={fieldClassName}
            >
              <option value="ES">{t("benefits.countries.spain", "Spain")}</option>
              <option value="DE">{t("benefits.countries.germany", "Germany")}</option>
            </select>
          </FormField>

          <FormField
            label={t("benefits.region", "Region")}
            htmlFor="benefits-region"
            hint={t("benefits.regionHint", "Optional — add your autonomous community or federal state.")}
          >
            <input
              id="benefits-region"
              value={answers.region ?? ""}
              onChange={(event) => setAnswers((current) => ({ ...current, region: event.target.value }))}
              className={fieldClassName}
              maxLength={120}
            />
          </FormField>

          <FormField label={t("benefits.age", "Age")} htmlFor="benefits-age" required>
            <input
              id="benefits-age"
              type="number"
              min={18}
              max={120}
              value={answers.age}
              onChange={(event) => setAnswers((current) => ({ ...current, age: Number(event.target.value) }))}
              className={fieldClassName}
            />
          </FormField>

          <FormField label={t("benefits.livingSituation", "Living situation")} htmlFor="benefits-living" required>
            <select
              id="benefits-living"
              value={answers.livingSituation}
              onChange={(event) => setAnswers((current) => ({
                ...current,
                livingSituation: event.target.value as BenefitsLivingSituation,
              }))}
              className={fieldClassName}
            >
              <option value="alone">{t("benefits.living.alone", "I live alone")}</option>
              <option value="partner">{t("benefits.living.partner", "I live with a partner")}</option>
              <option value="family">{t("benefits.living.family", "I live with family")}</option>
              <option value="care_home">{t("benefits.living.careHome", "I live in supported care")}</option>
              <option value="other">{t("benefits.living.other", "Something else")}</option>
            </select>
          </FormField>

          <FormField
            label={t("benefits.current", "Support you already receive")}
            hint={t("benefits.currentHint", "Select any that apply. Leave blank if none apply.")}
          >
            <div className="grid gap-2">
              {currentBenefitOptions[answers.country].map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[18px] border border-[#E5DFE9] bg-[#FFFCF8] px-4 font-body text-[16px] font-bold text-vyva-text-1"
                >
                  <input
                    type="checkbox"
                    checked={answers.currentBenefits.includes(option.value)}
                    onChange={(event) => updateCurrentBenefit(option.value, event.target.checked)}
                    className="h-5 w-5 accent-[#0A6B4A]"
                  />
                  {t(option.labelKey, option.fallback)}
                </label>
              ))}
            </div>
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting || answers.age < 18 || answers.age > 120}
            className="vyva-tap flex min-h-[60px] items-center justify-center gap-2 rounded-full bg-[#0A6B4A] px-6 font-body text-[19px] font-black text-white shadow-[0_12px_24px_rgba(10,107,74,0.20)] disabled:opacity-55"
            data-testid="button-benefits-check"
          >
            <Search size={21} strokeWidth={2.5} aria-hidden="true" />
            {isSubmitting ? t("benefits.checking", "Checking...") : t("benefits.check", "Check my benefits")}
          </button>
        </form>
      </section>

      <section className="mt-6" aria-live="polite" data-testid="benefits-results">
        {isSubmitting ? (
          <EmptyState
            icon={Search}
            title={t("benefits.loadingTitle", "Checking available support")}
            description={t("benefits.loadingBody", "We are comparing your answers with reviewed programmes.")}
          />
        ) : error ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("benefits.errorTitle", "We could not complete the check")}
            description={error}
            action={(
              <button type="button" onClick={() => setError(null)} className="vyva-tap min-h-[48px] rounded-full bg-vyva-purple px-5 font-body font-black text-white">
                {t("benefits.tryAgain", "Try again")}
              </button>
            )}
          />
        ) : results && results.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("benefits.emptyTitle", "No reviewed matches yet")}
            description={t("benefits.emptyBody", "Benefits content is added only after review. Inés can still help you understand what to check next.")}
            action={(
              <button type="button" onClick={() => askInes()} className="vyva-tap min-h-[48px] rounded-full bg-[#0A6B4A] px-5 font-body font-black text-white">
                {t("benefits.talkToInes", "Talk to Inés")}
              </button>
            )}
          />
        ) : results ? (
          <div className="grid gap-4">
            <div>
              <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-[#0A6B4A]">
                {t("benefits.resultsEyebrow", "Possible matches")}
              </p>
              <h2 className="font-display text-[30px] leading-tight text-vyva-text-1">
                {t("benefits.resultsTitle", "Support worth checking")}
              </h2>
            </div>
            {results.map((program) => {
              const expanded = expandedId === program.id;
              return (
                <article key={program.id} className="rounded-[24px] border border-[#BFE3D0] bg-white p-5 shadow-vyva-card">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={25} className="mt-0.5 shrink-0 text-[#0A6B4A]" aria-hidden="true" />
                    <h3 className="font-body text-[20px] font-black leading-tight text-vyva-text-1">{program.name}</h3>
                  </div>
                  {expanded ? (
                    <p className="mt-3 font-body text-[16px] font-semibold leading-relaxed text-vyva-text-2">{program.description}</p>
                  ) : null}
                  <div className="mt-4 grid gap-2 min-[520px]:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : program.id)}
                      className="vyva-tap flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#BFE3D0] bg-[#F4FAF6] px-4 font-body font-black text-[#0A6B4A]"
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                      {expanded ? t("benefits.hideExplanation", "Hide explanation") : t("benefits.readExplanation", "Read explanation")}
                    </button>
                    <button
                      type="button"
                      onClick={() => askInes(program.askInesStarter)}
                      className="vyva-tap min-h-[48px] rounded-full bg-[#0A6B4A] px-4 font-body font-black text-white"
                    >
                      {t("benefits.askInes", "Ask Inés about this")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
