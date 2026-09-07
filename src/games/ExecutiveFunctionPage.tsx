import { useLanguage } from "@/i18n";
import { BrainCoachFlowShell } from "@/components/brain/BrainCoachFlowShell";
import BrainCoachActivityGrid from "./BrainCoachActivityGrid";
import { getBrainCoachModule } from "./brainCoachCatalog";

export default function ExecutiveFunctionPage() {
  const { t } = useLanguage();
  const module = getBrainCoachModule("thinking");
  const title = t(module.titleKey, module.title);

  return (
    <BrainCoachFlowShell
      testId="executive-function-flow-shell"
      title={title}
      icon={module.icon}
      iconAccent={module.iconAccent}
      iconBg={module.tone.iconBg}
      iconColor={module.tone.iconColor}
      presentationId={module.presentationId}
      sceneId={module.sceneId}
    >
      <BrainCoachActivityGrid moduleId="thinking" />
    </BrainCoachFlowShell>
  );
}
