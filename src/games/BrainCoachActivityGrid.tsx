import { useNavigate } from "react-router-dom";
import { CanonicalBrainCoachActivityCard } from "@/components/brain/CanonicalBrainCoachActivityCard";
import { useLanguage } from "@/i18n";
import {
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityDisplay,
  getBrainCoachActivityPath,
  type BrainCoachModuleId,
} from "./brainCoachCatalog";

type BrainCoachActivityGridProps = {
  moduleId: BrainCoachModuleId;
};

export default function BrainCoachActivityGrid({ moduleId }: BrainCoachActivityGridProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const activities = getBrainCoachActivitiesForModule(moduleId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5" data-scene-layout="activity_grid">
      {activities.map((activity) => {
        const copy = getBrainCoachActivityDisplay(activity, t);

        return (
          <CanonicalBrainCoachActivityCard
            key={activity.id}
            type="button"
            onClick={() => navigate(getBrainCoachActivityPath(activity.id))}
            title={copy.title}
            icon={activity.icon}
            iconAccent={activity.iconAccent}
            iconBg={activity.iconBg}
            iconColor={activity.iconColor}
            borderColor={activity.borderColor}
            badge={copy.badge}
            meta={copy.meta}
            actionLabel={copy.actionLabel}
            aria-label={copy.ariaLabel}
            data-testid={activity.testId}
          />
        );
      })}
    </div>
  );
}

