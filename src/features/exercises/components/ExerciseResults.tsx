import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import {
  getEquipmentLabel,
  getMuscleLabel,
  type Exercise,
} from "../domain/exercise";
import { paginateExercises } from "../domain/exerciseRules";

const EXERCISES_PER_PAGE = 10;

function sourceLabel(exercise: Exercise) {
  return exercise.source === "starter" ? "Starter" : "Custom";
}

function secondaryMuscles(exercise: Exercise) {
  if (exercise.secondaryMuscleCodes.length === 0) return "—";
  return exercise.secondaryMuscleCodes.map(getMuscleLabel).join(", ");
}

function StatusLabel({ exercise }: { exercise: Exercise }) {
  return exercise.archivedAt ? (
    <span className="font-semibold text-warning">Archived</span>
  ) : (
    <span className="text-ink-muted">Active</span>
  );
}

function ExercisePagination({
  page,
  pageCount,
  startIndex,
  endIndex,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  startIndex: number;
  endIndex: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= EXERCISES_PER_PAGE) return null;

  return (
    <nav
      aria-label="แบ่งหน้ารายการท่าฝึก"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
    >
      <p className="text-sm text-ink-muted">
        แสดง {startIndex + 1}–{endIndex} จาก {total} รายการ
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="default"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="ไปหน้าก่อนหน้า"
        >
          ก่อนหน้า
        </Button>
        <span aria-live="polite" className="min-w-20 text-center text-sm font-semibold text-ink">
          หน้า {page} / {pageCount}
        </span>
        <Button
          variant="secondary"
          size="default"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="ไปหน้าถัดไป"
        >
          ถัดไป
        </Button>
      </div>
    </nav>
  );
}

export function ExerciseResults({ exercises }: { exercises: Exercise[] }) {
  const [requestedPage, setRequestedPage] = useState(1);
  const { items, page, pageCount, startIndex, endIndex } = paginateExercises(
    exercises,
    requestedPage,
    EXERCISES_PER_PAGE,
  );

  useEffect(() => {
    setRequestedPage(1);
  }, [exercises]);

  return (
    <div id="exercise-results" className="min-w-0">
      <ul className="desktop:hidden">
        {items.map((exercise) => (
          <li key={exercise.id}>
            <Link
              to={`/exercises/${exercise.id}`}
              className="grid min-h-[76px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:bg-interactive"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold leading-6 text-ink">{exercise.name}</p>
                <p className="mt-1 break-words text-sm leading-5 text-ink-muted">
                  {getMuscleLabel(exercise.primaryMuscleCode)} · {getEquipmentLabel(exercise.equipmentCode)}
                </p>
                <p className="mt-1 text-xs font-semibold text-ink-secondary">
                  {sourceLabel(exercise)}{exercise.archivedAt ? " · Archived" : ""}
                </p>
              </div>
              <span aria-hidden="true" className="text-xl text-ink-muted">→</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden min-w-0 desktop:block">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">รายการท่าฝึก</caption>
          <thead className="border-y border-line bg-surface text-xs font-semibold tracking-[0.025em] text-ink-secondary">
            <tr>
              <th scope="col" className="w-[30%] px-3 py-3">ท่าฝึก</th>
              <th scope="col" className="w-[17%] px-3 py-3">กล้ามเนื้อหลัก</th>
              <th scope="col" className="w-[24%] px-3 py-3">กล้ามเนื้อรอง</th>
              <th scope="col" className="w-[14%] px-3 py-3">อุปกรณ์</th>
              <th scope="col" className="w-[15%] px-3 py-3">ประเภท / สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((exercise) => (
              <tr key={exercise.id} className="border-b border-line-subtle hover:bg-interactive">
                <th scope="row" className="px-3 py-3 font-semibold">
                  <Link
                    to={`/exercises/${exercise.id}`}
                    className="break-words underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {exercise.name}
                  </Link>
                </th>
                <td className="break-words px-3 py-3 text-sm text-ink-secondary">{getMuscleLabel(exercise.primaryMuscleCode)}</td>
                <td className="break-words px-3 py-3 text-sm text-ink-secondary">{secondaryMuscles(exercise)}</td>
                <td className="break-words px-3 py-3 text-sm text-ink-secondary">{getEquipmentLabel(exercise.equipmentCode)}</td>
                <td className="px-3 py-3 text-sm">
                  <span className="block font-semibold">{sourceLabel(exercise)}</span>
                  <StatusLabel exercise={exercise} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ExercisePagination
        page={page}
        pageCount={pageCount}
        startIndex={startIndex}
        endIndex={endIndex}
        total={exercises.length}
        onPageChange={setRequestedPage}
      />
    </div>
  );
}
