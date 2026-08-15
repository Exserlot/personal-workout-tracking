import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/icons/Icon";
import { Button } from "../components/ui/Button";
import { ModalDialog } from "../components/ui/ModalDialog";
import { Divider } from "../components/ui/Divider";
import { EmptyState } from "../components/ui/EmptyState";
import { PageFrame } from "../components/layout/PageFrame";
import { SectionHeader } from "../components/ui/SectionHeader";
import { StatBlock } from "../components/ui/StatBlock";
import { buttonStyles } from "../components/ui/buttonStyles";
import { useExerciseRepository } from "../features/exercises/ExerciseRepositoryContext";
import {
    type EquipmentCode,
    type Exercise,
    type MuscleCode,
} from "../features/exercises/domain/exercise";
import { filterExercises } from "../features/exercises/domain/exerciseRules";
import { useWorkoutRepository } from "../features/workout/WorkoutRepositoryContext";
import { useAuth } from "../features/auth/AuthContext";
import { getDeviceId } from "../features/workout/data/deviceIdentity";
import {
    loadLatestSessionCache,
    loadSessionCache,
    saveSessionCache,
    type ActiveSessionCache,
    type WorkoutDraftValue,
    type WorkoutTimerCache,
} from "../features/workout/data/activeSessionCache";
import { RestTimer } from "../features/workout/components/RestTimer";
import { WorkoutSetRow } from "../features/workout/components/WorkoutSetRow";
import { ExerciseFilterPopover } from "../features/exercises/components/ExerciseFilterPopover";
import {
    commandValues,
    defaultAddedSetDraft,
    draftFromSet,
    formatTimer,
    pauseTimer,
    remainingTimerSeconds,
    resetTimer,
    resumeTimer,
    skipTimer,
    timerAfterComplete,
    validateSetDraft,
    type SetDraftErrors,
    type SetDraftValue,
} from "../features/workout/domain/workoutRules";
import {
    WorkoutRepositoryError,
    completionSummaryFromSession,
    type PreviousExerciseValues,
    type SessionSet,
    type WorkoutRepository,
    type WorkoutSession,
} from "../features/workout/domain/workout";
import { useWorkoutSync } from "../features/workout/WorkoutSyncContext";
import type { WorkoutSyncSnapshot } from "../features/workout/data/WorkoutSyncCoordinator";
import { enqueueOfflineWorkoutCommand, listSyncOperations, WorkoutQueueError } from "../features/workout/data/workoutSyncStore";
import { useProgressRepository } from "../features/progress/ProgressRepositoryContext";
import { SessionRecordList } from "../features/progress/components/SessionRecordList";
import type { ProgressRecord } from "../features/progress/domain/progress";
import { useProgressDisplayUnit } from "../features/progress/useProgressDisplayUnit";

type LoadStatus = "loading" | "ready" | "error";
const DEFAULT_TIMER: WorkoutTimerCache = {
    status: "idle",
    durationSeconds: 90,
    endsAt: null,
    pausedRemainingSeconds: 0,
};

