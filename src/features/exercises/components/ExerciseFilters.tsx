import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { ExerciseFilterPopover } from "./ExerciseFilterPopover";
import {
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

function SearchField({ query, onChange }: ExerciseFiltersProps) {
  return (
    <Input
      label="ค้นหาชื่อท่าฝึก"
      type="search"
      value={query.search}
      placeholder="เช่น Bench Press"
      aria-controls="exercise-results"
      clearButtonLabel="ล้างคำค้นหา"
      onClear={() => onChange({ ...query, search: "" })}
      onChange={(event) => onChange({ ...query, search: event.target.value })}
    />
  );
}

export function ExerciseFilters({ query, onChange }: ExerciseFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-end gap-2 tablet:hidden">
        <div className="min-w-0 flex-1">
          <SearchField query={query} onChange={onChange} />
        </div>
        <ExerciseFilterPopover
          muscleFilter={query.muscleCode}
          equipmentFilter={query.equipmentCode}
          statusFilter={query.status}
          onMuscleChange={(value) => onChange({ ...query, muscleCode: value })}
          onEquipmentChange={(value) => onChange({ ...query, equipmentCode: value })}
          onStatusChange={(value) => onChange({ ...query, status: value })}
        />
      </div>

      <div className="hidden min-w-0 items-end gap-2 tablet:flex desktop:hidden">
        <div className="min-w-0 flex-1">
          <SearchField query={query} onChange={onChange} />
        </div>
        <ExerciseFilterPopover
          muscleFilter={query.muscleCode}
          equipmentFilter={query.equipmentCode}
          statusFilter={query.status}
          onMuscleChange={(value) => onChange({ ...query, muscleCode: value })}
          onEquipmentChange={(value) => onChange({ ...query, equipmentCode: value })}
          onStatusChange={(value) => onChange({ ...query, status: value })}
        />
      </div>

      <div className="hidden space-y-4 desktop:block">
        <SearchField query={query} onChange={onChange} />
        <FilterSelects query={query} onChange={onChange} />
      </div>
    </div>
  );
}
