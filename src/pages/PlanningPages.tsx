import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type ReactNode,
    type RefObject,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/icons/Icon";
import { PageFrame } from "../components/layout/PageFrame";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { ModalDialog } from "../components/ui/ModalDialog";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { buttonStyles } from "../components/ui/buttonStyles";
import { useExerciseRepository } from "../features/exercises/ExerciseRepositoryContext";
import {
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
    eligibleTemplates,
    moveItem,
    plansPageActions,
    validateRoutineDraft,
    validateWorkoutTemplateDraft,
} from "../features/planning/domain/planningRules";
import { PlanningRepositoryError } from "../features/planning/data/PlanningRepository";
import { ExerciseFilterPopover } from "../features/exercises/components/ExerciseFilterPopover";
import { ExerciseSelectionItem } from "../features/exercises/components/ExerciseSelectionItem";
import { readNumberInput } from "../lib/numberInput";
import { useRoutineTrackingRepository } from "../features/routine-tracking/RoutineTrackingRepositoryContext";
import type { CurrentRoutineWeek } from "../features/routine-tracking/domain/routineTracking";

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
const createTemplateOption = "__create-template__";

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

function OverflowMenu({
    label,
    children,
}: {
    label: string;
    children: (close: () => void) => ReactNode;
}) {
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const triggerRef = useRef<HTMLElement>(null);
    const close = () => {
        detailsRef.current?.removeAttribute("open");
        triggerRef.current?.focus();
    };

    return (
        <details
            ref={detailsRef}
            className="relative"
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                }
            }}
        >
            <summary
                ref={triggerRef}
                className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xs border border-line text-ink-secondary hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                aria-label={label}
            >
                <Icon name="more" className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 border border-line bg-surface p-1 shadow-overlay">
                {children(close)}
            </div>
        </details>
    );
}

