import { Icon } from "../../../components/icons/Icon";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import { readNumberInput } from "../../../lib/numberInput";
import type { SetDraftErrors, SetDraftValue } from "../domain/workoutRules";
import type { SessionSet } from "../domain/workout";

interface WorkoutSetRowProps {
  set: SessionSet;
  draft: SetDraftValue;
  errors: SetDraftErrors;
  expanded: boolean;
  isBodyweight?: boolean;
  readOnly?: boolean;
  kindReadOnly?: boolean;
  busy?: boolean;
  pendingSync?: boolean;
  onToggle: () => void;
  onChange: (field: keyof SetDraftValue, value: string) => void;
  onSave: () => void;
  onSkip: () => void;
  onDelete: () => void;
  onKindChange: (kind: "WARM_UP" | "WORKING") => void;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="mt-1 text-[11px] leading-4 text-error">{message}</p> : null;
}

function compactSetSummary(set: SessionSet, draft: SetDraftValue) {
  const weight = set.actualWeight?.value ?? draft.weight;
  const unit = set.actualWeight?.unit ?? draft.weightUnit;
  const reps = set.actualReps ?? draft.reps;
  const effort = set.actualEffort ?? (draft.effortMetric && draft.effort
    ? { metric: draft.effortMetric, value: Number(draft.effort) }
    : null);
  const performance = weight !== "" && reps !== ""
    ? `${weight} ${unit} × ${reps}`
    : `เป้าหมาย ${set.targetRepsMin ?? "—"}–${set.targetRepsMax ?? "—"} reps`;
  return effort ? `${performance} · ${effort.metric} ${effort.value}` : performance;
}

