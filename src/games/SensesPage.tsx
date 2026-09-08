import { useLanguage } from "@/i18n";
import { BrainCoachFlowShell } from "@/components/brain/BrainCoachFlowShell";
import BrainCoachActivityGrid from "./BrainCoachActivityGrid";
import { getBrainCoachModule } from "./brainCoachCatalog";

export default function SensesPage() {
  const { t } = useLanguage();
  const module = getBrainCoachModule("senses");

  return (
    <BrainCoachFlowShell
      testId="senses-flow-shell"
      title={t(module.titleKey, module.title)}
      icon={module.icon}
      iconAccent={module.iconAccent}
      iconBg={module.tone.iconBg}
      iconColor={module.tone.iconColor}
      presentationId={module.presentationId}
      sceneId={module.sceneId}
    >
      <BrainCoachActivityGrid moduleId="senses" />
    </BrainCoachFlowShell>
  );
}
