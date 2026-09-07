import { useLanguage } from "@/i18n";
import { BrainCoachFlowShell } from "@/components/brain/BrainCoachFlowShell";
import BrainCoachActivityGrid from "./BrainCoachActivityGrid";
import { getBrainCoachModule } from "./brainCoachCatalog";

export default function AttentionBoostersPage() {
  const { t } = useLanguage();
  const module = getBrainCoachModule("reflexes");
  const title = t(module.titleKey, module.title);

  return (
    <BrainCoachFlowShell
      testId="attention-boosters-flow-shell"
      title={title}
      icon={module.icon}
      iconAccent={module.iconAccent}
      iconBg={module.tone.iconBg}
      iconColor={module.tone.iconColor}
      presentationId={module.presentationId}
      sceneId={module.sceneId}
    >
      <BrainCoachActivityGrid moduleId="reflexes" />
    </BrainCoachFlowShell>
  );
}
