import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/icons/Icon";
import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { buttonStyles } from "../components/ui/buttonStyles";
import { useExerciseRepository } from "../features/exercises/ExerciseRepositoryContext";
import {
    equipmentOptions,
    muscleOptions,
    type EquipmentCode,
    type Exercise,
    type MuscleCode,
} from "../features/exercises/domain/exercise";
import { filterExercises } from "../features/exercises/domain/exerciseRules";
import { usePlanningRepository } from "../features/planning/PlanningRepositoryContext";
import type {
    GroupedExerciseTargetDraft,
    Routine,
    RoutineDayDraft,
    RoutineDraft,
    WorkoutTemplate,
    WorkoutTemplateDraft,
    WorkoutTemplateSummary,
} from "../features/planning/domain/planning";
import {
    moveItem,
    validateRoutineDraft,
    validateWorkoutTemplateDraft,
} from "../features/planning/domain/planningRules";
import { PlanningRepositoryError } from "../features/planning/data/PlanningRepository";

const blankTemplate: WorkoutTemplateDraft = {
    name: "",
    notes: "",
    exercises: [],
};
const blankRoutine: RoutineDraft = {
    name: "",
    weeklyFrequencyTarget: 3,
    days: [],
};

function errorMessage(error: unknown) {
    return error instanceof PlanningRepositoryError
        ? error.message
        : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function templateToDraft(template: WorkoutTemplate): WorkoutTemplateDraft {
    return {
        name: template.name,
        notes: template.notes,
        exercises: template.exercises.map((exercise) => {
            const first = exercise.prescriptions[0];
            return {
                clientId: exercise.id,
                exerciseId: exercise.exerciseId,
                exerciseName: exercise.exerciseName,
                exerciseArchivedAt: exercise.exerciseArchivedAt,
                notes: exercise.notes,
                setCount: exercise.prescriptions.length || 1,
                repsMin: first?.repsMin ?? 8,
                repsMax: first?.repsMax ?? 10,
                targetWeightValue: first?.targetWeightValue ?? null,
                targetWeightUnit: first?.targetWeightUnit ?? "KG",
                targetEffortMetric: first?.targetEffortMetric ?? "RPE",
                targetEffortValue: first?.targetEffortValue ?? 8,
                restSeconds: first?.restSeconds ?? 90,
            };
        }),
    };
}

function routineToDraft(routine: Routine): RoutineDraft {
    return {
        name: routine.name,
        weeklyFrequencyTarget: routine.weeklyFrequencyTarget,
        days: routine.days.map((day) => ({
            clientId: day.id,
            templateId: day.templateId,
            templateName: day.templateName,
            templateArchivedAt: day.templateArchivedAt,
            label: day.label,
            notes: day.notes,
        })),
    };
}

export function PlansPage() {
    const repository = usePlanningRepository();
    const [templates, setTemplates] = useState<WorkoutTemplateSummary[]>([]);
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [routineDraft, setRoutineDraft] =
        useState<RoutineDraft>(blankRoutine);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [routineEditorOpen, setRoutineEditorOpen] = useState(false);
    const [routineError, setRoutineError] = useState("");
    const [savingRoutine, setSavingRoutine] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [nextTemplates, nextRoutines] = await Promise.all([
                repository.listTemplates(),
                repository.listRoutines(),
            ]);
            setTemplates(nextTemplates);
            setRoutines(nextRoutines);
        } catch (loadError) {
            setError(errorMessage(loadError));
        } finally {
            setLoading(false);
        }
    }, [repository]);

    useEffect(() => {
        void load();
    }, [load]);

    function beginRoutine(routine?: Routine) {
        setEditingRoutine(routine ?? null);
        setRoutineEditorOpen(true);
        setRoutineDraft(
            routine ? routineToDraft(routine) : { ...blankRoutine, days: [] },
        );
        setRoutineError("");
        setNotice("");
    }

    function addRoutineDay() {
        const available = templates.find(
            (template) =>
                !template.archivedAt &&
                !routineDraft.days.some(
                    (day) => day.templateId === template.id,
                ),
        );
        if (!available) return;
        const day: RoutineDayDraft = {
            clientId: crypto.randomUUID(),
            templateId: available.id,
            templateName: available.name,
            templateArchivedAt: available.archivedAt,
            label: `Day ${routineDraft.days.length + 1}`,
            notes: "",
        };
        setRoutineDraft((current) => ({
            ...current,
            days: [...current.days, day],
        }));
    }

    async function saveRoutine(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const errors = validateRoutineDraft(routineDraft);
        if (Object.keys(errors).length > 0) {
            setRoutineError(
                errors.days ??
                    errors.name ??
                    errors.weeklyFrequencyTarget ??
                    "กรุณาตรวจสอบข้อมูล Routine",
            );
            return;
        }
        setSavingRoutine(true);
        setRoutineError("");
        try {
            if (editingRoutine)
                await repository.updateRoutine(
                    editingRoutine.id,
                    editingRoutine.revision,
                    routineDraft,
                );
            else await repository.createRoutine(routineDraft);
            setRoutineEditorOpen(false);
            setEditingRoutine(null);
            setRoutineDraft(blankRoutine);
            setNotice("บันทึก Routine แล้ว");
            await load();
        } catch (saveError) {
            setRoutineError(errorMessage(saveError));
        } finally {
            setSavingRoutine(false);
        }
    }

    async function activate(routine: Routine) {
        setNotice("");
        try {
            await repository.activateRoutine(routine.id, routine.revision);
            setNotice("เปิดใช้งาน Routine แล้ว");
            await load();
        } catch (activateError) {
            setError(errorMessage(activateError));
        }
    }

    async function archiveRoutine(routine: Routine) {
        if (!window.confirm(`Archive Routine “${routine.name}”?`)) return;
        try {
            await repository.archiveRoutine(routine.id, routine.revision);
            setNotice("Archive Routine แล้ว");
            await load();
        } catch (archiveError) {
            setError(errorMessage(archiveError));
        }
    }

    async function duplicateTemplate(template: WorkoutTemplateSummary) {
        try {
            await repository.duplicateTemplate(template.id);
            setNotice("คัดลอก Template แล้ว");
            await load();
        } catch (duplicateError) {
            setError(errorMessage(duplicateError));
        }
    }

    async function archiveTemplate(template: WorkoutTemplateSummary) {
        if (!window.confirm(`Archive Template “${template.name}”?`)) return;
        try {
            await repository.archiveTemplate(template.id, template.revision);
            setNotice("Archive Template แล้ว");
            await load();
        } catch (archiveError) {
            setError(errorMessage(archiveError));
        }
    }

    const activeRoutine = routines.find((routine) => routine.isActive);

    return (
        <PageFrame
            pageId="P-05"
            title="แผนและ Routine"
            description="จัดลำดับ Template เป็น Routine A → B → C และกำหนดเป้าหมายจำนวนครั้งต่อสัปดาห์"
            action={
                <Link to="/plans/templates/new" className={buttonStyles()}>
                    สร้าง Template
                </Link>
            }
        >
            {notice ? (
                <p
                    role="status"
                    className="mb-6 border border-success/40 bg-surface px-4 py-3 text-sm text-success"
                >
                    {notice}
                </p>
            ) : null}
            {error ? (
                <div
                    role="alert"
                    className="mb-6 border border-error/50 bg-surface px-4 py-3 text-sm text-error"
                >
                    <p>{error}</p>
                    <Button
                        className="mt-3"
                        variant="secondary"
                        onClick={() => void load()}
                    >
                        ลองใหม่
                    </Button>
                </div>
            ) : null}
            {loading ? (
                <p className="border-t border-line pt-6 text-ink-muted">
                    กำลังโหลด Plans…
                </p>
            ) : (
                <div className="space-y-12">
                    <section>
                        <SectionHeader
                            eyebrow="ACTIVE ROUTINE"
                            title={
                                activeRoutine?.name ?? "ยังไม่มี Active Routine"
                            }
                            description={
                                activeRoutine
                                    ? `${activeRoutine.days.length} วัน · เป้าหมาย ${activeRoutine.weeklyFrequencyTarget} ครั้งต่อสัปดาห์`
                                    : "สร้าง Routine จาก Template ที่บันทึกไว้ แล้วเปิดใช้งานเพื่อให้ Today แสดงลำดับถัดไป"
                            }
                            action={
                                <Button
                                    variant="secondary"
                                    onClick={() => beginRoutine(activeRoutine)}
                                >
                                    {" "}
                                    {activeRoutine
                                        ? "แก้ไข Routine"
                                        : "สร้าง Routine"}
                                </Button>
                            }
                        />
                        {activeRoutine ? (
                            <ol className="mt-5 border-t border-line">
                                {activeRoutine.days.map((day, index) => (
                                    <li
                                        key={day.id}
                                        className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3"
                                    >
                                        <span
                                            className={
                                                index ===
                                                activeRoutine.nextWorkoutIndex
                                                    ? "text-accent"
                                                    : "text-ink-muted"
                                            }
                                        >
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold">
                                                {day.label || day.templateName}
                                            </p>
                                            <p className="mt-1 truncate text-sm text-ink-muted">
                                                {day.templateName}
                                            </p>
                                        </div>
                                        <Link
                                            to={`/plans/templates/${day.templateId}`}
                                            className={buttonStyles({
                                                variant: "quiet",
                                                size: "compact",
                                            })}
                                        >
                                            เปิด
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <EmptyState
                                marker="00"
                                title="เริ่มจาก Workout Template"
                                description="Template เป็นหน่วยที่นำไปเรียงใน Routine ได้ และแก้ไขภายหลังโดยไม่กระทบประวัติการซ้อม"
                                action={
                                    <Link
                                        to="/plans/templates/new"
                                        className={buttonStyles()}
                                    >
                                        สร้าง Template แรก
                                    </Link>
                                }
                            />
                        )}
                    </section>

                    {routines.length > 0 ? (
                        <section>
                            <SectionHeader
                                eyebrow="SAVED ROUTINES"
                                title="Routine ทั้งหมด"
                            />
                            <div className="mt-5 grid gap-3 tablet:grid-cols-2">
                                {routines.map((routine) => (
                                    <article
                                        key={routine.id}
                                        className="border border-line bg-surface p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold">
                                                    {routine.name}
                                                </h3>
                                                <p className="mt-1 text-sm text-ink-muted">
                                                    {routine.days.length} วัน ·{" "}
                                                    {
                                                        routine.weeklyFrequencyTarget
                                                    }{" "}
                                                    ครั้ง/สัปดาห์
                                                </p>
                                            </div>
                                            {routine.isActive ? (
                                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                                                    Active
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Button
                                                variant="quiet"
                                                size="compact"
                                                onClick={() =>
                                                    beginRoutine(routine)
                                                }
                                            >
                                                แก้ไข
                                            </Button>
                                            {!routine.isActive ? (
                                                <Button
                                                    variant="secondary"
                                                    size="compact"
                                                    onClick={() =>
                                                        void activate(routine)
                                                    }
                                                >
                                                    Activate
                                                </Button>
                                            ) : null}
                                            {!routine.isActive ? (
                                                <Button
                                                    variant="destructive"
                                                    size="compact"
                                                    onClick={() =>
                                                        void archiveRoutine(
                                                            routine,
                                                        )
                                                    }
                                                >
                                                    Archive
                                                </Button>
                                            ) : null}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section>
                        <SectionHeader
                            eyebrow="WORKOUT TEMPLATES"
                            title="Template ที่บันทึกไว้"
                            action={
                                <Link
                                    to="/plans/templates/new"
                                    className={buttonStyles({
                                        variant: "secondary",
                                    })}
                                >
                                    เพิ่ม Template
                                </Link>
                            }
                        />
                        {templates.length === 0 ? (
                            <EmptyState
                                marker="00"
                                title="ยังไม่มี Template"
                                description="เพิ่มท่าออกกำลังกายและกำหนดจำนวนเซ็ตกับช่วง reps เพื่อใช้ใน Routine"
                            />
                        ) : (
                            <div className="mt-5 border-t border-line">
                                {templates.map((template) => (
                                    <article
                                        key={template.id}
                                        className="grid gap-4 border-b border-line-subtle py-4 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate font-semibold">
                                                    {template.name}
                                                </h3>
                                                {template.archivedAt ? (
                                                    <span className="text-xs text-ink-muted">
                                                        Archived
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 text-sm text-ink-muted">
                                                {template.exerciseCount}{" "}
                                                exercises · {template.setCount}{" "}
                                                sets · revision{" "}
                                                {template.revision}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Link
                                                to={`/plans/templates/${template.id}`}
                                                className={buttonStyles({
                                                    variant: "quiet",
                                                    size: "compact",
                                                })}
                                            >
                                                แก้ไข
                                            </Link>
                                            {!template.archivedAt ? (
                                                <>
                                                    <Button
                                                        variant="secondary"
                                                        size="compact"
                                                        onClick={() =>
                                                            void duplicateTemplate(
                                                                template,
                                                            )
                                                        }
                                                    >
                                                        คัดลอก
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="compact"
                                                        onClick={() =>
                                                            void archiveTemplate(
                                                                template,
                                                            )
                                                        }
                                                    >
                                                        Archive
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    {routineEditorOpen ? (
                        <section className="border-t border-line pt-6">
                            <SectionHeader
                                eyebrow="ROUTINE EDITOR"
                                title={
                                    editingRoutine
                                        ? "แก้ไข Routine"
                                        : "สร้าง Routine"
                                }
                                description="ใช้ปุ่มเลื่อนเพื่อจัดลำดับวันโดยไม่ต้องใช้ drag-and-drop"
                            />
                            <form
                                className="mt-5 space-y-5"
                                onSubmit={saveRoutine}
                            >
                                <div className="grid gap-5 tablet:grid-cols-2">
                                    <Input
                                        label="ชื่อ Routine"
                                        value={routineDraft.name}
                                        onChange={(event) =>
                                            setRoutineDraft({
                                                ...routineDraft,
                                                name: event.target.value,
                                            })
                                        }
                                        error={
                                            routineError && !routineDraft.name
                                                ? routineError
                                                : undefined
                                        }
                                        required
                                    />
                                    <Input
                                        label="เป้าหมายต่อสัปดาห์"
                                        type="number"
                                        min={1}
                                        max={7}
                                        value={
                                            routineDraft.weeklyFrequencyTarget
                                        }
                                        onChange={(event) =>
                                            setRoutineDraft({
                                                ...routineDraft,
                                                weeklyFrequencyTarget: Number(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                        unit="ครั้ง"
                                    />
                                </div>
                                <div className="border-t border-line-subtle pt-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="font-semibold">
                                            ลำดับวัน
                                        </h3>
                                        <Button
                                            variant="secondary"
                                            size="compact"
                                            type="button"
                                            onClick={addRoutineDay}
                                            disabled={
                                                routineDraft.days.length >=
                                                templates.length
                                            }
                                        >
                                            เพิ่มวัน
                                        </Button>
                                    </div>
                                    {routineDraft.days.length === 0 ? (
                                        <p className="mt-4 text-sm text-ink-muted">
                                            ยังไม่มีวัน — เพิ่ม Template
                                            ที่มีอยู่ด้านบน
                                        </p>
                                    ) : (
                                        <ol className="mt-4 space-y-3">
                                            {routineDraft.days.map(
                                                (day, index) => (
                                                    <li
                                                        key={day.clientId}
                                                        className="grid gap-3 border border-line bg-surface p-3 tablet:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] tablet:items-end"
                                                    >
                                                        <span className="text-ink-muted">
                                                            {String(
                                                                index + 1,
                                                            ).padStart(2, "0")}
                                                        </span>
                                                        <Input
                                                            label="ชื่อวัน"
                                                            value={day.label}
                                                            onChange={(event) =>
                                                                setRoutineDraft(
                                                                    {
                                                                        ...routineDraft,
                                                                        days: routineDraft.days.map(
                                                                            (
                                                                                item,
                                                                            ) =>
                                                                                item.clientId ===
                                                                                day.clientId
                                                                                    ? {
                                                                                          ...item,
                                                                                          label: event
                                                                                              .target
                                                                                              .value,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                    },
                                                                )
                                                            }
                                                        />
                                                        <Select
                                                            label="Template"
                                                            value={
                                                                day.templateId
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                const template =
                                                                    templates.find(
                                                                        (
                                                                            item,
                                                                        ) =>
                                                                            item.id ===
                                                                            event
                                                                                .target
                                                                                .value,
                                                                    );
                                                                if (!template)
                                                                    return;
                                                                setRoutineDraft(
                                                                    {
                                                                        ...routineDraft,
                                                                        days: routineDraft.days.map(
                                                                            (
                                                                                item,
                                                                            ) =>
                                                                                item.clientId ===
                                                                                day.clientId
                                                                                    ? {
                                                                                          ...item,
                                                                                          templateId:
                                                                                              template.id,
                                                                                          templateName:
                                                                                              template.name,
                                                                                          templateArchivedAt:
                                                                                              template.archivedAt,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            <option value="">
                                                                เลือก Template
                                                            </option>
                                                            {templates
                                                                .filter(
                                                                    (item) =>
                                                                        !item.archivedAt,
                                                                )
                                                                .map((item) => (
                                                                    <option
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        value={
                                                                            item.id
                                                                        }
                                                                    >
                                                                        {
                                                                            item.name
                                                                        }
                                                                    </option>
                                                                ))}
                                                        </Select>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="quiet"
                                                                size="compact"
                                                                type="button"
                                                                aria-label="เลื่อนวันขึ้น"
                                                                disabled={
                                                                    index === 0
                                                                }
                                                                onClick={() =>
                                                                    setRoutineDraft(
                                                                        {
                                                                            ...routineDraft,
                                                                            days: moveItem(
                                                                                routineDraft.days,
                                                                                index,
                                                                                index -
                                                                                    1,
                                                                            ),
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                ↑
                                                            </Button>
                                                            <Button
                                                                variant="quiet"
                                                                size="compact"
                                                                type="button"
                                                                aria-label="เลื่อนวันลง"
                                                                disabled={
                                                                    index ===
                                                                    routineDraft
                                                                        .days
                                                                        .length -
                                                                        1
                                                                }
                                                                onClick={() =>
                                                                    setRoutineDraft(
                                                                        {
                                                                            ...routineDraft,
                                                                            days: moveItem(
                                                                                routineDraft.days,
                                                                                index,
                                                                                index +
                                                                                    1,
                                                                            ),
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                ↓
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="compact"
                                                                type="button"
                                                                onClick={() =>
                                                                    setRoutineDraft(
                                                                        {
                                                                            ...routineDraft,
                                                                            days: routineDraft.days.filter(
                                                                                (
                                                                                    item,
                                                                                ) =>
                                                                                    item.clientId !==
                                                                                    day.clientId,
                                                                            ),
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                ลบ
                                                            </Button>
                                                        </div>
                                                    </li>
                                                ),
                                            )}
                                        </ol>
                                    )}
                                    {routineError ? (
                                        <p
                                            role="alert"
                                            className="mt-4 text-sm text-error"
                                        >
                                            {routineError}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        type="submit"
                                        disabled={savingRoutine}
                                    >
                                        {savingRoutine
                                            ? "กำลังบันทึก…"
                                            : "บันทึก Routine"}
                                    </Button>
                                    <Button
                                        variant="quiet"
                                        type="button"
                                        onClick={() => {
                                            setRoutineEditorOpen(false);
                                            setEditingRoutine(null);
                                            setRoutineDraft(blankRoutine);
                                        }}
                                    >
                                        ยกเลิก
                                    </Button>
                                </div>
                            </form>
                        </section>
                    ) : null}
                </div>
            )}
        </PageFrame>
    );
}

function numberValue(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    return Number.isFinite(value) ? value : 0;
}

interface FilterOption {
    code: string;
    label: string;
}

function FilterCombobox({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly FilterOption[];
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const selected =
        options.find((option) => option.code === value) ?? options[0];
    const visibleOptions = options.filter((option) =>
        option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    );

    useEffect(() => {
        if (!open) return;
        function handleDismiss(event: MouseEvent | KeyboardEvent) {
            if (event instanceof KeyboardEvent && event.key === "Escape") {
                setOpen(false);
                return;
            }
            if (
                event instanceof MouseEvent &&
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleDismiss);
        document.addEventListener("keydown", handleDismiss);
        return () => {
            document.removeEventListener("mousedown", handleDismiss);
            document.removeEventListener("keydown", handleDismiss);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative min-w-0">
            <span className="mb-2 block text-[13px] font-semibold tracking-[0.02em] text-ink-secondary">
                {label}
            </span>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xs border border-line bg-surface px-3 text-left text-sm text-ink hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${value !== "all" ? "pr-24" : "pr-12"}`}
                onClick={() => setOpen((current) => !current)}
              >
                <span className="truncate">
                    {selected?.label ?? "เลือกค่า"}
                </span>
              </button>
              <div className="absolute inset-y-0 right-0 flex items-center">
                {value !== "all" ? (
                  <button
                    type="button"
                    aria-label={`ล้างค่า${label}`}
                    title={`ล้างค่า${label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xs text-ink-muted hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    onClick={(event) => {
                        event.stopPropagation();
                        setSearch("");
                        onChange("all");
                        setOpen(false);
                    }}
                >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={open ? `ปิดตัวเลือก${label}` : `เปิดตัวเลือก${label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xs text-ink-muted hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  onClick={() => setOpen((current) => !current)}
                >
                  <Icon name="chevron-down" className="h-4 w-4" />
                </button>
              </div>
            </div>
            {open ? (
                <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-56 border border-line bg-canvas p-3">
                    <div className="min-w-0">
                        <Input
                            label={`ค้นหา${label}`}
                            type="search"
                            value={search}
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            autoFocus
                        />
                    </div>
                    <div
                        role="listbox"
                        aria-label={label}
                        className="mt-3 max-h-56 overflow-y-auto border-t border-line-subtle pt-1"
                    >
                        {visibleOptions.length === 0 ? (
                            <p className="py-3 text-sm text-ink-muted">
                                ไม่พบตัวเลือก
                            </p>
                        ) : (
                            visibleOptions.map((option) => (
                                <button
                                    key={option.code}
                                    type="button"
                                    role="option"
                                    aria-selected={option.code === value}
                                    className="flex min-h-11 w-full items-center border-b border-line-subtle px-2 text-left text-sm text-ink hover:bg-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                                    onClick={() => {
                                        onChange(option.code);
                                        setSearch("");
                                        setOpen(false);
                                    }}
                                >
                                    {option.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function ExercisePickerFilters({
    muscleFilter,
    equipmentFilter,
    onMuscleChange,
    onEquipmentChange,
}: {
    muscleFilter: MuscleCode | "all";
    equipmentFilter: EquipmentCode | "all";
    onMuscleChange: (value: MuscleCode | "all") => void;
    onEquipmentChange: (value: EquipmentCode | "all") => void;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeCount =
        Number(muscleFilter !== "all") + Number(equipmentFilter !== "all");

    useEffect(() => {
        if (!open) return;
        function handleDismiss(event: MouseEvent | KeyboardEvent) {
            if (event instanceof KeyboardEvent && event.key === "Escape") {
                setOpen(false);
                return;
            }
            if (
                event instanceof MouseEvent &&
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleDismiss);
        document.addEventListener("keydown", handleDismiss);
        return () => {
            document.removeEventListener("mousedown", handleDismiss);
            document.removeEventListener("keydown", handleDismiss);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <Button
                variant="secondary"
                size="default"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={
                    activeCount > 0
                        ? `ตัวกรอง Exercise มี ${activeCount} รายการที่ใช้`
                        : "เปิดตัวกรอง Exercise"
                }
                title="ตัวกรอง Exercise"
                className={
                    activeCount > 0
                        ? "relative h-12 w-12 shrink-0 border-accent-action px-0 text-accent tablet:h-11 tablet:w-11"
                        : "relative h-12 w-12 shrink-0 px-0 tablet:h-11 tablet:w-11"
                }
                onClick={() => setOpen((current) => !current)}
            >
                <Icon name="filter" className="h-5 w-5 shrink-0" />
                {activeCount > 0 ? <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-action px-1 text-[10px] font-bold text-white">{activeCount}</span> : null}
            </Button>
            {open ? (
                <div
                    role="dialog"
                    aria-label="ตัวกรอง Exercise"
                    className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-4 border border-line bg-canvas p-4"
                >
                    <FilterCombobox
                        label="หมวดหมู่กล้ามเนื้อ"
                        value={muscleFilter}
                        options={[
                            { code: "all", label: "ทุกกลุ่มกล้ามเนื้อ" },
                            ...muscleOptions,
                        ]}
                        onChange={(value) =>
                            onMuscleChange(value as MuscleCode | "all")
                        }
                    />
                    <FilterCombobox
                        label="อุปกรณ์"
                        value={equipmentFilter}
                        options={[
                            { code: "all", label: "ทุกอุปกรณ์" },
                            ...equipmentOptions,
                        ]}
                        onChange={(value) =>
                            onEquipmentChange(value as EquipmentCode | "all")
                        }
                    />
                    {activeCount > 0 ? (
                        <Button
                            variant="quiet"
                            size="compact"
                            type="button"
                            onClick={() => {
                                onMuscleChange("all");
                                onEquipmentChange("all");
                            }}
                        >
                            ล้างตัวกรอง
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function TemplateEditorPage() {
    const repository = usePlanningRepository();
    const exerciseRepository = useExerciseRepository();
    const navigate = useNavigate();
    const { templateId = "new" } = useParams();
    const isNew = templateId === "new";
    const [draft, setDraft] = useState<WorkoutTemplateDraft>(blankTemplate);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [search, setSearch] = useState("");
    const [muscleFilter, setMuscleFilter] = useState<MuscleCode | "all">("all");
    const [equipmentFilter, setEquipmentFilter] = useState<
        EquipmentCode | "all"
    >("all");
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [revision, setRevision] = useState(1);
    const [dirty, setDirty] = useState(false);
    const [exercisePickerOpen, setExercisePickerOpen] = useState(false);

    useEffect(() => {
        void exerciseRepository
            .list({
                search: "",
                muscleCode: "all",
                equipmentCode: "all",
                status: "all",
            })
            .then(setExercises)
            .catch((loadError) =>
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "โหลด Exercise ไม่สำเร็จ",
                ),
            );
    }, [exerciseRepository]);

    useEffect(() => {
        if (isNew) {
            setLoading(false);
            return;
        }
        setLoading(true);
        void repository
            .getTemplate(templateId)
            .then((template) => {
                if (!template) {
                    setError("ไม่พบ Template นี้");
                    return;
                }
                setDraft(templateToDraft(template));
                setRevision(template.revision);
            })
            .catch((loadError) => setError(errorMessage(loadError)))
            .finally(() => setLoading(false));
    }, [isNew, repository, templateId]);

    useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => {
            if (dirty) event.preventDefault();
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);

    const visibleExercises = useMemo(
        () =>
            filterExercises(exercises, {
                search,
                muscleCode: muscleFilter,
                equipmentCode: equipmentFilter,
                status: "all",
            }),
        [equipmentFilter, exercises, muscleFilter, search],
    );

    function updateDraft(next: WorkoutTemplateDraft) {
        setDraft(next);
        setDirty(true);
        setNotice("");
    }

    function addExercise(exercise: Exercise) {
        if (
            exercise.archivedAt ||
            draft.exercises.some((item) => item.exerciseId === exercise.id)
        )
            return;
        const target: GroupedExerciseTargetDraft = {
            clientId: crypto.randomUUID(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            exerciseArchivedAt: exercise.archivedAt,
            notes: "",
            setCount: 3,
            repsMin: 8,
            repsMax: 10,
            targetWeightValue: null,
            targetWeightUnit: "KG",
            targetEffortMetric: "RPE",
            targetEffortValue: 8,
            restSeconds: 90,
        };
        updateDraft({ ...draft, exercises: [...draft.exercises, target] });
    }

    function updateExercise(
        clientId: string,
        patch: Partial<GroupedExerciseTargetDraft>,
    ) {
        updateDraft({
            ...draft,
            exercises: draft.exercises.map((item) =>
                item.clientId === clientId ? { ...item, ...patch } : item,
            ),
        });
    }

    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const errors = validateWorkoutTemplateDraft(draft);
        if (Object.keys(errors).length > 0) {
            setError(
                errors.name ?? "กรุณาตรวจสอบจำนวนเซ็ตและเป้าหมายของแต่ละท่า",
            );
            return;
        }
        setSaving(true);
        setError("");
        try {
            const saved = isNew
                ? await repository.createTemplate(draft)
                : await repository.updateTemplate(templateId, revision, draft);
            setDirty(false);
            setNotice("บันทึก Template แล้ว");
            if (isNew)
                navigate(`/plans/templates/${saved.id}`, { replace: true });
            else {
                setRevision(saved.revision);
                setDraft(templateToDraft(saved));
            }
        } catch (saveError) {
            setError(errorMessage(saveError));
        } finally {
            setSaving(false);
        }
    }

    function cancel() {
        if (
            dirty &&
            !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกหรือไม่?")
        )
            return;
        navigate("/plans");
    }

    return (
        <PageFrame
            pageId="P-06"
            title={isNew ? "สร้าง Workout Template" : "แก้ไข Workout Template"}
            description="กำหนดเป้าหมายแบบ grouped target แล้วระบบจะขยายเป็นแถวเซ็ตจริงเมื่อบันทึก"
            action={
                <Button variant="secondary" onClick={cancel}>
                    กลับ Plans
                </Button>
            }
        >
            {notice ? (
                <p
                    role="status"
                    className="mb-6 border border-success/40 bg-surface px-4 py-3 text-sm text-success"
                >
                    {notice}
                </p>
            ) : null}
            {error ? (
                <p
                    role="alert"
                    className="mb-6 border border-error/50 bg-surface px-4 py-3 text-sm text-error"
                >
                    {error}
                </p>
            ) : null}
            {loading ? (
                <p className="border-t border-line pt-6 text-ink-muted">
                    กำลังโหลด Template…
                </p>
            ) : (
                <form onSubmit={save}>
                    <div className="grid gap-8 desktop:grid-cols-[18rem_minmax(0,1fr)]">
                        <div
                            className={
                                exercisePickerOpen
                                    ? "fixed inset-4 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border border-line bg-canvas p-4 tablet:inset-y-4 tablet:left-20 tablet:right-auto tablet:w-80 desktop:static desktop:block desktop:w-auto desktop:overflow-visible desktop:border-0 desktop:bg-transparent desktop:p-0"
                                    : "hidden desktop:block"
                            }
                        >
                            <div className="mb-3 desktop:hidden">
                                <Button
                                    variant="quiet"
                                    size="compact"
                                    type="button"
                                    onClick={() => setExercisePickerOpen(false)}
                                >
                                    ปิด Library
                                </Button>
                            </div>
                            <SectionHeader
                                eyebrow="EXERCISE LIBRARY"
                                title="เลือกท่า"
                            />
                            <div className="mt-5 space-y-4">
                                <div className="flex min-w-0 items-end gap-2">
                                    <div className="min-w-0 flex-1">
                                        <Input
                                            label="ค้นหาท่า"
                                            type="search"
                                            placeholder="เช่น Bench Press"
                                            value={search}
                                            onChange={(event) =>
                                                setSearch(event.target.value)
                                            }
                                        />
                                    </div>
                                    <ExercisePickerFilters
                                        muscleFilter={muscleFilter}
                                        equipmentFilter={equipmentFilter}
                                        onMuscleChange={setMuscleFilter}
                                        onEquipmentChange={setEquipmentFilter}
                                    />
                                </div>
                                <div className="max-h-[34rem] overflow-y-auto border-t border-line">
                                    {visibleExercises.length === 0 ? (
                                        <p className="border-b border-line-subtle py-4 text-sm text-ink-muted">
                                            ไม่พบท่าที่ตรงกับตัวกรอง
                                        </p>
                                    ) : (
                                        visibleExercises.map((exercise) => (
                                            <div
                                                key={exercise.id}
                                                className="flex min-w-0 items-center justify-between gap-3 border-b border-line-subtle py-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">
                                                        {exercise.name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-ink-muted">
                                                        {exercise.source ===
                                                        "starter"
                                                            ? "Starter"
                                                            : "Custom"}
                                                        {exercise.archivedAt
                                                            ? " · Archived"
                                                            : ""}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="quiet"
                                                    size="compact"
                                                    type="button"
                                                    disabled={
                                                        Boolean(
                                                            exercise.archivedAt,
                                                        ) ||
                                                        draft.exercises.some(
                                                            (item) =>
                                                                item.exerciseId ===
                                                                exercise.id,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        addExercise(exercise)
                                                    }
                                                >
                                                    {draft.exercises.some(
                                                        (item) =>
                                                            item.exerciseId ===
                                                            exercise.id,
                                                    )
                                                        ? "เพิ่มแล้ว"
                                                        : "เพิ่ม"}
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                        <section className="min-w-0">
                            <div className="mb-5 desktop:hidden">
                                <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() => setExercisePickerOpen(true)}
                                >
                                    เลือก Exercise จาก Library
                                </Button>
                            </div>
                            <SectionHeader
                                eyebrow="TEMPLATE DETAILS"
                                title="รายละเอียดและเป้าหมาย"
                            />
                            <div className="mt-5 space-y-5">
                                <Input
                                    label="ชื่อ Template"
                                    required
                                    value={draft.name}
                                    onChange={(event) =>
                                        updateDraft({
                                            ...draft,
                                            name: event.target.value,
                                        })
                                    }
                                />
                                <Textarea
                                    label="หมายเหตุ"
                                    value={draft.notes}
                                    onChange={(event) =>
                                        updateDraft({
                                            ...draft,
                                            notes: event.target.value,
                                        })
                                    }
                                />
                                <div className="border-t border-line pt-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="font-semibold">
                                            Exercises ({draft.exercises.length})
                                        </h3>
                                        <span className="text-sm text-ink-muted">
                                            หน่วยเริ่มต้น KG
                                        </span>
                                    </div>
                                    {draft.exercises.length === 0 ? (
                                        <p className="mt-4 border border-dashed border-line p-5 text-sm text-ink-muted">
                                            Template ว่างได้ แต่ต้องเพิ่ม
                                            Exercise ก่อนจึงจะนำไปใช้ใน Routine
                                            หรือ Activate ได้
                                        </p>
                                    ) : (
                                        <div className="mt-4 space-y-4">
                                            {draft.exercises.map(
                                                (exercise, index) => (
                                                    <article
                                                        key={exercise.clientId}
                                                        className="min-w-0 border border-line bg-surface p-4"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="text-xs text-ink-muted">
                                                                    {String(
                                                                        index +
                                                                            1,
                                                                    ).padStart(
                                                                        2,
                                                                        "0",
                                                                    )}
                                                                </p>
                                                                <h4 className="mt-1 truncate font-semibold">
                                                                    {
                                                                        exercise.exerciseName
                                                                    }
                                                                </h4>
                                                                {exercise.exerciseArchivedAt ? (
                                                                    <p className="mt-1 text-sm text-warning">
                                                                        Exercise
                                                                        นี้ถูก
                                                                        Archive
                                                                        แล้ว —
                                                                        ใช้ต่อได้ใน
                                                                        Template
                                                                        แต่
                                                                        Activate
                                                                        Routine
                                                                        ไม่ได้
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <Button
                                                                variant="destructive"
                                                                size="compact"
                                                                type="button"
                                                                onClick={() =>
                                                                    updateDraft(
                                                                        {
                                                                            ...draft,
                                                                            exercises:
                                                                                draft.exercises.filter(
                                                                                    (
                                                                                        item,
                                                                                    ) =>
                                                                                        item.clientId !==
                                                                                        exercise.clientId,
                                                                                ),
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                ลบ
                                                            </Button>
                                                        </div>
                                                        <div className="mt-4 grid gap-4 grid-cols-2 tablet:grid-cols-4">
                                                            <Input
                                                                label="Sets"
                                                                type="number"
                                                                min={1}
                                                                max={50}
                                                                value={
                                                                    exercise.setCount
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            setCount:
                                                                                numberValue(
                                                                                    event,
                                                                                ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <Input
                                                                label="Reps ต่ำสุด"
                                                                type="number"
                                                                min={1}
                                                                value={
                                                                    exercise.repsMin
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            repsMin:
                                                                                numberValue(
                                                                                    event,
                                                                                ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <Input
                                                                label="Reps สูงสุด"
                                                                type="number"
                                                                min={1}
                                                                value={
                                                                    exercise.repsMax
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            repsMax:
                                                                                numberValue(
                                                                                    event,
                                                                                ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <Input
                                                                label="พัก"
                                                                type="number"
                                                                min={0}
                                                                value={
                                                                    exercise.restSeconds
                                                                }
                                                                unit="วินาที"
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            restSeconds:
                                                                                numberValue(
                                                                                    event,
                                                                                ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <Input
                                                                label="น้ำหนักเป้าหมาย"
                                                                type="number"
                                                                min={0}
                                                                step="0.1"
                                                                value={
                                                                    exercise.targetWeightValue ??
                                                                    ""
                                                                }
                                                                unit={
                                                                    exercise.targetWeightUnit
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            targetWeightValue:
                                                                                event
                                                                                    .target
                                                                                    .value ===
                                                                                ""
                                                                                    ? null
                                                                                    : numberValue(
                                                                                          event,
                                                                                      ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <Select
                                                                label="Effort"
                                                                value={
                                                                    exercise.targetEffortMetric ??
                                                                    ""
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) => {
                                                                    const metric =
                                                                        event
                                                                            .target
                                                                            .value as
                                                                            | "RPE"
                                                                            | "RIR"
                                                                            | "";
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            targetEffortMetric:
                                                                                metric ||
                                                                                null,
                                                                            targetEffortValue:
                                                                                metric
                                                                                    ? metric ===
                                                                                      "RPE"
                                                                                        ? 8
                                                                                        : 2
                                                                                    : null,
                                                                        },
                                                                    );
                                                                }}
                                                            >
                                                                <option value="">
                                                                    ไม่กำหนด
                                                                </option>
                                                                <option value="RPE">
                                                                    RPE
                                                                </option>
                                                                <option value="RIR">
                                                                    RIR
                                                                </option>
                                                            </Select>
                                                            <Input
                                                                label="ค่า Effort"
                                                                type="number"
                                                                min={0}
                                                                max={10}
                                                                step={
                                                                    exercise.targetEffortMetric ===
                                                                    "RPE"
                                                                        ? 0.5
                                                                        : 1
                                                                }
                                                                value={
                                                                    exercise.targetEffortValue ??
                                                                    ""
                                                                }
                                                                disabled={
                                                                    !exercise.targetEffortMetric
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            targetEffortValue:
                                                                                event
                                                                                    .target
                                                                                    .value ===
                                                                                ""
                                                                                    ? null
                                                                                    : numberValue(
                                                                                          event,
                                                                                      ),
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <Select
                                                                label="หน่วย"
                                                                value={
                                                                    exercise.targetWeightUnit
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    updateExercise(
                                                                        exercise.clientId,
                                                                        {
                                                                            targetWeightUnit:
                                                                                event
                                                                                    .target
                                                                                    .value as
                                                                                    | "KG"
                                                                                    | "LB",
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                <option value="KG">
                                                                    KG
                                                                </option>
                                                                <option value="LB">
                                                                    LB
                                                                </option>
                                                            </Select>
                                                        </div>
                                                    </article>
                                                ),
                                            )}
                                        </div>
                                    )}{" "}
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
                        <Button type="submit" disabled={saving}>
                            {saving ? "กำลังบันทึก…" : "บันทึก Template"}
                        </Button>
                        <Button variant="quiet" type="button" onClick={cancel}>
                            ยกเลิก
                        </Button>
                    </div>
                </form>
            )}
        </PageFrame>
    );
}
