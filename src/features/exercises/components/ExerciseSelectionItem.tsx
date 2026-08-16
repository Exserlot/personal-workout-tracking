import { Icon } from "../../../components/icons/Icon";
import { Button } from "../../../components/ui/Button";
import { buttonStyles } from "../../../components/ui/buttonStyles";
import {
  getEquipmentLabel,
  getMuscleLabel,
  type Exercise,
} from "../domain/exercise";

function videoSearchUrl(exerciseName: string) {
  const query = encodeURIComponent(`${exerciseName} exercise proper form tutorial`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

interface ExerciseSelectionItemProps {
  exercise: Exercise;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
}

/** Lets users review form guidance before adding an Exercise. */
export function ExerciseSelectionItem({
  exercise,
  actionLabel,
  actionDisabled = false,
  onAction,
}: ExerciseSelectionItemProps) {
  const sourceLabel = exercise.source === "starter" ? "Starter" : "Custom";

  return (
    <article className="border-b border-line-subtle py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-ink">
            {exercise.name}
          </h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            {getMuscleLabel(exercise.primaryMuscleCode)} · {getEquipmentLabel(exercise.equipmentCode)} · {sourceLabel}
            {exercise.archivedAt ? " · Archived" : ""}
          </p>
        </div>
        <Button
          variant="quiet"
          size="compact"
          type="button"
          className="shrink-0"
          disabled={actionDisabled}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <Icon name="chevron-right" className="h-4 w-4 transition-transform group-open:rotate-90" />
          ดูวิธีเล่น
        </summary>
        <div className="mb-2 border-l-2 border-line pl-4">
          <p className="text-sm leading-6 text-ink-secondary">
            {exercise.description.trim() || "ยังไม่มีคำแนะนำสำหรับท่านี้"}
          </p>
          <a
            className={buttonStyles({
              variant: "secondary",
              size: "compact",
              className: "mt-3 w-full tablet:w-auto",
            })}
            href={videoSearchUrl(exercise.name)}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="start" className="h-4 w-4" />
            ค้นหาวิดีโอสาธิต
          </a>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            เปิดผลการค้นหาภายนอก ควรตรวจเทคนิคและความเหมาะสมก่อนฝึก
          </p>
        </div>
      </details>
    </article>
  );
}
