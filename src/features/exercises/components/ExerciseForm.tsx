import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { buttonStyles } from "../../../components/ui/buttonStyles";
import { cn } from "../../../lib/cn";
import { isExerciseRepositoryError } from "../data/ExerciseRepository";
import {
  equipmentOptions,
  muscleOptions,
  type Exercise,
  type ExerciseDraft,
  type MuscleCode,
} from "../domain/exercise";
import {
  hasExerciseValidationErrors,
  validateExerciseDraft,
  type ExerciseValidationErrors,
} from "../domain/exerciseRules";

interface ExerciseFormProps {
  exercise?: Exercise;
  onSubmit: (draft: ExerciseDraft) => Promise<void>;
}

function toDraft(exercise?: Exercise): ExerciseDraft {
  return {
    name: exercise?.name ?? "",
    primaryMuscleCode: exercise?.primaryMuscleCode ?? "",
    secondaryMuscleCodes: exercise ? [...exercise.secondaryMuscleCodes] : [],
    equipmentCode: exercise?.equipmentCode ?? "",
    description: exercise?.description ?? "",
  };
}

export function ExerciseForm({ exercise, onSubmit }: ExerciseFormProps) {
  const initialDraft = useMemo(() => toDraft(exercise), [exercise]);
  const [draft, setDraft] = useState<ExerciseDraft>(initialDraft);
  const [fieldErrors, setFieldErrors] = useState<ExerciseValidationErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const hasErrors = hasExerciseValidationErrors(fieldErrors) || Boolean(formError);

  useEffect(() => {
    setDraft(initialDraft);
    setFieldErrors({});
    setFormError("");
  }, [initialDraft]);

  useEffect(() => {
    if (hasErrors) errorSummaryRef.current?.focus();
  }, [fieldErrors, formError, hasErrors]);

  function clearFieldError(field: keyof ExerciseValidationErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleSecondaryMuscle(code: MuscleCode) {
    clearFieldError("secondaryMuscleCodes");
    setDraft((current) => ({
      ...current,
      secondaryMuscleCodes: current.secondaryMuscleCodes.includes(code)
        ? current.secondaryMuscleCodes.filter((candidate) => candidate !== code)
        : [...current.secondaryMuscleCodes, code],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const clientErrors = validateExerciseDraft(draft, [], exercise?.id);
    if (hasExerciseValidationErrors(clientErrors)) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit(draft);
    } catch (error) {
      if (isExerciseRepositoryError(error)) {
        setFieldErrors(error.fieldErrors);
        if (!hasExerciseValidationErrors(error.fieldErrors)) setFormError(error.message);
      } else {
        setFormError("บันทึกท่าฝึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={submitting}>
      {hasErrors ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 border-l-2 border-error bg-surface px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <p className="font-semibold text-error">ยังบันทึกไม่ได้</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {formError || "ตรวจสอบช่องที่มีข้อความกำกับด้านล่าง"}
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        <Input
          label="ชื่อท่าฝึก *"
          value={draft.name}
          error={fieldErrors.name}
          autoComplete="off"
          placeholder="เช่น Incline Dumbbell Press"
          onChange={(event) => {
            clearFieldError("name");
            setDraft((current) => ({ ...current, name: event.target.value }));
          }}
        />

        <div className="grid gap-6 tablet:grid-cols-2">
          <Select
            label="กล้ามเนื้อหลัก *"
            value={draft.primaryMuscleCode}
            error={fieldErrors.primaryMuscleCode}
            onChange={(event) => {
              const primaryMuscleCode = event.target.value as ExerciseDraft["primaryMuscleCode"];
              clearFieldError("primaryMuscleCode");
              clearFieldError("secondaryMuscleCodes");
              setDraft((current) => ({
                ...current,
                primaryMuscleCode,
                secondaryMuscleCodes: current.secondaryMuscleCodes.filter(
                  (code) => code !== primaryMuscleCode,
                ),
              }));
            }}
          >
            <option value="">เลือกกล้ามเนื้อ</option>
            {muscleOptions.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </Select>

          <Select
            label="อุปกรณ์ *"
            value={draft.equipmentCode}
            error={fieldErrors.equipmentCode}
            onChange={(event) => {
              clearFieldError("equipmentCode");
              setDraft((current) => ({
                ...current,
                equipmentCode: event.target.value as ExerciseDraft["equipmentCode"],
              }));
            }}
          >
            <option value="">เลือกอุปกรณ์</option>
            {equipmentOptions.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </Select>
        </div>

        <fieldset aria-describedby={fieldErrors.secondaryMuscleCodes ? "secondary-muscles-error" : "secondary-muscles-help"}>
          <legend className="text-[13px] font-semibold tracking-[0.02em] text-ink-secondary">
            กล้ามเนื้อรอง
          </legend>
          <p id="secondary-muscles-help" className="mt-2 text-sm text-ink-muted">เลือกได้มากกว่าหนึ่งรายการ</p>
          <div className="mt-3 grid grid-cols-2 gap-2 tablet:grid-cols-3">
            {muscleOptions.map((option) => {
              const isPrimary = draft.primaryMuscleCode === option.code;
              return (
                <label
                  key={option.code}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 border border-line px-3 text-sm hover:bg-interactive",
                    isPrimary && "cursor-not-allowed border-line-subtle text-ink-disabled",
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-accent-action"
                    checked={draft.secondaryMuscleCodes.includes(option.code)}
                    disabled={isPrimary}
                    onChange={() => toggleSecondaryMuscle(option.code)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          {fieldErrors.secondaryMuscleCodes ? (
            <p id="secondary-muscles-error" className="mt-2 text-sm text-error">{fieldErrors.secondaryMuscleCodes}</p>
          ) : null}
        </fieldset>

        <Textarea
          label="คำอธิบาย"
          value={draft.description}
          helperText="Optional · ใช้บันทึกคำอธิบายสั้น ๆ ไม่ใช่ coaching content"
          maxLength={500}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
        />
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 tablet:flex-row tablet:justify-end">
        <Link to="/exercises" className={buttonStyles({ variant: "secondary", className: "w-full tablet:w-auto" })}>
          ยกเลิก
        </Link>
        <Button type="submit" fullWidth className="tablet:w-auto" disabled={submitting}>
          {submitting ? "กำลังบันทึก…" : exercise ? "บันทึกการแก้ไข" : "สร้างท่าฝึก"}
        </Button>
      </div>
    </form>
  );
}