function formatSessionTime(value: string) {
    return new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function formatPreviousPerformance(previous?: PreviousExerciseValues) {
    if (!previous?.weight || previous.reps === null) return "ยังไม่มีข้อมูล";
    return `${previous.weight.value} ${previous.weight.unit} × ${previous.reps}`;
}

function ActiveWorkoutLoading() {
    return (
        <div
            className="mx-auto min-h-dvh w-full max-w-content px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-8 large:px-12"
            role="status"
        >
            <div className="h-6 w-36 bg-interactive motion-safe:animate-pulse" />
            <div className="mt-8 h-10 max-w-md bg-interactive motion-safe:animate-pulse" />
            <div className="mt-8 h-48 max-w-3xl bg-interactive motion-safe:animate-pulse" />
            <span className="sr-only">กำลังโหลด Active Workout</span>
        </div>
    );
}

function ExerciseIndex({
    session,
    currentId,
    onSelect,
}: {
    session: WorkoutSession;
    currentId: string | null;
    onSelect: (id: string) => void;
}) {
    return (
        <aside className="hidden desktop:col-span-2 desktop:block">
            <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted">
                SESSION INDEX
            </p>
            <ol className="mt-4 border-t border-line">
                {session.exercises.map((exercise) => (
                    <li
                        key={exercise.id}
                        className="border-b border-line-subtle"
                    >
                        <button
                            type="button"
                            className={`flex min-h-12 w-full items-center gap-3 text-left text-sm ${exercise.id === currentId ? "text-accent" : "text-ink-secondary"}`}
                            onClick={() => onSelect(exercise.id)}
                        >
                            <span className="text-xs tabular-nums text-ink-muted">
                                {String(exercise.sequence).padStart(2, "0")}
                            </span>
                            <span className="truncate">{exercise.name}</span>
                        </button>
                    </li>
                ))}
            </ol>
        </aside>
    );
}

function ExercisePicker({
    exercises,
    onSelect,
    onClose,
    readOnly,
}: {
    exercises: Exercise[];
    onSelect: (exercise: Exercise) => void;
    onClose: () => void;
    readOnly: boolean;
}) {
    const [search, setSearch] = useState("");
    const [muscleFilter, setMuscleFilter] = useState<MuscleCode | "all">("all");
    const [equipmentFilter, setEquipmentFilter] = useState<
        EquipmentCode | "all"
    >("all");
    const visible = filterExercises(exercises, {
        search,
        muscleCode: muscleFilter,
        equipmentCode: equipmentFilter,
        status: "active",
    });
    return (
        <ModalDialog open onClose={onClose} title="เพิ่มท่าออกกำลังกาย" description="เลือกท่าที่ active เพื่อเพิ่มลงใน Session" variant="sheet" className="flex h-[100dvh] max-h-[100dvh] max-w-2xl flex-col overflow-hidden p-0 tablet:h-[min(88dvh,760px)] tablet:max-h-[88dvh]" labelledBy="exercise-picker-title" titleClassName="sr-only">
            <div className="contents">
                <header className="sticky top-0 z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 border-b border-line bg-surface px-5 py-4 tablet:px-6 tablet:py-5 [&>div:first-child]:col-span-2 [&>label]:col-span-2 [&>input]:min-w-0 [&>div:last-child]:self-end [&_button_svg]:h-6 [&_button_svg]:w-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.08em] text-accent">
                                SESSION EXERCISE
                            </p>
                            <p className="mt-2 text-h3 text-balance">เพิ่มท่าออกกำลังกาย</p>
                            <p className="mt-2 text-sm text-ink-muted">เลือกท่าจาก Exercise Library</p>
                        </div>
                        <Button
                            variant="quiet"
                            className="h-12 w-12 shrink-0 px-0"
                            onClick={onClose}
                            aria-label="ปิดตัวเลือกท่า"
                        >
                            <Icon name="close" className="!h-6 !w-6 shrink-0" strokeWidth={2.2} />
                        </Button>
                    </div>
                    <label
                        htmlFor="session-exercise-search"
                        className="mt-6 block text-sm font-semibold text-ink-secondary"
                    >
                        ค้นหาท่า
                    </label>
                    <input
                        id="session-exercise-search"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xs border border-line bg-canvas px-3 text-base text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                        autoFocus
                    />
                    <div className="mt-2 flex justify-end self-end">
                        <ExerciseFilterPopover
                            muscleFilter={muscleFilter}
                            equipmentFilter={equipmentFilter}
                            onMuscleChange={setMuscleFilter}
                            onEquipmentChange={setEquipmentFilter}
                        />
                    </div>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 tablet:px-6">
                    <div className="border-t border-line">
                        {visible.length === 0 ? (
                            <p className="py-6 text-sm text-ink-muted">
                                ไม่พบท่าที่ตรงกับคำค้น
                            </p>
                        ) : (
                            visible.map((exercise) => (
                                <button
                                    key={exercise.id}
                                    type="button"
                                    disabled={readOnly}
                                    className="flex min-h-16 w-full items-center justify-between gap-3 border-b border-line-subtle py-3 text-left text-sm hover:bg-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                                    onClick={() => onSelect(exercise)}
                                >
                                    <span className="min-w-0 truncate font-semibold">
                                        {exercise.name}
                                    </span>
                                    <span className="shrink-0 text-xs text-ink-muted">
                                        {exercise.equipmentCode}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </ModalDialog>
    );
}

function sessionCache(
    session: WorkoutSession,
    drafts: Record<string, WorkoutDraftValue>,
    currentExerciseId: string | null,
    timer: WorkoutTimerCache,
    userId: string,
    acknowledgedSession: WorkoutSession = session,
): ActiveSessionCache {
    return {
        sessionId: session.id,
        userId,
        session,
        acknowledgedSession,
        draftValues: drafts,
        currentExerciseId,
        timer,
        cachedAt: Date.now(),
    };
}

function initialDrafts(
    session: WorkoutSession,
    previous: Record<string, PreviousExerciseValues>,
) {
    const drafts: Record<string, WorkoutDraftValue> = {};
    for (const exercise of session.exercises) {
        const fallback = exercise.sourceExerciseId
            ? previous[exercise.sourceExerciseId]
            : undefined;
        for (const set of exercise.sets) {
            const draft = draftFromSet(
                set,
                fallback,
                exercise.equipmentCode === "bodyweight"
                    ? { defaultWeight: { value: 0, unit: "KG", kg: 0 } }
                    : undefined,
            );
            drafts[set.id] = { ...draft, weightUnit: draft.weightUnit };
        }
    }
    return drafts;
}

export function ActiveWorkoutPage() {
    const auth = useAuth();
    const repository = useWorkoutRepository();
    const exerciseRepository = useExerciseRepository();
    const navigate = useNavigate();
    const deviceId = useMemo(() => getDeviceId(), []);
    const userId = auth.session?.user.id ?? "";
    const syncCoordinator = useWorkoutSync();
    const [session, setSession] = useState<WorkoutSession | null>(null);
    const sessionRef = useRef<WorkoutSession | null>(null);
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [error, setError] = useState("");
    const [offlineReadOnly, setOfflineReadOnly] = useState(false);
    const [isOnline, setIsOnline] = useState(
        typeof navigator === "undefined" ? true : navigator.onLine,
    );
    const [syncSnapshot, setSyncSnapshot] = useState<WorkoutSyncSnapshot>(
        syncCoordinator.getSnapshot(),
    );
    const [pendingSetIds, setPendingSetIds] = useState<Set<string>>(new Set());
    const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(
        null,
    );
    const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
    const [previousValues, setPreviousValues] = useState<
        Record<string, PreviousExerciseValues>
    >({});
    const [drafts, setDrafts] = useState<Record<string, WorkoutDraftValue>>({});
    const draftsRef = useRef(drafts);
    const [errors, setErrors] = useState<Record<string, SetDraftErrors>>({});
    const [busySetId, setBusySetId] = useState<string | null>(null);
    const [busyAction, setBusyAction] = useState(false);
    const [timer, setTimer] = useState<WorkoutTimerCache>(DEFAULT_TIMER);
    const [clock, setClock] = useState(Date.now());
    const [pickerOpen, setPickerOpen] = useState(false);
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>(
        [],
    );

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        const unsubscribe = syncCoordinator.subscribe(() => {
            setSyncSnapshot({ ...syncCoordinator.getSnapshot() });
            void Promise.all([
                listSyncOperations(userId),
                sessionRef.current
                    ? loadSessionCache(sessionRef.current.id, userId)
                    : Promise.resolve(null),
            ]).then(([operations, cached]) => {
                setPendingSetIds(new Set(operations.flatMap((operation) => "setId" in operation.command ? [operation.command.setId] : [])));
                if (cached && sessionRef.current?.id === cached.session.id) {
                    sessionRef.current = cached.session;
                    setSession(cached.session);
                }
            }).catch(() => undefined);
        });
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            unsubscribe();
        };
    }, [syncCoordinator, userId]);

    const acceptSession = useCallback(
        async (next: WorkoutSession, cached?: ActiveSessionCache | null) => {
            const previous = next.exercises
                .map((exercise) => exercise.sourceExerciseId)
                .filter((id): id is string => Boolean(id));
            let loadedPreviousValues: Record<string, PreviousExerciseValues> = {};
            try {
                loadedPreviousValues = await repository.getPreviousValues(previous);
            } catch {
                // Previous values are helpful but never block the active workout.
            }
            const nextDrafts =
                cached?.sessionId === next.id &&
                cached.session.version <= next.version
                    ? {
                          ...initialDrafts(next, loadedPreviousValues),
                          ...cached.draftValues,
                      }
                    : initialDrafts(next, loadedPreviousValues);
            const nextCurrent =
                cached?.sessionId === next.id &&
                next.exercises.some(
                    (exercise) => exercise.id === cached.currentExerciseId,
                )
                    ? cached.currentExerciseId
                    : (next.exercises[0]?.id ?? null);
            const nextTimer =
                cached?.sessionId === next.id ? cached.timer : DEFAULT_TIMER;
            sessionRef.current = next;
            draftsRef.current = nextDrafts;
            setSession(next);
            setDrafts(nextDrafts);
            setPreviousValues(loadedPreviousValues);
            setCurrentExerciseId(nextCurrent);
            const nextExercise = next.exercises.find(
                (exercise) => exercise.id === nextCurrent,
            );
            setExpandedSetId(
                nextExercise?.sets.find((set) => set.status === "PENDING")?.id ??
                    nextExercise?.sets[0]?.id ??
                    null,
            );
            setTimer(nextTimer);
            setStatus("ready");
            await saveSessionCache(
                sessionCache(
                    next,
                    nextDrafts,
                    nextCurrent,
                    nextTimer,
                    userId,
                    cached?.acknowledgedSession ?? next,
                ),
            ).catch(() => undefined);
        },
        [repository, userId],
    );

    const load = useCallback(async () => {
        setStatus("loading");
        setError("");
        setOfflineReadOnly(false);
        try {
            await repository.registerDevice(deviceId);
            const active = await repository.getActiveSession(deviceId);
            if (!active) {
                setSession(null);
                setStatus("ready");
                return;
            }
            const cached = await loadSessionCache(active.id, userId).catch(() => null);
            const queued = await listSyncOperations(userId, active.id).catch(() => []);
            await acceptSession(
                queued.length > 0 && cached ? cached.session : active,
                cached,
            );
            syncCoordinator.start(active.id);
        } catch (loadError) {
            const cached = await loadLatestSessionCache(userId).catch(() => null);
            if (cached) {
                sessionRef.current = cached.session;
                setSession(cached.session);
                draftsRef.current = cached.draftValues;
                setDrafts(cached.draftValues);
                setCurrentExerciseId(cached.currentExerciseId);
                const cachedExercise = cached.session.exercises.find(
                    (exercise) => exercise.id === cached.currentExerciseId,
                );
                setExpandedSetId(
                    cachedExercise?.sets.find((set) => set.status === "PENDING")
                        ?.id ?? cachedExercise?.sets[0]?.id ?? null,
                );
                setPreviousValues({});
                setTimer(cached.timer);
                setOfflineReadOnly(!cached.userId || cached.userId !== userId);
                setStatus("ready");
                setError(
                    "กำลังแสดงข้อมูลล่าสุดแบบอ่านอย่างเดียว เนื่องจากยังเชื่อมต่อ Supabase ไม่ได้",
                );
            } else {
                setError(
                    loadError instanceof WorkoutRepositoryError
                        ? loadError.message
                        : "โหลด Active Workout ไม่สำเร็จ",
                );
                setStatus("error");
            }
        }
    }, [acceptSession, deviceId, repository, syncCoordinator, userId]);

    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        draftsRef.current = drafts;
    }, [drafts]);
    useEffect(() => {
        if (timer.status !== "running") return undefined;
        const interval = window.setInterval(() => setClock(Date.now()), 1_000);
        return () => window.clearInterval(interval);
    }, [timer.status, timer.endsAt]);

    const ownerActive = Boolean(
        session &&
        !offlineReadOnly &&
        session.ownerDeviceId === deviceId &&
        session.status === "ACTIVE",
    );
    const syncBlocked = syncSnapshot.status === "conflict" || syncSnapshot.status === "authorization";
    const canQueueSetMutation = ownerActive && !syncBlocked;
    const canUseOnlineMutation = canQueueSetMutation
        && isOnline
        && syncSnapshot.pendingCount === 0
        && pendingSetIds.size === 0;
    const readOnly = !canUseOnlineMutation;

    const persistCache = useCallback(
        (
            nextSession: WorkoutSession,
            nextDrafts = draftsRef.current,
            nextCurrent = currentExerciseId,
            nextTimer = timer,
        ) => {
            void loadSessionCache(nextSession.id, userId).then((cached) => {
                const acknowledged = cached?.acknowledgedSession ?? nextSession;
                const serverAdvanced = nextSession.version > acknowledged.version;
                return saveSessionCache(
                    sessionCache(
                        serverAdvanced ? nextSession : cached?.session ?? nextSession,
                        nextDrafts,
                        nextCurrent,
                        nextTimer,
                        userId,
                        serverAdvanced ? nextSession : acknowledged,
                    ),
                );
            }).catch(() => undefined);
        },
        [currentExerciseId, timer, userId],
    );

    const applyCommand = useCallback(
        async (
            command: Parameters<WorkoutRepository["applyCommand"]>[3],
            setId?: string,
        ) => {
            const current = sessionRef.current;
            if (!current || readOnly) return null;
            setBusyAction(true);
            if (setId) setBusySetId(setId);
            try {
                const next = await repository.applyCommand(
                    current.id,
                    deviceId,
                    current.version,
                    command,
                );
                sessionRef.current = next;
                setSession(next);
                persistCache(next);
                return next;
            } catch (commandError) {
                setError(
                    commandError instanceof WorkoutRepositoryError
                        ? commandError.message
                        : "บันทึก Workout ไม่สำเร็จ",
                );
                return null;
            } finally {
                setBusyAction(false);
                setBusySetId(null);
            }
        },
        [deviceId, persistCache, readOnly, repository],
    );

    const currentExercise =
        session?.exercises.find(
            (exercise) => exercise.id === currentExerciseId,
        ) ??
        session?.exercises[0] ??
        null;
    const currentIndex = currentExercise
        ? (session?.exercises.findIndex(
              (exercise) => exercise.id === currentExercise.id,
          ) ?? 0)
        : 0;
    const currentPrevious = currentExercise?.sourceExerciseId
        ? previousValues[currentExercise.sourceExerciseId]
        : undefined;
    const pendingSet =
        currentExercise?.sets.find(
            (set) => set.id === expandedSetId && set.status === "PENDING",
        ) ?? currentExercise?.sets.find((set) => set.status === "PENDING");
    const remainingSeconds = remainingTimerSeconds(timer, clock);
    function updateDraft(
        setId: string,
        field: keyof SetDraftValue,
        value: string,
    ) {
        const next = {
            ...draftsRef.current,
            [setId]: {
                ...(draftsRef.current[setId] ?? {
                    weight: "",
                    weightUnit: "KG",
                    reps: "",
                    effortMetric: "",
                    effort: "",
                }),
                [field]: value,
            },
        };
        draftsRef.current = next;
        setDrafts(next);
        setErrors((current) => {
            const fieldErrors = { ...current[setId] };
            const errorField = field === "effortMetric"
                ? "effort"
                : field === "weightUnit"
                    ? "weight"
                    : field;
            delete fieldErrors[errorField];
            return { ...current, [setId]: fieldErrors };
        });
        if (sessionRef.current) persistCache(sessionRef.current, next);
    }

    async function enqueueWorkoutCommand(command: Parameters<WorkoutRepository["applyIdempotentCommand"]>[0]["command"]) {
        const current = sessionRef.current;
        if (!current || !canQueueSetMutation) return null;
        const cached = await loadSessionCache(current.id, userId);
        const fallbackCache = cached ?? sessionCache(current, draftsRef.current, currentExerciseId, timer, userId);
        const result = await enqueueOfflineWorkoutCommand({
            cache: fallbackCache,
            userId,
            deviceId,
            command,
        });
        sessionRef.current = result.cache.session;
        setSession(result.cache.session);
        syncCoordinator.start(result.cache.session.id);
        return result.cache.session;
    }

    async function saveSet(set: SessionSet) {
        if (!sessionRef.current || !canQueueSetMutation) return;
        const draft = draftsRef.current[set.id] ?? draftFromSet(set);
        const validation = validateSetDraft(draft);
        setErrors((current) => ({ ...current, [set.id]: validation }));
        if (Object.keys(validation).length > 0) return;
        const values = commandValues(draft);
        let next: WorkoutSession | null = null;
        setBusyAction(true);
        setBusySetId(set.id);
        try {
            next = await enqueueWorkoutCommand({
                action: set.status === "COMPLETED" ? "edit_set" : "complete_set",
                setId: set.id,
                ...values,
            });
        } catch (saveError) {
            setError(saveError instanceof WorkoutRepositoryError ? saveError.message : saveError instanceof WorkoutQueueError ? "บันทึกในเครื่องไม่สำเร็จ กรุณาลองใหม่" : "บันทึก Set ไม่สำเร็จ");
        } finally {
            setBusyAction(false);
            setBusySetId(null);
        }
        if (next && set.status !== "COMPLETED") {
            const nextTimer = timerAfterComplete(set.targetRestSeconds || 90);
            setTimer(nextTimer);
            persistCache(next, draftsRef.current, currentExerciseId, nextTimer);
            const nextExercise = next.exercises.find(
                (exercise) => exercise.id === currentExerciseId,
            );
            setExpandedSetId(
                nextExercise?.sets.find((candidate) => candidate.status === "PENDING")
                    ?.id ?? null,
            );
        }
        if (next) setErrors((current) => ({ ...current, [set.id]: {} }));
    }

    async function skipSet(set: SessionSet) {
        if (!canQueueSetMutation) return;
        setBusyAction(true);
        setBusySetId(set.id);
        let next: WorkoutSession | null = null;
        try {
            next = await enqueueWorkoutCommand({ action: "skip_set", setId: set.id });
        } catch (skipError) {
            setError(skipError instanceof WorkoutQueueError ? "บันทึกการข้ามเซ็ตในเครื่องไม่สำเร็จ" : "ข้ามเซ็ตไม่สำเร็จ");
        } finally {
            setBusyAction(false);
            setBusySetId(null);
        }
        if (!next) return;
        const nextExercise = next.exercises.find(
            (exercise) => exercise.id === currentExerciseId,
        );
        setExpandedSetId(
            nextExercise?.sets.find((candidate) => candidate.status === "PENDING")
                ?.id ?? null,
        );
    }

    async function addSet() {
        if (!currentExercise || !canQueueSetMutation) return;
        const last = [...currentExercise.sets]
            .reverse()
            .find((set) => set.status === "COMPLETED");
        const template = currentExercise.sets.at(-1);
        if (!template) return;
        setBusyAction(true);
        let next: WorkoutSession | null = null;
        try {
            next = await enqueueWorkoutCommand({
                action: "add_set",
                sessionExerciseId: currentExercise.id,
                setId: crypto.randomUUID(),
                sequence: currentExercise.sets.length + 1,
                kind: template.kind === "WARM_UP" ? "WARM_UP" : "WORKING",
                targetRepsMin: template.targetRepsMin ?? 8,
                targetRepsMax: template.targetRepsMax ?? 10,
                targetWeight: template.targetWeight,
                targetEffort: template.targetEffort,
                targetRestSeconds: template.targetRestSeconds,
            });
        } catch (addError) {
            setError(addError instanceof WorkoutQueueError ? "เพิ่มเซ็ตในเครื่องไม่สำเร็จ" : "เพิ่มเซ็ตไม่สำเร็จ");
        } finally {
            setBusyAction(false);
        }
        if (next) {
            const added = next.exercises
                .find((exercise) => exercise.id === currentExercise.id)
                ?.sets.at(-1);
            if (added) {
                const nextDrafts = {
                    ...draftsRef.current,
                    [added.id]: defaultAddedSetDraft(added, last),
                };
                draftsRef.current = nextDrafts;
                setDrafts(nextDrafts);
                setExpandedSetId(added.id);
                persistCache(next, nextDrafts);
            }
        }
    }

    async function deleteSet(set: SessionSet) {
        if (!canQueueSetMutation || !window.confirm("ลบเซ็ตนี้ออกจาก Session หรือไม่?")) return;
        setBusyAction(true);
        setBusySetId(set.id);
        try {
            const next = await enqueueWorkoutCommand({ action: "delete_set", setId: set.id });
            if (!next) return;
            const nextExercise = next.exercises.find((exercise) => exercise.id === currentExerciseId);
            setExpandedSetId(nextExercise?.sets.find((candidate) => candidate.status === "PENDING")?.id ?? nextExercise?.sets[0]?.id ?? null);
        } catch (deleteError) {
            setError(deleteError instanceof WorkoutQueueError ? "ไม่สามารถลบเซ็ตสุดท้ายหรือเซ็ตที่ไม่มีอยู่ได้" : "ลบเซ็ตไม่สำเร็จ");
        } finally {
            setBusyAction(false);
            setBusySetId(null);
        }
    }

    async function addExercise(exercise: Exercise) {
        if (!session || readOnly) return;
        const next = await applyCommand({
            action: "add_exercise",
            sessionExerciseId: crypto.randomUUID(),
            exerciseId: exercise.id,
            sequence: session.exercises.length + 1,
            setId: crypto.randomUUID(),
            notes: "",
        });
        if (next) {
            const addedExercise = next.exercises.at(-1);
            setCurrentExerciseId(addedExercise?.id ?? null);
            setExpandedSetId(addedExercise?.sets[0]?.id ?? null);
            setPickerOpen(false);
            persistCache(
                next,
                draftsRef.current,
                next.exercises.at(-1)?.id ?? null,
            );
        }
    }

    async function finish() {
        const current = sessionRef.current;
        if (!current || !canQueueSetMutation) return;
        const pending = current.exercises.reduce(
            (count, exercise) =>
                count +
                exercise.sets.filter((set) => set.status === "PENDING").length,
            0,
        );
        const completedWorking = current.exercises.reduce(
            (count, exercise) =>
                count +
                exercise.sets.filter(
                    (set) =>
                        set.kind === "WORKING" && set.status === "COMPLETED",
                ).length,
            0,
        );
        if (
            !window.confirm(
                `จบ Workout นี้หรือไม่? เสร็จแล้ว ${completedWorking} working sets${pending ? ` และยังมี ${pending} sets ที่ยังไม่บันทึก` : ""}`,
            )
        )
            return;
        if (
            completedWorking === 0 &&
            !window.confirm(
                "ยังไม่มี working set ที่บันทึกสำเร็จ ยืนยันการจบ Workout นี้หรือไม่?",
            )
        )
            return;
        setBusyAction(true);
        try {
            const next = await enqueueWorkoutCommand({ action: "finish_session" });
            if (!next) throw new WorkoutRepositoryError("unknown", "Finish Workout ไม่สำเร็จ");
            const stoppedTimer = { ...DEFAULT_TIMER };
            setTimer(stoppedTimer);
            await saveSessionCache(sessionCache(next, draftsRef.current, currentExerciseId, stoppedTimer, userId, (await loadSessionCache(next.id, userId))?.acknowledgedSession ?? current));
            navigate(`/workout/complete/${next.id}`);
        } catch (finishError) {
            setError(
                finishError instanceof WorkoutRepositoryError
                    ? finishError.message
                    : "Finish Workout ไม่สำเร็จ",
            );
        } finally {
            setBusyAction(false);
        }
    }

    async function discard() {
        const current = sessionRef.current;
        if (
            !current ||
            !canQueueSetMutation ||
            !window.confirm(
                "Discard Workout นี้หรือไม่? ข้อมูลจะไม่ถูกนำไปคำนวณ Progress และ Routine จะไม่เลื่อน",
            )
        )
            return;
        setBusyAction(true);
        try {
            const next = await enqueueWorkoutCommand({ action: "discard_session" });
            if (!next) throw new WorkoutRepositoryError("unknown", "Discard Workout ไม่สำเร็จ");
            const stoppedTimer = { ...DEFAULT_TIMER };
            setTimer(stoppedTimer);
            await saveSessionCache(sessionCache(next, draftsRef.current, currentExerciseId, stoppedTimer, userId, (await loadSessionCache(next.id, userId))?.acknowledgedSession ?? current));
            navigate("/today");
        } catch (discardError) {
            setError(
                discardError instanceof WorkoutRepositoryError
                    ? discardError.message
                    : "Discard Workout ไม่สำเร็จ",
            );
        } finally {
            setBusyAction(false);
        }
    }

    async function loadExercises() {
        const next = await exerciseRepository.list({
            search: "",
            muscleCode: "all",
            equipmentCode: "all",
            status: "active",
        });
        setAvailableExercises(next);
        setPickerOpen(true);
    }

    if (status === "loading") return <ActiveWorkoutLoading />;
    if (status === "error")
        return (
            <PageFrame
                pageId="P-07"
                eyebrow="P-07 · ACTIVE WORKOUT"
                title="เปิด Active Workout ไม่ได้"
                description={error}
            >
                <div role="alert" className="border-t-2 border-error pt-5">
                    <p className="text-error">{error}</p>
                    <Button
                        variant="secondary"
                        className="mt-5"
                        onClick={() => void load()}
                    >
                        ลองอีกครั้ง
                    </Button>
                </div>
            </PageFrame>
        );
    if (!session)
        return (
            <PageFrame
                pageId="P-07"
                eyebrow="P-07 · ACTIVE WORKOUT"
                title="ยังไม่มี Active Workout"
                description="เริ่มจาก Today เมื่อมี Routine หรือเลือก Ad-hoc Workout"
            >
                <EmptyState
                    marker="00"
                    title="ยังไม่มี Session ที่กำลังฝึก"
                    description="กลับไป Today เพื่อเริ่ม Planned หรือ Ad-hoc Workout"
                    action={
                        <Link to="/today" className={buttonStyles()}>
                            ไปที่ Today
                        </Link>
                    }
                />
            </PageFrame>
        );

    const style = { "--workout-keyboard-inset": "0px" } as CSSProperties;
    return (
        <div
            data-testid="active-workout"
            style={style}
            className="min-h-dvh bg-canvas pb-[calc(112px+env(safe-area-inset-bottom))] text-ink tablet:pb-8"
        >
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas px-4 tablet:static tablet:mx-auto tablet:max-w-content tablet:px-0 desktop:px-8 large:px-12">
                <Link
                    to="/today"
                    className="flex h-11 w-11 items-center justify-center text-ink-secondary hover:text-ink"
                    aria-label="ออกจาก Active Workout"
                >
                    <Icon name="close" className="h-6 w-6"/>
                </Link>
                <p className="text-xs font-semibold tracking-[0.08em] tabular-nums">
                    {currentExercise
                        ? `${currentIndex + 1} / ${session.exercises.length}`
                        : "ACTIVE SESSION"}
                </p>
                <span aria-hidden="true" className="h-11 w-11" />
            </header>
            {error ? (
                <p
                    role="status"
                    className="mx-auto max-w-content border-b border-warning px-4 py-3 text-sm text-warning tablet:px-6 desktop:px-8 large:px-12"
                >
                    {error}
                </p>
            ) : null}
            {offlineReadOnly ? (
                <p
                    role="status"
                    className="mx-auto max-w-content border-b border-warning px-4 py-3 text-sm text-warning tablet:px-6 desktop:px-8 large:px-12"
                >
                    Offline / read-only: เชื่อมต่อ Supabase เพื่อแก้ไข Session
                </p>
            ) : null}
            {!offlineReadOnly ? (
                <div
                    data-testid="sync-status"
                    role={syncSnapshot.status === "conflict" ? "alert" : "status"}
                    className={`mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm tablet:px-6 desktop:px-8 large:px-12 ${syncSnapshot.status === "conflict" ? "border-error text-error" : "border-line text-ink-secondary"}`}
                >
                    <span>
                        {!isOnline || syncSnapshot.status === "offline" ? "Offline" : syncSnapshot.status === "authorization" ? "ต้องเข้าสู่ระบบเพื่อซิงก์" : syncSnapshot.status === "syncing" ? "Syncing" : syncSnapshot.status === "conflict" ? "Conflict" : syncSnapshot.pendingCount > 0 ? "Saved locally" : "Synced"}
                        {syncSnapshot.pendingCount > 0 ? ` · ${syncSnapshot.pendingCount} รายการรอซิงก์` : ""}
                    </span>
                    {syncSnapshot.status === "conflict" ? (
                        <Link to={`/settings?session=${encodeURIComponent(session.id)}`} className={buttonStyles({ variant: "quiet", size: "compact" })}>
                            ตรวจสอบ Conflict
                        </Link>
                    ) : null}
                </div>
            ) : null}
            <div className="page-grid mx-auto max-w-content px-4 pt-6 tablet:px-6 tablet:pt-8 desktop:px-8 large:px-12">
                {session.exercises.length > 0 ? (
                    <ExerciseIndex
                        session={session}
                        currentId={currentExercise?.id ?? null}
                        onSelect={(exerciseId) => {
                            const nextExercise = session.exercises.find(
                                (exercise) => exercise.id === exerciseId,
                            );
                            setCurrentExerciseId(exerciseId);
                            setExpandedSetId(
                                nextExercise?.sets.find(
                                    (set) => set.status === "PENDING",
                                )?.id ?? nextExercise?.sets[0]?.id ?? null,
                            );
                        }}
                    />
                ) : null}
                <section
                    className={`col-span-4 min-w-0 desktop:px-3 large:px-5 ${currentExercise ? "tablet:col-span-6 desktop:col-span-7" : "tablet:col-span-8 desktop:col-span-12"}`}
                    aria-labelledby="active-workout-title"
                >
                    <p className="text-xs font-semibold tracking-[0.06em] text-accent">
                        P-07 · ACTIVE SESSION
                    </p>
                    <div className="mt-4 flex items-start justify-between gap-3">
                        <h1
                            id="active-workout-title"
                            className="text-[30px] font-bold leading-9 tracking-[-0.025em] tablet:text-h1"
                        >
                            {currentExercise?.name ??
                                session.templateNameSnapshot ??
                                "Ad-hoc Workout"}
                        </h1>
                        {currentExercise ? (
                            <details className="group relative shrink-0">
                                <summary
                                    className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xs border border-line text-ink-secondary hover:border-line-strong hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                                    aria-label="เปิดเมนูจัดการ Exercise"
                                >
                                    <Icon name="more" className="h-5 w-5" />
                                </summary>
                                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-52 border border-line bg-surface p-1 shadow-overlay">
                                    {session.exercises.length > 1 ? (
                                        <>
                                            <Button
                                                variant="quiet"
                                                fullWidth
                                                className="justify-start"
                                                disabled={readOnly || busyAction || currentIndex <= 0}
                                                onClick={() => void applyCommand({ action: "move_exercise", sessionExerciseId: currentExercise.id, sequence: currentIndex })}
                                            >
                                                <Icon name="chevron-up" className="h-5 w-5" />
                                                เลื่อนขึ้น
                                            </Button>
                                            <Button
                                                variant="quiet"
                                                fullWidth
                                                className="justify-start"
                                                disabled={readOnly || busyAction || currentIndex >= session.exercises.length - 1}
                                                onClick={() => void applyCommand({ action: "move_exercise", sessionExerciseId: currentExercise.id, sequence: currentIndex + 2 })}
                                            >
                                                <Icon name="chevron-down" className="h-5 w-5" />
                                                เลื่อนลง
                                            </Button>
                                        </>
                                    ) : null}
                                    <Button
                                        variant="destructive"
                                        fullWidth
                                        className="justify-start"
                                        disabled={readOnly || busyAction}
                                        onClick={() => {
                                            if (window.confirm("ลบ Exercise นี้ออกจาก Session หรือไม่?"))
                                                void applyCommand({ action: "remove_exercise", sessionExerciseId: currentExercise.id });
                                        }}
                                    >
                                        <Icon name="trash" className="h-5 w-5" />
                                        ลบ Exercise
                                    </Button>
                                </div>
                            </details>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">
                        {session.sourceType === "PLANNED"
                            ? `${session.routineNameSnapshot} · ${session.dayLabelSnapshot ?? "Workout"}`
                            : "Ad-hoc"}{" "}
                        · เริ่ม {formatSessionTime(session.startedAt)}
                        {currentExercise ? ` · ท่า ${currentIndex + 1}/${session.exercises.length}` : ""}
                    </p>
                    {currentExercise ? (
                        <section aria-label="เป้าหมายและข้อมูลครั้งก่อน" className="mt-5 grid grid-cols-2 border-y border-line">
                            <div className="min-w-0 border-r border-line p-3 tablet:p-4">
                                <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">TARGET</p>
                                <p className="mt-1 truncate text-sm font-semibold tabular-nums text-ink-secondary">
                                    {currentExercise.sets.length} sets · {currentExercise.sets[0]?.targetRepsMin ?? "—"}–{currentExercise.sets[0]?.targetRepsMax ?? "—"} reps
                                </p>
                            </div>
                            <div className="min-w-0 p-3 tablet:p-4">
                                <p className="text-[10px] font-semibold tracking-[0.06em] text-ink-muted">ครั้งก่อน</p>
                                <p className="mt-1 truncate text-sm font-semibold tabular-nums text-ink-secondary">
                                    {formatPreviousPerformance(currentPrevious)}
                                </p>
                            </div>
                        </section>
                    ) : null}
                    {!currentExercise ? (
                        <EmptyState
                            marker="00"
                            title="ยังไม่มี Exercise ใน Session"
                            description="เลือกท่าที่ต้องการฝึกจาก Exercise Library แล้วเริ่มบันทึกเซ็ตได้ทันที โดยไม่เปลี่ยน Template ต้นทาง"
                            action={
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        variant="accent"
                                        disabled={readOnly}
                                        onClick={() => void loadExercises()}
                                    >
                                        <Icon name="plus" className="h-5 w-5" />
                                        เพิ่มท่า
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        disabled={readOnly || busyAction}
                                        onClick={() => void discard()}
                                    >
                                        Discard session
                                    </Button>
                                </div>
                            }
                        />
                    ) : (
                        <section
                            aria-labelledby="set-log-heading"
                            className="mt-6"
                        >
                            <div className="flex items-end justify-between gap-3 border-b border-line pb-2">
                                <div>
                                    <p className="text-xs font-semibold tracking-[0.06em] text-ink-muted">
                                        SET LOG
                                    </p>
                                    <h2
                                        id="set-log-heading"
                                        className="mt-2 text-h3"
                                    >
                                        บันทึกเซ็ต
                                    </h2>
                                </div>
                                <p className="text-sm tabular-nums text-ink-muted">
                                    {
                                        currentExercise.sets.filter(
                                            (set) => set.status === "COMPLETED",
                                        ).length
                                    }{" "}
                                    / {currentExercise.sets.length} เสร็จแล้ว
                                </p>
                            </div>
                            <div className="mt-4 space-y-3">
                                {currentExercise.sets.map((set) => (
                                    <WorkoutSetRow
                                        key={set.id}
                                        set={set}
                                        draft={
                                            drafts[set.id] ?? draftFromSet(set)
                                        }
                                        errors={errors[set.id] ?? {}}
                                        expanded={expandedSetId === set.id}
                                        isBodyweight={currentExercise.equipmentCode === "bodyweight"}
                                        readOnly={!canQueueSetMutation}
                                        kindReadOnly={!canUseOnlineMutation}
                                        pendingSync={pendingSetIds.has(set.id)}
                                        busy={busySetId === set.id}
                                        onToggle={() => setExpandedSetId(
                                            expandedSetId === set.id ? null : set.id,
                                        )}
                                        onChange={(field, value) =>
                                            updateDraft(set.id, field, value)
                                        }
                                        onSave={() => void saveSet(set)}
                                        onSkip={() => void skipSet(set)}
                                        onDelete={() => void deleteSet(set)}
                                        onKindChange={(kind) =>
                                            void applyCommand(
                                                {
                                                    action: "set_kind",
                                                    setId: set.id,
                                                    kind,
                                                },
                                                set.id,
                                            )
                                        }
                                    />
                                ))}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    data-testid="add-set"
                                    variant="secondary"
                                    disabled={!canQueueSetMutation || busyAction}
                                    onClick={() => void addSet()}
                                >
                                    <Icon name="plus" className="h-5 w-5" />
                                    เพิ่ม Set
                                </Button>
                                <Button
                                    variant="quiet"
                                    disabled={readOnly || busyAction}
                                    onClick={() => void loadExercises()}
                                >
                                    <Icon name="plus" className="h-5 w-5" />
                                    เพิ่ม Exercise
                                </Button>
                            </div>
                        </section>
                    )}
                    <section className="mt-8 border-t border-line pt-5">
                        <details>
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
                                <span>
                                    Session notes
                                    {session.notes && !(session.sourceType === "AD_HOC" && session.notes === "Ad-hoc Workout") ? (
                                        <span className="ml-2 text-xs font-normal text-success">บันทึกแล้ว</span>
                                    ) : null}
                                </span>
                                <Icon name="chevron-down" className="h-5 w-5 text-ink-muted" />
                            </summary>
                            <textarea
                                id="session-notes"
                                defaultValue={session.sourceType === "AD_HOC" && session.notes === "Ad-hoc Workout" ? "" : session.notes}
                                disabled={readOnly || busyAction}
                                className="mt-3 min-h-24 w-full rounded-xs border border-line bg-surface p-3 text-base text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                                onBlur={(event) => {
                                    if (
                                        event.currentTarget.value !==
                                        sessionRef.current?.notes
                                    )
                                        void applyCommand({
                                            action: "update_session_notes",
                                            notes: event.currentTarget.value,
                                        });
                                }}
                            />
                        </details>
                    </section>
                </section>
                {currentExercise ? (
                    <aside className="col-span-4 mt-8 min-w-0 border-t border-line pt-5 tablet:col-span-2 tablet:mt-0 tablet:border-l tablet:border-t-0 tablet:pl-5 desktop:col-span-3">
                    {currentExercise ? (
                        <>
                            <RestTimer
                        timer={timer}
                        remainingSeconds={remainingSeconds}
                        readOnly={!canQueueSetMutation}
                        onPause={() => {
                            const next = pauseTimer(timer);
                            setTimer(next);
                            persistCache(
                                session,
                                draftsRef.current,
                                currentExerciseId,
                                next,
                            );
                        }}
                        onReset={() => {
                            const next = resetTimer(timer);
                            setClock(Date.now());
                            setTimer(next);
                            persistCache(
                                session,
                                draftsRef.current,
                                currentExerciseId,
                                next,
                            );
                        }}
                        onResume={() => {
                            const next = resumeTimer(timer);
                            setClock(Date.now());
                            setTimer(next);
                            persistCache(
                                session,
                                draftsRef.current,
                                currentExerciseId,
                                next,
                            );
                        }}
                        onSkip={() => {
                            const next = skipTimer(timer);
                            setTimer(next);
                            persistCache(
                                session,
                                draftsRef.current,
                                currentExerciseId,
                                next,
                            );
                        }}
                            />
                    <Divider className="my-5" />
                    <p className="text-sm leading-6 text-ink-secondary">
                        Complete, Edit, Skip, Add, Delete, Finish และ Discard จะบันทึกในเครื่องก่อนและซิงก์อัตโนมัติ ส่วนการแก้โครงสร้างอื่นต้องออนไลน์
                    </p>
                    <div className="mt-5 space-y-2">
                        <Button
                            variant="secondary"
                            fullWidth
                            disabled={!canQueueSetMutation || busyAction}
                            onClick={() => void finish()}
                        >
                            Finish Workout
                        </Button>
                        <Button
                            variant="quiet"
                            fullWidth
                            disabled={!canQueueSetMutation || busyAction}
                            onClick={() => void discard()}
                        >
                            Discard
                        </Button>
                        </div>
                        </>
                    ) : null}
                    </aside>
                ) : null}
            </div>
            <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas p-4 tablet:hidden">
                <Button
                    variant="accent"
                    size="large"
                    fullWidth
                    disabled={!canQueueSetMutation || busyAction || !pendingSet}
                    data-testid="primary-set-action"
                    onClick={() => {
                        if (pendingSet) void saveSet(pendingSet);
                    }}
                >
                    {pendingSet
                        ? "Complete Set"
                        : "ทุกเซ็ตเสร็จแล้ว"}
                </Button>
            </div>
            {pickerOpen ? (
                <ExercisePicker
                    exercises={availableExercises}
                    readOnly={readOnly}
                    onClose={() => setPickerOpen(false)}
                    onSelect={(exercise) => void addExercise(exercise)}
                />
            ) : null}
        </div>
    );
}