export function PlansPage() {
    const repository = usePlanningRepository();
    const routineTrackingRepository = useRoutineTrackingRepository();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<WorkoutTemplateSummary[]>([]);
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [routineDraft, setRoutineDraft] =
        useState<RoutineDraft>(blankRoutine);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [routineEditorOpen, setRoutineEditorOpen] = useState(false);
    const routineBaselineRef = useRef("");
    const frequencyManuallyEditedRef = useRef(false);
    const [routineError, setRoutineError] = useState("");
    const [savingRoutine, setSavingRoutine] = useState(false);
    const [currentWeek, setCurrentWeek] = useState<CurrentRoutineWeek | null>(null);
    const [activationRequest, setActivationRequest] = useState<{ routine: Routine | null; deactivate: boolean } | null>(null);
    const [activationTiming, setActivationTiming] = useState<"CURRENT" | "NEXT">("CURRENT");
    const [activating, setActivating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [nextTemplates, nextRoutines, nextCurrentWeek] = await Promise.all([
                repository.listTemplates(),
                repository.listRoutines(),
                routineTrackingRepository.getCurrentWeek(),
            ]);
            setTemplates(nextTemplates);
            setRoutines(nextRoutines);
            setCurrentWeek(nextCurrentWeek);
        } catch (loadError) {
            setError(errorMessage(loadError));
        } finally {
            setLoading(false);
        }
    }, [repository, routineTrackingRepository]);

    useEffect(() => {
        void load();
    }, [load]);

    function beginRoutine(routine?: Routine) {
        const nextDraft = routine ? routineToDraft(routine) : { ...blankRoutine, days: [] };
        frequencyManuallyEditedRef.current = Boolean(routine);
        setEditingRoutine(routine ?? null);
        setRoutineEditorOpen(true);
        setRoutineDraft(nextDraft);
        routineBaselineRef.current = JSON.stringify(nextDraft);
        setRoutineError("");
        setNotice("");
    }

    function addRoutineDay() {
        if (routineDraft.days.length >= 7) return;
        const available = eligibleTemplates(templates)[0];
        if (!available) return;
        const day: RoutineDayDraft = {
            clientId: crypto.randomUUID(),
            templateId: available.id,
            templateName: available.name,
            templateArchivedAt: available.archivedAt,
            label: `Day ${routineDraft.days.length + 1}`,
            notes: "",
        };
        setRoutineDraft((current) => {
            const days = [...current.days, day];
            return { ...current, days, weeklyFrequencyTarget: frequencyManuallyEditedRef.current ? current.weeklyFrequencyTarget : days.length };
        });
    }

    function removeRoutineDay(clientId: string) {
        setRoutineDraft((current) => {
            const days = current.days.filter((item) => item.clientId !== clientId);
            return { ...current, days, weeklyFrequencyTarget: frequencyManuallyEditedRef.current ? current.weeklyFrequencyTarget : Math.max(1, days.length) };
        });
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
            routineBaselineRef.current = "";
            setNotice("บันทึก Routine แล้ว");
            await load();
        } catch (saveError) {
            setRoutineError(errorMessage(saveError));
        } finally {
            setSavingRoutine(false);
        }
    }

    function activate(routine: Routine) {
        setActivationTiming(currentWeek?.currentPlan?.lockedAt ? "NEXT" : "CURRENT");
        setActivationRequest({ routine, deactivate: false });
    }

    function deactivate() {
        setActivationTiming(currentWeek?.currentPlan?.lockedAt ? "NEXT" : "CURRENT");
        setActivationRequest({ routine: null, deactivate: true });
    }

    async function confirmActivation() {
        if (!activationRequest) return;
        setActivating(true); setNotice(""); setError("");
        try {
            const effectiveWeek = activationRequest.deactivate
                ? await repository.deactivateRoutine(activationTiming)
                : await repository.activateRoutine(activationRequest.routine!.id, activationRequest.routine!.revision, activationTiming);
            setNotice(`${activationRequest.deactivate ? "ปิดใช้งาน" : "เปิดใช้งาน"} Routine ตั้งแต่สัปดาห์ ${effectiveWeek}`);
            setActivationRequest(null);
            await load();
        } catch (activationError) { setError(errorMessage(activationError)); }
        finally { setActivating(false); }
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

    const activeRoutine = routines.find((routine) => routine.id === currentWeek?.currentPlan?.routineId);
    const availableTemplates = eligibleTemplates(templates);
    const activeTemplates = templates.filter((template) => !template.archivedAt);
    const archivedTemplates = templates.filter((template) => Boolean(template.archivedAt));
    const otherSavedRoutines = routines.filter((routine) => !routine.archivedAt && routine.id !== activeRoutine?.id);
    const pageActions = plansPageActions(templates, routines, activeRoutine?.id);
    const routineDirty = routineEditorOpen && JSON.stringify(routineDraft) !== routineBaselineRef.current;

    useEffect(() => {
        if (!routineDirty) return;
        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [routineDirty]);

    function cancelRoutineEditor() {
        if (routineDirty && !window.confirm("มีข้อมูล Routine ที่ยังไม่ได้บันทึก ต้องการออกหรือไม่?")) return;
        setRoutineEditorOpen(false);
        setEditingRoutine(null);
        setRoutineDraft(blankRoutine);
        routineBaselineRef.current = "";
    }

    function runPageAction(key: string, target?: "templates" | "routines") {
        if (key === "create-template") {
            navigate("/plans/templates/new");
            return;
        }
        if (key === "create-routine") {
            beginRoutine();
            return;
        }
        if (target === "routines") {
            const section = document.getElementById("saved-routines");
            section?.scrollIntoView({ behavior: "smooth", block: "start" });
            section?.focus({ preventScroll: true });
        }
    }

    return (
        <PageFrame
            pageId="P-05"
            eyebrow={routineEditorOpen ? "P-05 · ROUTINE EDITOR" : "P-05 · PLANNING"}
            title={routineEditorOpen ? (editingRoutine ? "แก้ไข Routine" : "สร้าง Routine") : "แผนและ Routine"}
            description={routineEditorOpen ? "จัดลำดับวันและกำหนด Template ที่จะใช้ใน Routine" : "จัดลำดับ Template เป็น Routine และกำหนดเป้าหมายการฝึกต่อสัปดาห์"}
            action={
                routineEditorOpen ? (
                    <Button variant="quiet" onClick={cancelRoutineEditor}>
                        <Icon name="chevron-left" className="h-5 w-5" />
                        ยกเลิก
                    </Button>
                ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                        {pageActions.map((action) => (
                            <Button
                                key={action.key}
                                variant={action.variant === "primary" ? "primary" : "secondary"}
                                onClick={() => runPageAction(action.key, action.target)}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )
            }
        >
            <ModalDialog
                open={Boolean(activationRequest)}
                onClose={() => { if (!activating) setActivationRequest(null); }}
                title={activationRequest?.deactivate ? "ปิดใช้งาน Routine เมื่อไร?" : `เริ่ม ${activationRequest?.routine?.name ?? "Routine"} เมื่อไร?`}
                description="Routine Week นับวันจันทร์ถึงวันอาทิตย์ และเมื่อเริ่ม Session แรกแล้วจะล็อกสมาชิกของสัปดาห์นั้น"
            >
                <div className="mt-6 grid gap-3">
                    <label className={`border p-4 ${activationTiming === "CURRENT" ? "border-accent" : "border-line"}`}>
                        <input type="radio" name="activation-week" value="CURRENT" checked={activationTiming === "CURRENT"} disabled={Boolean(currentWeek?.currentPlan?.lockedAt)} onChange={() => setActivationTiming("CURRENT")} />
                        <span className="ml-3 font-semibold">สัปดาห์นี้</span>
                        <span className="mt-1 block pl-7 text-sm text-ink-muted">มีผล {currentWeek?.currentWeekStart}{currentWeek?.currentPlan?.lockedAt ? " · เลือกไม่ได้เพราะ Routine Week เริ่มแล้ว" : ""}</span>
                    </label>
                    <label className={`border p-4 ${activationTiming === "NEXT" ? "border-accent" : "border-line"}`}>
                        <input type="radio" name="activation-week" value="NEXT" checked={activationTiming === "NEXT"} onChange={() => setActivationTiming("NEXT")} />
                        <span className="ml-3 font-semibold">สัปดาห์หน้า</span>
                        <span className="mt-1 block pl-7 text-sm text-ink-muted">มีผล {currentWeek?.nextWeekStart}</span>
                    </label>
                </div>
                <div className="mt-6 flex justify-end gap-2"><Button variant="quiet" onClick={() => setActivationRequest(null)} disabled={activating}>ยกเลิก</Button><Button variant="primary" onClick={() => void confirmActivation()} disabled={activating}>{activating ? "กำลังบันทึก…" : "ยืนยัน"}</Button></div>
            </ModalDialog>
            {currentWeek?.scheduledActivation ? <p className="mb-6 border-l-2 border-accent bg-surface px-4 py-3 text-sm text-ink-secondary">Pending Routine Change: {currentWeek.scheduledActivation.isDeactivation ? "ปิดใช้งาน Routine" : currentWeek.scheduledActivation.routineName} มีผล {currentWeek.scheduledActivation.effectiveWeekStart}</p> : null}
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
                    <section className={routineEditorOpen ? "hidden" : ""}>
                        <SectionHeader
                            eyebrow="ACTIVE ROUTINE"
                            title={
                                activeRoutine?.name ?? (templates.length === 0 ? "เริ่มจาก Workout Template" : "ยังไม่มี Active Routine")
                            }
                            description={
                                activeRoutine
                                    ? `${activeRoutine.days.length} วัน · เป้าหมาย ${activeRoutine.weeklyFrequencyTarget} ครั้งต่อสัปดาห์`
                                    : templates.length === 0
                                        ? "วางแผนการฝึกด้วย 3 ขั้นตอนสั้น ๆ"
                                        : "สร้าง Routine จาก Template ที่บันทึกไว้ แล้วเปิดใช้งานเพื่อให้ Today แสดงลำดับถัดไป"
                            }
                            action={
                                activeRoutine ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Link to="/routine-history" className={buttonStyles({ variant: "quiet", size: "compact" })}>Weekly History</Link>
                                        <Button
                                            variant="secondary"
                                            size="compact"
                                            aria-label="แก้ไข Active Routine"
                                            onClick={() => beginRoutine(activeRoutine)}
                                        >
                                            <Icon name="edit" className="h-4 w-4" />
                                            แก้ไข Routine
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="compact"
                                            onClick={deactivate}
                                        >
                                            Inactive
                                        </Button>
                                    </div>
                                ) : undefined
                            }
                            showTopRule={false}
                        />
                        {activeRoutine && currentWeek?.currentPlan?.lockedAt ? <p className="mt-4 border-l-2 border-warning bg-surface px-4 py-3 text-sm text-ink-secondary">Routine Week นี้เริ่มแล้ว การแก้ไข Routine จะถูกตั้งเป็น Pending Routine Change และมีผลสัปดาห์หน้า</p> : null}
                        {activeRoutine ? (
                            <ol className="mt-5 border-t border-line">
                                {activeRoutine.days.map((day, index) => (
                                    <li
                                        key={day.id}
                                        className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3"
                                    >
                                        <span
                                            className={
                                                currentWeek?.currentPlan?.days.find((item) => item.routineDayId === day.id)?.completedCount === 0
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
                        ) : templates.length === 0 ? (
                            <ol className="mt-5 grid gap-3 border-t border-line pt-5 tablet:grid-cols-3">
                                {[
                                    ["01", "สร้าง Template", "กำหนดท่า Sets, Reps และเป้าหมาย"],
                                    ["02", "จัดเป็น Routine", "เรียงวัน A → B → C"],
                                    ["03", "เปิดใช้งาน", "ให้ Today แสดงวันถัดไป"],
                                ].map(([marker, title, description]) => (
                                    <li key={marker} className="border-b border-line-subtle pb-4">
                                        <p className="text-xs font-semibold tracking-[0.08em] text-accent">{marker}</p>
                                        <p className="mt-2 font-semibold">{title}</p>
                                        <p className="mt-1 text-sm text-ink-muted">{description}</p>
                                    </li>
                                ))}
                            </ol>
                        ) : null}
                    </section>

                    {otherSavedRoutines.length > 0 ? (
                        <section id="saved-routines" tabIndex={-1} className={routineEditorOpen ? "hidden" : "scroll-mt-8 border-t border-line pt-6"}>
                            <SectionHeader
                                eyebrow="SAVED ROUTINES"
                                title="Other Routines"
                                showTopRule={false}
                            />
                            <div className="mt-5 border-t border-line">
                                {otherSavedRoutines.map((routine) => (
                                    <article
                                        key={routine.id}
                                        className="grid gap-3 border-b border-line-subtle py-4 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center"
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
                                            {currentWeek?.scheduledActivation?.routineId === routine.id ? <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Next week</span> : null}
                                        </div>
                                        <div className="flex flex-wrap gap-2 tablet:justify-end">
                                            <Button
                                                variant="quiet"
                                                size="compact"
                                                onClick={() =>
                                                    beginRoutine(routine)
                                                }
                                            >
                                                แก้ไข
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="compact"
                                                onClick={() => activate(routine)}
                                            >
                                                Activate
                                            </Button>
                                            <OverflowMenu label={`เมนู Routine ${routine.name}`}>
                                                {(close) => (
                                                    <Button variant="quiet" fullWidth className="justify-start" onClick={() => { close(); void archiveRoutine(routine); }}>
                                                        <Icon name="archive" className="h-5 w-5" />
                                                        Archive
                                                    </Button>
                                                )}
                                            </OverflowMenu>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className={routineEditorOpen || templates.length === 0 ? "hidden" : "border-t border-line pt-6"}>
                        <SectionHeader
                            eyebrow="WORKOUT TEMPLATES"
                            title="Template ที่บันทึกไว้"
                            description={`${templates.length} Template${templates.length === 1 ? "" : "s"}`}
                            showTopRule={false}
                        />
                        {templates.length === 0 ? (
                            <EmptyState
                                marker="00"
                                title="ยังไม่มี Template"
                                description="เพิ่มท่าออกกำลังกายและกำหนดจำนวนเซ็ตกับช่วง reps เพื่อใช้ใน Routine"
                            />
                        ) : (
                            <div className="mt-5 border-t border-line">
                                {activeTemplates.map((template) => (
                                    <article
                                        key={template.id}
                                        className="grid gap-4 border-b border-line-subtle py-4 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate font-semibold">
                                                    {template.name}
                                                </h3>
                                            </div>
                                            <p className="mt-1 text-sm text-ink-muted">
                                                {template.exerciseCount}{" "}
                                                exercises · {template.setCount}{" "}
                                                sets · ใช้งานได้
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
                                            <OverflowMenu label={`เมนู Template ${template.name}`}>
                                                {(close) => (
                                                    <>
                                                        <Button variant="quiet" fullWidth className="justify-start" onClick={() => { close(); void duplicateTemplate(template); }}>
                                                            <Icon name="copy" className="h-5 w-5" />
                                                            คัดลอก
                                                        </Button>
                                                        <Button variant="destructive" fullWidth className="justify-start" onClick={() => { close(); void archiveTemplate(template); }}>
                                                            <Icon name="archive" className="h-5 w-5" />
                                                            Archive
                                                        </Button>
                                                    </>
                                                )}
                                            </OverflowMenu>
                                        </div>
                                    </article>
                                ))}
                                {archivedTemplates.length > 0 ? (
                                    <details className="border-t border-line-subtle py-4">
                                        <summary className="cursor-pointer text-sm font-semibold text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
                                            Archived Templates ({archivedTemplates.length})
                                        </summary>
                                        <div className="mt-3 border-t border-line-subtle">
                                            {archivedTemplates.map((template) => (
                                                <div key={template.id} className="flex items-center justify-between gap-3 border-b border-line-subtle py-3 text-sm">
                                                    <span className="truncate text-ink-muted">{template.name}</span>
                                                    <Link to={`/plans/templates/${template.id}`} className={buttonStyles({ variant: "quiet", size: "compact" })}>ดู</Link>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                ) : null}
                            </div>
                        )}
                    </section>

                    {routineEditorOpen ? (
                        <section className="pt-2">
                            <SectionHeader
                                eyebrow="ROUTINE EDITOR"
                                title={
                                    editingRoutine
                                        ? "แก้ไข Routine"
                                        : "สร้าง Routine"
                                }
                                description="ใช้ปุ่มเลื่อนเพื่อจัดลำดับวันโดยไม่ต้องใช้ drag-and-drop"
                                showTopRule={false}
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
                                        onChange={(event) => {
                                            frequencyManuallyEditedRef.current = true;
                                            setRoutineDraft({
                                                ...routineDraft,
                                                weeklyFrequencyTarget: Number(readNumberInput(event.currentTarget)),
                                            });
                                        }}
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
                                            disabled={availableTemplates.length === 0 || routineDraft.days.length >= 7}
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
                                                                if (event.target.value === createTemplateOption) {
                                                                    navigate("/plans/templates/new");
                                                                    return;
                                                                }
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
                                                            <option value={createTemplateOption}>
                                                                + เพิ่ม Template ใหม่
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
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="secondary"
                                                                size="compact"
                                                                className="h-11 w-11 p-0"
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
                                                                <Icon name="chevron-up" className="h-5 w-5" />
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                size="compact"
                                                                className="h-11 w-11 p-0"
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
                                                                <Icon name="chevron-down" className="h-5 w-5" />
                                                            </Button>
                                                            <OverflowMenu label={`เมนูวัน ${day.label || index + 1}`}>
                                                                {(close) => (
                                                                    <Button variant="destructive" fullWidth className="justify-start" type="button" onClick={() => { close(); removeRoutineDay(day.clientId); }}>
                                                                        <Icon name="trash" className="h-5 w-5" />
                                                                        ลบวัน
                                                                    </Button>
                                                                )}
                                                            </OverflowMenu>
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
                                <div className="safe-bottom sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap gap-3 border-t border-line bg-canvas px-4 py-4 tablet:-mx-6 tablet:px-6 desktop:-mx-8 desktop:px-8 large:-mx-12 large:px-12">
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
                                            cancelRoutineEditor();
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
    const value = Number(readNumberInput(event.currentTarget));
    return Number.isFinite(value) ? value : 0;
}

interface TemplateExercisePickerPanelProps {
    visibleExercises: Exercise[];
    selectedExerciseIds: Set<string>;
    search: string;
    muscleFilter: MuscleCode | "all";
    equipmentFilter: EquipmentCode | "all";
    onSearchChange: (value: string) => void;
    onMuscleChange: (value: MuscleCode | "all") => void;
    onEquipmentChange: (value: EquipmentCode | "all") => void;
    onAdd: (exercise: Exercise) => void;
    onClose?: () => void;
    closeButtonRef?: RefObject<HTMLButtonElement | null>;
}

function TemplateExercisePickerPanel({
    visibleExercises,
    selectedExerciseIds,
    search,
    muscleFilter,
    equipmentFilter,
    onSearchChange,
    onMuscleChange,
    onEquipmentChange,
    onAdd,
    onClose,
    closeButtonRef,
}: TemplateExercisePickerPanelProps) {
    const pickerContent = (
        <>
            <div className="flex min-w-0 items-end gap-2">
                <div className="min-w-0 flex-1">
                    <Input
                        label="ค้นหาท่า"
                        type="search"
                        placeholder="เช่น Bench Press"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                    />
                </div>
                <ExerciseFilterPopover
                    muscleFilter={muscleFilter}
                    equipmentFilter={equipmentFilter}
                    onMuscleChange={onMuscleChange}
                    onEquipmentChange={onEquipmentChange}
                />
            </div>
            <div className="mt-4 border-t border-line">
                {visibleExercises.length === 0 ? (
                    <p className="border-b border-line-subtle py-4 text-sm text-ink-muted">
                        ไม่พบท่าที่ตรงกับตัวกรอง
                    </p>
                ) : (
                    visibleExercises.map((exercise) => {
                        const alreadyAdded = selectedExerciseIds.has(exercise.id);
                        return (
                            <ExerciseSelectionItem
                                key={exercise.id}
                                exercise={exercise}
                                actionLabel={alreadyAdded ? "เพิ่มแล้ว" : "เพิ่ม"}
                                actionDisabled={Boolean(exercise.archivedAt) || alreadyAdded}
                                onAction={() => onAdd(exercise)}
                            />
                        );
                    })
                )}
            </div>
        </>
    );

    if (!onClose) {
        return (
            <>
                <SectionHeader
                    eyebrow="EXERCISE LIBRARY"
                    title="เลือกท่า"
                    showTopRule={false}
                />
                <div className="mt-5 max-h-[42rem] overflow-y-auto pr-1">
                    {pickerContent}
                </div>
            </>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-canvas px-4 py-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.08em] text-accent">
                        EXERCISE LIBRARY
                    </p>
                    <h2 className="mt-2 text-h3">เลือกท่า</h2>
                </div>
                <Button
                    ref={closeButtonRef}
                    variant="quiet"
                    type="button"
                    className="h-12 w-12 shrink-0 !p-0"
                    aria-label="ปิด Library"
                    onClick={onClose}
                >
                    <Icon name="close" className="h-6 w-6 shrink-0" />
                </Button>
            </header>
            <div data-exercise-picker-scroll className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {pickerContent}
            </div>
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
    const [exerciseErrors, setExerciseErrors] = useState<Record<string, string[]>>({});
    const [notice, setNotice] = useState("");
    const [revision, setRevision] = useState(1);
    const [dirty, setDirty] = useState(false);
    const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
    const [templateStep, setTemplateStep] = useState<"details" | "exercises" | "targets">("details");
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
    const exercisePickerTriggerRef = useRef<HTMLButtonElement>(null);
    const exercisePickerCloseRef = useRef<HTMLButtonElement>(null);

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
                setExpandedExerciseId(template.exercises[0]?.id ?? null);
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

    useEffect(() => {
        if (!expandedExerciseId) return;
        document.getElementById(`${expandedExerciseId}-summary`)?.focus();
    }, [expandedExerciseId]);

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
    const selectedExerciseIds = useMemo(
        () => new Set(draft.exercises.map((exercise) => exercise.exerciseId)),
        [draft.exercises],
    );

    function updateDraft(next: WorkoutTemplateDraft) {
        setDraft(next);
        setDirty(true);
        setNotice("");
        setExerciseErrors({});
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
        setExpandedExerciseId(target.clientId);
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
        setExerciseErrors(errors.exerciseErrors ?? {});
        if (Object.keys(errors).length > 0) {
            if (errors.exerciseErrors && Object.keys(errors.exerciseErrors).length > 0) {
                setTemplateStep("targets");
                setExpandedExerciseId(Object.keys(errors.exerciseErrors)[0]);
            } else {
                setTemplateStep("details");
            }
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

    function moveExercise(clientId: string, offset: -1 | 1) {
        const index = draft.exercises.findIndex((exercise) => exercise.clientId === clientId);
        const nextIndex = index + offset;
        if (index < 0 || nextIndex < 0 || nextIndex >= draft.exercises.length) return;
        updateDraft({ ...draft, exercises: moveItem(draft.exercises, index, nextIndex) });
    }

    function advanceTemplateStep() {
        setTemplateStep((current) => current === "details" ? "exercises" : "targets");
    }

    function retreatTemplateStep() {
        setTemplateStep((current) => current === "targets" ? "exercises" : "details");
    }

    return (
        <PageFrame
            pageId="P-06"
            eyebrow="P-06 · TEMPLATE EDITOR"
            title={isNew ? "สร้าง Workout Template" : "แก้ไข Workout Template"}
            description="กำหนดชื่อ ท่าที่ใช้ และเป้าหมายการฝึกของแต่ละท่า"
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
                    <nav className="mb-6 grid grid-cols-3 border-y border-line tablet:hidden" aria-label="ขั้นตอน Template">
                        {[
                            ["details", "01", "รายละเอียด"],
                            ["exercises", "02", "เลือกท่า"],
                            ["targets", "03", "กำหนดเป้าหมาย"],
                        ].map(([step, marker, label]) => (
                            <button
                                key={step}
                                type="button"
                                className={`min-h-16 border-r border-line-subtle px-2 py-3 text-left last:border-r-0 ${templateStep === step ? "text-accent" : "text-ink-muted"}`}
                                aria-current={templateStep === step ? "step" : undefined}
                                onClick={() => setTemplateStep(step as typeof templateStep)}
                            >
                                <span className="block text-[10px] font-semibold tracking-[0.08em]">{marker}</span>
                                <span className="mt-1 block text-xs font-semibold">{label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="relative grid gap-8 desktop:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <div className="hidden desktop:block">
                            <TemplateExercisePickerPanel
                                visibleExercises={visibleExercises}
                                selectedExerciseIds={selectedExerciseIds}
                                search={search}
                                muscleFilter={muscleFilter}
                                equipmentFilter={equipmentFilter}
                                onSearchChange={setSearch}
                                onMuscleChange={setMuscleFilter}
                                onEquipmentChange={setEquipmentFilter}
                                onAdd={addExercise}
                            />
                        </div>
                        {exercisePickerOpen ? (
                            <ModalDialog
                                open
                                onClose={() => setExercisePickerOpen(false)}
                                triggerRef={exercisePickerTriggerRef}
                                initialFocusRef={exercisePickerCloseRef}
                                title="Exercise Library"
                                variant="drawer"
                                className="overflow-hidden border-r border-line bg-canvas p-0 shadow-overlay desktop:hidden"
                                titleClassName="sr-only"
                            >
                                <TemplateExercisePickerPanel
                                    visibleExercises={visibleExercises}
                                    selectedExerciseIds={selectedExerciseIds}
                                    search={search}
                                    muscleFilter={muscleFilter}
                                    equipmentFilter={equipmentFilter}
                                    onSearchChange={setSearch}
                                    onMuscleChange={setMuscleFilter}
                                    onEquipmentChange={setEquipmentFilter}
                                    onAdd={addExercise}
                                    onClose={() => setExercisePickerOpen(false)}
                                    closeButtonRef={exercisePickerCloseRef}
                                />
                            </ModalDialog>
                        ) : null}
                        <section className="min-w-0">
                            <div className={`mb-5 desktop:hidden ${templateStep === "exercises" ? "" : "hidden"}`}>
                                <Button
                                    ref={exercisePickerTriggerRef}
                                    variant="secondary"
                                    type="button"
                                    onClick={() => setExercisePickerOpen(true)}
                                >
                                    เลือก Exercise จาก Library
                                </Button>
                            </div>
                            <SectionHeader
                                eyebrow="TEMPLATE DETAILS"
                                title={templateStep === "exercises" ? "เลือก Exercise" : templateStep === "targets" ? "กำหนดเป้าหมาย" : "รายละเอียด Template"}
                                showTopRule={false}
                            />
                            <div className="mt-5 space-y-5">
                                <div className={templateStep === "details" ? "space-y-5" : "hidden tablet:block tablet:space-y-5"}>
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
                                </div>
                                <div className={`border-t border-line pt-5 ${templateStep === "details" ? "hidden tablet:block" : ""}`}>
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
                                                        <div className="flex min-w-0 items-start justify-between gap-3">
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
                                                                <button id={`${exercise.clientId}-summary`} type="button" className="mt-1 block max-w-full truncate text-left font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink" aria-expanded={expandedExerciseId === exercise.clientId} aria-controls={`${exercise.clientId}-targets`} onClick={() => setExpandedExerciseId(expandedExerciseId === exercise.clientId ? null : exercise.clientId)}>
                                                                    {exercise.exerciseName}
                                                                </button>
                                                                <p className="mt-1 text-xs tabular-nums text-ink-muted">
                                                                    {exercise.setCount} sets · {exercise.repsMin}–{exercise.repsMax} reps · พัก {exercise.restSeconds}s
                                                                </p>
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
                                                            <div className="flex shrink-0 gap-2">
                                                                <Button variant="secondary" size="compact" className="h-11 w-11 p-0" type="button" aria-label={`เลื่อน ${exercise.exerciseName} ขึ้น`} disabled={index === 0} onClick={() => moveExercise(exercise.clientId, -1)}>
                                                                    <Icon name="chevron-up" className="h-5 w-5" />
                                                                </Button>
                                                                <Button variant="secondary" size="compact" className="h-11 w-11 p-0" type="button" aria-label={`เลื่อน ${exercise.exerciseName} ลง`} disabled={index === draft.exercises.length - 1} onClick={() => moveExercise(exercise.clientId, 1)}>
                                                                    <Icon name="chevron-down" className="h-5 w-5" />
                                                                </Button>
                                                                <Button variant="destructive" size="compact" className="h-11 w-11 p-0" type="button" aria-label={`ลบ ${exercise.exerciseName}`} onClick={() => updateDraft({ ...draft, exercises: draft.exercises.filter((item) => item.clientId !== exercise.clientId) })}>
                                                                    <Icon name="trash" className="h-5 w-5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        {exerciseErrors[exercise.clientId]?.length ? (
                                                            <p role="alert" className="mt-3 border-l-2 border-error pl-3 text-sm text-error">
                                                                {exerciseErrors[exercise.clientId].join(" · ")}
                                                            </p>
                                                        ) : null}
                                                        <div id={`${exercise.clientId}-targets`} className={`mt-4 grid gap-4 grid-cols-2 tablet:grid-cols-4 ${expandedExerciseId === exercise.clientId ? "" : "hidden tablet:grid"}`}>
                                                            <fieldset className="col-span-2 grid grid-cols-2 gap-4 tablet:col-span-4 tablet:grid-cols-4">
                                                                <legend className="col-span-2 mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted tablet:col-span-4">
                                                                    Volume
                                                                </legend>
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
                                                            </fieldset>
                                                            <fieldset className="col-span-2 grid grid-cols-2 gap-4 tablet:col-span-4 tablet:grid-cols-4">
                                                                <legend className="col-span-2 mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted tablet:col-span-4">
                                                                    Intensity
                                                                </legend>
                                                            <Input
                                                                label="น้ำหนักเป้าหมาย"
                                                                type="number"
                                                                min={0}
                                                                step="0.1"
                                                                value={
                                                                    exercise.targetWeightValue ??
                                                                    ""
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
                                                                label="หน่วยน้ำหนัก"
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
                                                            </fieldset>
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
                    <div className="mt-8 hidden flex-wrap gap-3 border-t border-line pt-5 tablet:flex">
                        <Button type="submit" disabled={saving}>
                            {saving ? "กำลังบันทึก…" : "บันทึก Template"}
                        </Button>
                        <Button variant="quiet" type="button" onClick={cancel}>
                            ยกเลิก
                        </Button>
                    </div>
                    <div className="safe-bottom sticky bottom-0 z-10 -mx-4 mt-6 flex gap-2 border-t border-line bg-canvas px-4 py-3 tablet:hidden">
                        {templateStep !== "details" ? (
                            <Button variant="quiet" type="button" className="flex-1" onClick={retreatTemplateStep}>
                                ย้อนกลับ
                            </Button>
                        ) : (
                            <Button variant="quiet" type="button" className="flex-1" onClick={cancel}>
                                ยกเลิก
                            </Button>
                        )}
                        {templateStep === "targets" ? (
                            <Button type="submit" className="flex-1" disabled={saving}>
                                {saving ? "กำลังบันทึก…" : "บันทึก Template"}
                            </Button>
                        ) : (
                            <Button type="button" className="flex-1" onClick={advanceTemplateStep}>
                                ถัดไป
                            </Button>
                        )}
                    </div>
                </form>
            )}
        </PageFrame>
    );
}
