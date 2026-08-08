import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import type { SetValidationErrors } from "../domain/setLogging";
import type { WorkoutSet } from "../domain/setLogging";

interface WorkoutSetRowProps {
  set: WorkoutSet;
  errors: SetValidationErrors;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
  onSave: () => void;
  onRegisterInput: (field: "weight" | "reps" | "rpe", element: HTMLInputElement | null) => void;
}

function SetInput({
  id,
  label,
  value,
  type,
  step,
  min,
  error,
  inputMode,
  onChange,
  onRegister,
}: {
  id: string;
  label: string;
  value: string;
  type: "number";
  step: string;
  min: string;
  error?: string;
  inputMode: "decimal" | "numeric";
  onChange: (value: string) => void;
  onRegister: (element: HTMLInputElement | null) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        ref={onRegister}
        id={id}
        type={type}
        inputMode={inputMode}
        step={step}
        min={min}
        value={value}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "min-h-12 w-full min-w-0 rounded-xs border border-line bg-surface px-2 text-center text-data tabular-nums text-ink outline-none focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-11",
          error && "border-error",
        )}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          const input = event.currentTarget;
          window.setTimeout(() => input.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
        }}
      />
    </div>
  );
}

export function WorkoutSetRow({ set, errors, onChange, onSave, onRegisterInput }: WorkoutSetRowProps) {
  const errorMessage = Object.values(errors).filter(Boolean).join(" · ");
  return (
    <div
      data-testid={`set-row-${set.id}`}
      className={cn(
        "grid min-w-0 grid-cols-[2.25rem_repeat(3,minmax(0,1fr))] gap-2 border-b border-line-subtle py-3",
        "tablet:grid-cols-[2.5rem_repeat(3,minmax(0,1fr))_8rem] tablet:items-center tablet:gap-3",
        set.status === "completed" && "bg-surface/50",
      )}
    >
      <div className="flex min-h-12 items-center justify-center text-sm font-semibold tabular-nums text-ink-muted tablet:min-h-11">
        {String(set.setNumber).padStart(2, "0")}
      </div>
      <SetInput
        id={`${set.id}-weight`}
        label={`น้ำหนัก เซ็ต ${set.setNumber}`}
        value={set.weight}
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        error={errors.weight}
        onChange={(value) => onChange("weight", value)}
        onRegister={(element) => onRegisterInput("weight", element)}
      />
      <SetInput
        id={`${set.id}-reps`}
        label={`Reps เซ็ต ${set.setNumber}`}
        value={set.reps}
        type="number"
        inputMode="numeric"
        step="1"
        min="1"
        error={errors.reps}
        onChange={(value) => onChange("reps", value)}
        onRegister={(element) => onRegisterInput("reps", element)}
      />
      <SetInput
        id={`${set.id}-rpe`}
        label={`RPE เซ็ต ${set.setNumber}`}
        value={set.rpe}
        type="number"
        inputMode="decimal"
        step="0.5"
        min="1"
        error={errors.rpe}
        onChange={(value) => onChange("rpe", value)}
        onRegister={(element) => onRegisterInput("rpe", element)}
      />

      <div className="col-span-4 flex min-h-11 items-center justify-between gap-2 border-t border-line-subtle pt-2 tablet:col-span-1 tablet:min-h-11 tablet:border-t-0 tablet:pt-0">
        <span className={cn("text-xs font-semibold", set.status === "completed" ? "text-success" : "text-ink-muted")}>
          {set.status === "completed" ? "เสร็จแล้ว" : "ยังไม่บันทึก"}
        </span>
        <Button
          variant={set.status === "completed" ? "secondary" : "quiet"}
          size="compact"
          className="min-h-11 px-3"
          onClick={onSave}
          aria-label={set.status === "completed" ? `บันทึกเซ็ต ${set.setNumber}` : `Complete Set ${set.setNumber}`}
        >
          {set.status === "completed" ? "บันทึกแก้ไข" : "Complete Set"}
        </Button>
      </div>

      {errorMessage ? (
        <p id={`${set.id}-error`} role="alert" className="col-span-4 border-l-2 border-error pl-2 text-xs leading-5 text-error tablet:col-span-5">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
