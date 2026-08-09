import { Icon } from "../../../components/icons/Icon";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import {
  defaultExerciseQuery,
  equipmentOptions,
  muscleOptions,
  type ExerciseQuery,
} from "../domain/exercise";

interface ExerciseFiltersProps {
  query: ExerciseQuery;
  onChange: (query: ExerciseQuery) => void;
}

function FilterSelects({ query, onChange }: ExerciseFiltersProps) {
  return (
    <>
      <Select
        label="กลุ่มกล้ามเนื้อ"
        value={query.muscleCode}
        onChange={(event) => onChange({ ...query, muscleCode: event.target.value as ExerciseQuery["muscleCode"] })}
      >
        <option value="all">ทั้งหมด</option>
        {muscleOptions.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </Select>
      <Select
        label="อุปกรณ์"
        value={query.equipmentCode}
        onChange={(event) => onChange({ ...query, equipmentCode: event.target.value as ExerciseQuery["equipmentCode"] })}
      >
        <option value="all">ทั้งหมด</option>
        {equipmentOptions.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </Select>
      <Select
        label="สถานะ"
        value={query.status}
        onChange={(event) => onChange({ ...query, status: event.target.value as ExerciseQuery["status"] })}
      >
        <option value="active">ใช้งานอยู่</option>
        <option value="archived">Archived</option>
        <option value="all">ทั้งหมด</option>
      </Select>
    </>
  );
}

export function ExerciseFilters({ query, onChange }: ExerciseFiltersProps) {
  const hasFilters =
    query.search !== defaultExerciseQuery.search ||
    query.muscleCode !== defaultExerciseQuery.muscleCode ||
    query.equipmentCode !== defaultExerciseQuery.equipmentCode ||
    query.status !== defaultExerciseQuery.status;

  return (
    <div className="space-y-4">
      <Input
        label="ค้นหาชื่อท่าฝึก"
        type="search"
        value={query.search}
        placeholder="เช่น Bench Press"
        aria-controls="exercise-results"
        onChange={(event) => onChange({ ...query, search: event.target.value })}
      />

      <details className="group border-y border-line tablet:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          <span className="flex items-center gap-2"><Icon name="filter" className="h-4 w-4" />ตัวกรอง</span>
          <Icon name="chevron-down" className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-line-subtle py-4">
          <FilterSelects query={query} onChange={onChange} />
        </div>
      </details>

      <div className="hidden gap-4 tablet:grid tablet:grid-cols-3 desktop:grid-cols-1">
        <FilterSelects query={query} onChange={onChange} />
      </div>

      {hasFilters ? (
        <Button variant="quiet" className="w-full tablet:w-auto desktop:w-full" onClick={() => onChange(defaultExerciseQuery)}>
          <Icon name="close" className="h-4 w-4" />
          ล้างตัวกรอง
        </Button>
      ) : null}
    </div>
  );
}