export function CompletionSummaryPage() {
    const repository = useWorkoutRepository();
    const progressRepository = useProgressRepository();
    const auth = useAuth();
    const [progressUnit] = useProgressDisplayUnit(auth.session?.user.id ?? "");
    const syncCoordinator = useWorkoutSync();
    const { sessionId } = useParams();
    const [summary, setSummary] = useState<Awaited<
        ReturnType<typeof repository.getCompletionSummary>
    > | null>(null);
    const [error, setError] = useState("");
    const [syncSnapshot, setSyncSnapshot] = useState<WorkoutSyncSnapshot>(syncCoordinator.getSnapshot());
    const [records, setRecords] = useState<ProgressRecord[]>([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError, setRecordsError] = useState(false);
    useEffect(() => {
        if (!sessionId) return;
        void repository
            .getCompletionSummary(sessionId)
            .then(setSummary)
            .catch((loadError) =>
                setError(
                    loadError instanceof WorkoutRepositoryError
                        ? loadError.message
                        : "โหลด Summary ไม่สำเร็จ",
                ),
            );
    }, [repository, sessionId]);
    useEffect(() => {
        if (!sessionId) return;
        syncCoordinator.start(sessionId);
        const unsubscribe = syncCoordinator.subscribe(() => setSyncSnapshot({ ...syncCoordinator.getSnapshot() }));
        void loadSessionCache(sessionId, auth.session?.user.id).then((cached) => {
            if (cached?.session.status === "COMPLETED") {
                setSummary((current) => current ?? completionSummaryFromSession(cached.session));
                setError("");
            }
        }).catch(() => undefined);
        return unsubscribe;
    }, [auth.session?.user.id, sessionId, syncCoordinator]);
    useEffect(() => {
        if (!sessionId || !summary || syncSnapshot.pendingCount > 0 || syncSnapshot.status === "offline" || syncSnapshot.status === "conflict") return;
        let active = true;
        setRecordsLoading(true);
        setRecordsError(false);
        void progressRepository.listSessionRecords(sessionId).then((next) => { if (active) setRecords(next); }).catch(() => { if (active) { setRecords([]); setRecordsError(true); } }).finally(() => { if (active) setRecordsLoading(false); });
        return () => { active = false; };
    }, [progressRepository, sessionId, summary, syncSnapshot.pendingCount, syncSnapshot.status]);
    if (error && !summary)
        return (
            <PageFrame
                pageId="P-08"
                eyebrow="P-08 · COMPLETION SUMMARY"
                title="โหลด Summary ไม่สำเร็จ"
                description={error}
            >
                <Link to="/today" className={buttonStyles()}>
                    กลับ Today
                </Link>
            </PageFrame>
        );
    if (!summary)
        return (
            <PageFrame
                pageId="P-08"
                eyebrow="P-08 · COMPLETION SUMMARY"
                title="Completion Summary"
                description="กำลังคำนวณผลการฝึก…"
            >
                <p className="border-t border-line pt-6 text-ink-muted">
                    กำลังโหลด Summary…
                </p>
            </PageFrame>
        );
    return (
        <PageFrame
            pageId="P-08"
            eyebrow="P-08 · COMPLETION SUMMARY"
            title="สรุปการฝึก"
            description={`${summary.templateName ?? "Ad-hoc Workout"} · ${new Date(summary.completedAt).toLocaleString("th-TH")}`}
            action={
                <Link to="/today" className={buttonStyles()}>
                    เสร็จสิ้น
                </Link>
            }
        >
            {syncSnapshot.pendingCount > 0 || syncSnapshot.status === "synced" ? (
                <p role="status" className="mb-5 border-l-2 border-warning pl-4 text-sm text-warning">
                    {syncSnapshot.pendingCount === 0 ? "Synced" : syncSnapshot.status === "offline" ? "Offline · บันทึก Summary ไว้ในเครื่องแล้ว" : syncSnapshot.status === "conflict" ? "Conflict · ข้อมูล local ยังไม่ถูกลบ" : syncSnapshot.status === "syncing" ? "Syncing…" : "Saved locally · กำลังรอการซิงก์"}
                    {syncSnapshot.status === "conflict" ? <Link className="ml-3 underline" to={`/settings?session=${encodeURIComponent(sessionId ?? "")}`}>ตรวจสอบ Conflict</Link> : null}
                </p>
            ) : null}
            <div className="page-grid">
                <div className="col-span-4 grid grid-cols-2 gap-x-4 tablet:col-span-8 tablet:grid-cols-4 desktop:col-span-12">
                    <StatBlock
                        label="ระยะเวลา"
                        value={formatTimer(summary.durationSeconds)}
                    />
                    <StatBlock
                        label="Working sets"
                        value={String(summary.completedWorkingSetCount)}
                    />
                    <StatBlock
                        label="Volume"
                        value={summary.volumeKg.toFixed(1)}
                        unit="KG"
                        accent
                    />
                    <StatBlock
                        label="Pending sets"
                        value={String(summary.pendingSetCount)}
                    />
                </div>
                <section className="col-span-4 mt-10 border-t border-line pt-6 tablet:col-span-8 desktop:col-span-8">
                    <SectionHeader
                        eyebrow="SESSION SNAPSHOT"
                        title={summary.templateName ?? "Ad-hoc Workout"}
                        description="Summary นี้คำนวณจาก Session snapshot และไม่เปลี่ยนตาม Template ภายหลัง"
                    />
                    <div className="mt-4 border-t border-line">
                        {summary.exercises.map((exercise) => (
                            <div
                                key={exercise.name}
                                className="flex items-center justify-between gap-3 border-b border-line-subtle py-3"
                            >
                                <span className="truncate font-semibold">
                                    {exercise.name}
                                </span>
                                <span className="shrink-0 text-sm tabular-nums text-ink-secondary">
                                    {exercise.completedSetCount} sets ·{" "}
                                    {exercise.volumeKg.toFixed(1)} KG
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="col-span-4 mt-10 border-t border-line pt-6 tablet:col-span-8 desktop:col-span-4">
                    <SectionHeader eyebrow="PERSONAL RECORDS" title="PR จาก Workout นี้" description="คำนวณจากข้อมูลที่ server ยืนยันแล้ว" />
                    <div className="mt-4">
                        {syncSnapshot.status === "conflict" ? <p className="text-sm text-warning">ยังไม่คำนวณ PR เพราะ Session มี conflict · <Link className="underline" to={`/settings?session=${encodeURIComponent(sessionId ?? "")}`}>ตรวจสอบ Sync Status</Link></p>
                            : syncSnapshot.pendingCount > 0 || syncSnapshot.status === "offline" ? <p className="text-sm text-ink-secondary">กำลังรอซิงก์เพื่อคำนวณ PR</p>
                                : recordsLoading ? <p className="text-sm text-ink-secondary">กำลังคำนวณ PR…</p>
                                    : recordsError ? <p className="text-sm text-error">คำนวณ PR ไม่สำเร็จ กรุณาเปิดหน้านี้ใหม่เมื่อเชื่อมต่อได้</p>
                                        : <SessionRecordList records={records} unit={progressUnit} />}
                    </div>
                </section>
            </div>
        </PageFrame>
    );
}