export function WorkoutSetRow({ set, draft, errors, expanded, isBodyweight = false, readOnly = false, kindReadOnly = readOnly, busy = false, pendingSync = false, onToggle, onChange, onSave, onSkip, onDelete, onKindChange }: WorkoutSetRowProps) {
  const completed = set.status === "COMPLETED";
  const errorId = `${set.id}-error`;
  const hasErrors = Object.values(errors).some(Boolean);
  return (
    <article
      data-testid={`set-row-${set.id}`}
      className={cn(
        "min-w-0 border border-line bg-surface",
        completed && "border-line-strong",
      )}
    >
      <header className="border-b border-line-subtle">
        <button
          type="button"
          className="flex min-h-14 w-full min-w-0 items-center gap-3 px-3 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink tablet:px-4"
          aria-expanded={expanded}
          aria-controls={`${set.id}-editor`}
          onClick={onToggle}
        >
          <span className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">SET</span>
          <span className="text-base font-semibold tabular-nums text-ink">{String(set.sequence).padStart(2, "0")}</span>
          <span className={cn("shrink-0 text-xs font-semibold", completed ? "text-success" : set.status === "SKIPPED" ? "text-warning" : "text-ink-muted")}>
            {completed ? "เสร็จแล้ว" : set.status === "SKIPPED" ? "ข้ามแล้ว" : "รอบันทึก"}
          </span>
          {pendingSync ? <span className="shrink-0 text-[10px] font-semibold text-warning">Saved locally</span> : null}
          <span className="ml-auto min-w-0 truncate text-right text-xs tabular-nums text-ink-secondary">
            {compactSetSummary(set, draft)}
          </span>
          <Icon name={expanded ? "chevron-up" : "chevron-down"} className="h-5 w-5 shrink-0 text-ink-muted" />
        </button>
      </header>

      {expanded ? <div id={`${set.id}-editor`}>
      <div className="flex justify-end px-3 pt-3 tablet:px-4 tablet:pt-4">
        <label className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.04em] text-ink-muted">
          SET TYPE
          <span className="relative block">
            <select
              aria-label={`ประเภทเซ็ต ${set.sequence}`}
              value={set.kind === "WARM_UP" ? "WARM_UP" : "WORKING"}
              disabled={kindReadOnly || busy || completed}
              className="min-h-10 w-[7.25rem] appearance-none rounded-xs border border-line bg-surface py-2 pl-3 pr-9 text-xs text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
              onChange={(event) => onKindChange(event.target.value as "WARM_UP" | "WORKING")}
            >
              <option value="WORKING">Working</option>
              <option value="WARM_UP">Warm-up</option>
            </select>
            <Icon name="chevron-down" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          </span>
        </label>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-3 p-3 tablet:grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,0.65fr)_minmax(0,1fr)] tablet:p-4 tablet:pt-3">
        <div className="min-w-0">
          <label htmlFor={`${set.id}-weight`} className="mb-1 block text-[10px] font-semibold tracking-[0.04em] text-ink-muted">{isBodyweight ? "น้ำหนักเพิ่ม" : "WEIGHT"}</label>
          <div className="flex min-w-0 gap-1">
            <input
              id={`${set.id}-weight`}
              aria-label={`น้ำหนัก เซ็ต ${set.sequence}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={draft.weight}
              disabled={readOnly || busy}
              aria-invalid={errors.weight ? true : undefined}
              aria-describedby={errors.weight ? `${set.id}-weight-error` : undefined}
              className={cn("min-h-12 w-full min-w-0 rounded-xs border border-line bg-surface px-2 text-center text-2xl font-semibold leading-none tabular-nums text-ink outline-none focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-11", errors.weight && "border-error")}
              onChange={(event) => onChange("weight", readNumberInput(event.currentTarget))}
            />
            <select
              aria-label={`หน่วย เซ็ต ${set.sequence}`}
              value={draft.weightUnit}
              disabled={readOnly || busy}
              className="min-h-12 w-[4.1rem] shrink-0 rounded-xs border border-line bg-surface px-1 text-xs text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink tablet:min-h-11"
              onChange={(event) => onChange("weightUnit", event.target.value)}
            >
              <option value="KG">KG</option>
              <option value="LB">LB</option>
            </select>
          </div>
          <FieldError id={`${set.id}-weight-error`} message={errors.weight} />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${set.id}-reps`} className="mb-1 block text-[10px] font-semibold tracking-[0.04em] text-ink-muted">REPS</label>
          <input
            id={`${set.id}-reps`}
            aria-label={`Reps เซ็ต ${set.sequence}`}
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={draft.reps}
            disabled={readOnly || busy}
            aria-invalid={errors.reps ? true : undefined}
            aria-describedby={errors.reps ? `${set.id}-reps-error` : undefined}
            className={cn("min-h-12 w-full min-w-0 rounded-xs border border-line bg-surface px-2 text-center text-2xl font-semibold leading-none tabular-nums text-ink outline-none focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-11", errors.reps && "border-error")}
            onChange={(event) => onChange("reps", readNumberInput(event.currentTarget))}
          />
          <FieldError id={`${set.id}-reps-error`} message={errors.reps} />
        </div>
        <div className="col-span-2 min-w-0 tablet:col-span-1">
          <label htmlFor={`${set.id}-effort`} className="mb-1 block text-[10px] font-semibold tracking-[0.04em] text-ink-muted">EFFORT</label>
          <div className="flex min-w-0 gap-1">
            <select
              aria-label={`Effort metric เซ็ต ${set.sequence}`}
              value={draft.effortMetric}
              disabled={readOnly || busy}
              className="min-h-12 w-[4.4rem] shrink-0 rounded-xs border border-line bg-surface px-1 text-xs text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink tablet:min-h-11"
              onChange={(event) => onChange("effortMetric", event.target.value)}
            >
              <option value="">—</option>
              <option value="RPE">RPE</option>
              <option value="RIR">RIR</option>
            </select>
            <input
              id={`${set.id}-effort`}
              type="number"
              inputMode="decimal"
              step={draft.effortMetric === "RIR" ? "1" : "0.5"}
              min={draft.effortMetric === "RIR" ? "0" : "1"}
              max="10"
              value={draft.effort}
              disabled={readOnly || busy || !draft.effortMetric}
              aria-label={`Effort value เซ็ต ${set.sequence}`}
              aria-invalid={errors.effort ? true : undefined}
              aria-describedby={errors.effort ? `${set.id}-effort-error` : undefined}
              className={cn("min-h-12 w-full min-w-0 rounded-xs border border-line bg-surface px-2 text-center text-2xl font-semibold leading-none tabular-nums text-ink outline-none focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-11", errors.effort && "border-error")}
              onChange={(event) => onChange("effort", readNumberInput(event.currentTarget))}
            />
          </div>
          <FieldError id={`${set.id}-effort-error`} message={errors.effort} />
        </div>
      </div>

      {!readOnly ? (
        <footer className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-3 py-3 tablet:px-4">
          <div className="flex min-w-0 items-center gap-1">
            {!completed && set.status === "PENDING" ? (
              <Button
                data-testid={`skip-set-${set.id}`}
                variant="quiet"
                size="compact"
                className="min-h-11 px-3"
                disabled={busy}
                onClick={onSkip}
              >
                ข้ามเซ็ต
              </Button>
            ) : null}
            {completed ? (
              <Button
                data-testid={`delete-set-${set.id}`}
                variant="destructive"
                size="compact"
                className="h-11 w-11 p-0"
                disabled={busy}
                onClick={onDelete}
                aria-label={`ลบเซ็ต ${set.sequence}`}
              >
                <Icon name="trash" className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
          {set.status !== "SKIPPED" ? (
            <Button
              data-testid={`save-set-${set.id}`}
              variant={completed ? "secondary" : "accent"}
              size="default"
              className={cn("min-w-[9.5rem] flex-1 tablet:flex-none", !completed && "hidden tablet:inline-flex")}
              disabled={busy}
              onClick={onSave}
            >
              {busy
                ? "กำลังบันทึก…"
                : completed
                  ? "บันทึกการแก้ไข"
                  : "Complete Set"}
            </Button>
          ) : null}
        </footer>
      ) : null}
      {hasErrors ? (
        <p
          id={errorId}
          role="alert"
          className="border-t border-error px-3 py-2 text-xs leading-5 text-error tablet:px-4"
        >
          ตรวจสอบค่าของเซ็ตนี้ก่อนบันทึก
        </p>
      ) : null}
      </div> : null}
    </article>
  );
}
