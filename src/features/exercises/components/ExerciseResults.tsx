import { Link } from "react-router-dom";
import {
  getEquipmentLabel,
  getMuscleLabel,
  type Exercise,
} from "../domain/exercise";

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

export function ExerciseResults({ exercises }: { exercises: Exercise[] }) {
  return (
    <div id="exercise-results" className="min-w-0">
      <ul className="desktop:hidden">
        {exercises.map((exercise) => (
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
            {exercises.map((exercise) => (
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
    </div>
  );
}
