import {
  equipmentOptions,
  muscleOptions,
  type Exercise,
  type ExerciseDraft,
  type ExerciseQuery,
} from "../domain/exercise";
import {
  filterExercises,
  hasExerciseValidationErrors,
  normalizeExerciseName,
  validateExerciseDraft,
} from "../domain/exerciseRules";
import {
  ExerciseRepositoryError,
  type ExerciseRepository,
} from "./ExerciseRepository";

const EXERCISE_SELECT = [
  "id",
  "name",
  "normalized_name",
  "equipment_code",
  "notes",
  "owner_user_id",
  "archived_at",
  "version",
  "primary_muscle:muscles!exercises_primary_muscle_id_fkey(code)",
  "exercise_secondary_muscles(sequence_no,muscle:muscles!exercise_secondary_muscles_muscle_id_fkey(code))",
].join(",");

export interface SupabaseRequest {
  method: "GET" | "POST" | "PATCH";
  path: string;
  body?: unknown;
}

export interface SupabaseDataClient {
  request<T>(request: SupabaseRequest): Promise<T>;
}

export class SupabaseRequestError extends Error {
  constructor(public readonly status: number, public readonly payload: unknown) {
    super("Supabase request failed");
    this.name = "SupabaseRequestError";
  }
}

export interface SupabaseRestClientOptions {
  url: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
  accessToken?: () => string | null;
}

function readSupabaseAccessToken() {
  if (typeof localStorage === "undefined") return null;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as { access_token?: unknown } | null;
      if (typeof value?.access_token === "string" && value.access_token) return value.access_token;
    } catch {
      // Ignore unrelated localStorage values.
    }
  }
  return null;
}

export class SupabaseRestClient implements SupabaseDataClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseRestClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>({ method, path, body }: SupabaseRequest): Promise<T> {
    const accessToken = this.options.accessToken?.() ?? readSupabaseAccessToken();
    const headers = new Headers({
      apikey: this.options.anonKey,
      Accept: "application/json",
      Prefer: "return=representation",
    });
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else if (this.options.anonKey.split(".").length === 3) {
      headers.set("Authorization", `Bearer ${this.options.anonKey}`);
    }
    const response = await this.fetchImpl(`${this.options.url.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }
    if (!response.ok) throw new SupabaseRequestError(response.status, payload);
    return payload as T;
  }
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ExerciseRepositoryError("unknown", `Supabase Exercise response มี ${field} ไม่ถูกต้อง`);
  }
  return value;
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return asString(value, field);
}

function isMuscleCode(value: string): value is Exercise["primaryMuscleCode"] {
  return muscleOptions.some((option) => option.code === value);
}

function isEquipmentCode(value: string): value is Exercise["equipmentCode"] {
  return equipmentOptions.some((option) => option.code === value);
}

function parseMuscleCode(value: unknown, field: string): Exercise["primaryMuscleCode"] {
  const relation = asRecord(value);
  const code = asString(relation?.code, field);
  if (!isMuscleCode(code)) {
    throw new ExerciseRepositoryError("unknown", `Supabase ส่ง muscle code ที่ไม่รองรับ: ${code}`);
  }
  return code;
}

function parseExercise(value: unknown): Exercise {
  const row = asRecord(value);
  if (!row) throw new ExerciseRepositoryError("unknown", "Supabase Exercise response ไม่ใช่ object");

  const id = asString(row.id, "id");
  const name = asString(row.name, "name");
  const normalizedName = asString(row.normalized_name, "normalized_name");
  const equipmentCode = asString(row.equipment_code, "equipment_code");
  if (!isEquipmentCode(equipmentCode)) {
    throw new ExerciseRepositoryError("unknown", `Supabase ส่ง equipment code ที่ไม่รองรับ: ${equipmentCode}`);
  }
  const primaryMuscleCode = parseMuscleCode(row.primary_muscle, "primary_muscle.code");
  const secondaryRows = row.exercise_secondary_muscles;
  if (!Array.isArray(secondaryRows)) {
    throw new ExerciseRepositoryError("unknown", "Supabase Exercise response ไม่มี secondary muscles");
  }

  const secondaryMuscleCodes = secondaryRows
    .map((entry) => {
      const relation = asRecord(entry);
      if (!relation || !Number.isInteger(relation.sequence_no) || Number(relation.sequence_no) < 1) {
        throw new ExerciseRepositoryError("unknown", "Supabase Exercise response มี sequence_no ไม่ถูกต้อง");
      }
      return {
        sequence: relation?.sequence_no,
        code: parseMuscleCode(relation?.muscle, "exercise_secondary_muscles.muscle.code"),
      };
    })
    .sort((left, right) => Number(left.sequence) - Number(right.sequence))
    .map((entry) => entry.code);

  if (new Set(secondaryMuscleCodes).size !== secondaryMuscleCodes.length || secondaryMuscleCodes.includes(primaryMuscleCode)) {
    throw new ExerciseRepositoryError("unknown", "Supabase Exercise response มี secondary muscle ซ้ำหรือซ้อนกับ primary");
  }

  const ownerUserId = asNullableString(row.owner_user_id, "owner_user_id");
  const version = row.version;
  if (!Number.isInteger(version) || Number(version) < 1) {
    throw new ExerciseRepositoryError("unknown", "Supabase Exercise response มี version ไม่ถูกต้อง");
  }

  return {
    id,
    name,
    normalizedName,
    primaryMuscleCode,
    secondaryMuscleCodes,
    equipmentCode,
    description: typeof row.notes === "string" ? row.notes : "",
    source: ownerUserId ? "custom" : "starter",
    archivedAt: asNullableString(row.archived_at, "archived_at"),
    version: Number(version),
  };
}

function rowsFromResponse(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new ExerciseRepositoryError("unknown", "Supabase Exercise response ต้องเป็น array");
  }
  return value;
}

function idFromRpcResponse(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return idFromRpcResponse(value[0]);
  const record = asRecord(value);
  return record && typeof record.id === "string" ? record.id : null;
}

function mapSupabaseError(error: unknown, fallback: string): ExerciseRepositoryError {
  if (error instanceof ExerciseRepositoryError) return error;
  if (error instanceof SupabaseRequestError) {
    const payload = asRecord(error.payload);
    const code = typeof payload?.code === "string" ? payload.code : "";
    if (error.status === 409 || code === "23505") {
      return new ExerciseRepositoryError("validation", "มี Exercise ชื่อนี้อยู่แล้ว");
    }
    if (error.status === 404) return new ExerciseRepositoryError("not-found", "ไม่พบท่าฝึกที่ต้องการ");
    if (error.status === 401 || error.status === 403) {
      return new ExerciseRepositoryError("unknown", "ต้องเข้าสู่ระบบเพื่อจัดการ Custom Exercise");
    }
  }
  return new ExerciseRepositoryError("unknown", fallback);
}

function normalizedDraft(draft: ExerciseDraft) {
  return {
    ...draft,
    name: draft.name.normalize("NFKC").trim().replace(/\s+/g, " "),
    description: draft.description.trim(),
    normalizedName: normalizeExerciseName(draft.name),
  };
}

export class SupabaseExerciseRepository implements ExerciseRepository {
  constructor(private readonly client: SupabaseDataClient) {}

  async list(query: ExerciseQuery): Promise<Exercise[]> {
    try {
      const params = new URLSearchParams({
        select: EXERCISE_SELECT,
        order: "name.asc",
      });
      if (query.status === "active") params.set("archived_at", "is.null");
      if (query.status === "archived") params.set("archived_at", "not.is.null");
      const rows = rowsFromResponse(await this.client.request<unknown[]>({ method: "GET", path: `exercises?${params.toString()}` }));
      return filterExercises(rows.map(parseExercise), query);
    } catch (error) {
      throw mapSupabaseError(error, "โหลด Exercise Library จาก Supabase ไม่สำเร็จ");
    }
  }

  async getById(id: string): Promise<Exercise | null> {
    try {
      const params = new URLSearchParams({ select: EXERCISE_SELECT, id: `eq.${id}` });
      const rows = rowsFromResponse(await this.client.request<unknown[]>({ method: "GET", path: `exercises?${params.toString()}` }));
      return rows.length === 0 ? null : parseExercise(rows[0]);
    } catch (error) {
      throw mapSupabaseError(error, "โหลดรายละเอียด Exercise จาก Supabase ไม่สำเร็จ");
    }
  }

  async create(draft: ExerciseDraft): Promise<Exercise> {
    try {
      const existing = await this.list({ search: "", muscleCode: "all", equipmentCode: "all", status: "all" });
      const fieldErrors = validateExerciseDraft(draft, existing);
      if (hasExerciseValidationErrors(fieldErrors)) {
        throw new ExerciseRepositoryError("validation", "ตรวจสอบข้อมูลท่าฝึกที่ระบุ", fieldErrors);
      }
      const value = normalizedDraft(draft);
      const response = await this.client.request<unknown>({
        method: "POST",
        path: "rpc/create_custom_exercise",
        body: {
          p_name: value.name,
          p_normalized_name: value.normalizedName,
          p_equipment_code: value.equipmentCode,
          p_primary_muscle_code: value.primaryMuscleCode,
          p_secondary_muscle_codes: value.secondaryMuscleCodes,
          p_notes: value.description || null,
        },
      });
      const id = idFromRpcResponse(response);
      if (!id) throw new ExerciseRepositoryError("unknown", "Supabase ไม่คืน id ของ Exercise ที่สร้าง");
      const created = await this.getById(id);
      if (!created) throw new ExerciseRepositoryError("unknown", "สร้าง Exercise แล้วแต่โหลดข้อมูลกลับไม่ได้");
      return created;
    } catch (error) {
      throw mapSupabaseError(error, "สร้าง Exercise ใน Supabase ไม่สำเร็จ");
    }
  }

  async update(id: string, draft: ExerciseDraft): Promise<Exercise> {
    try {
      const current = await this.getById(id);
      if (!current) throw new ExerciseRepositoryError("not-found", "ไม่พบท่าฝึกที่ต้องการแก้ไข");
      if (current.source === "starter") throw new ExerciseRepositoryError("read-only", "Starter Exercise แก้ไขไม่ได้");
      if (current.archivedAt) throw new ExerciseRepositoryError("archived", "Exercise ที่ archive แล้วแก้ไขไม่ได้");

      const existing = await this.list({ search: "", muscleCode: "all", equipmentCode: "all", status: "all" });
      const fieldErrors = validateExerciseDraft(draft, existing, id);
      if (hasExerciseValidationErrors(fieldErrors)) {
        throw new ExerciseRepositoryError("validation", "ตรวจสอบข้อมูลท่าฝึกที่ระบุ", fieldErrors);
      }
      const value = normalizedDraft(draft);
      await this.client.request<unknown>({
        method: "POST",
        path: "rpc/update_custom_exercise",
        body: {
          p_exercise_id: id,
          p_expected_version: current.version,
          p_name: value.name,
          p_normalized_name: value.normalizedName,
          p_equipment_code: value.equipmentCode,
          p_primary_muscle_code: value.primaryMuscleCode,
          p_secondary_muscle_codes: value.secondaryMuscleCodes,
          p_notes: value.description || null,
        },
      });
      const updated = await this.getById(id);
      if (!updated) throw new ExerciseRepositoryError("unknown", "แก้ไข Exercise แล้วแต่โหลดข้อมูลกลับไม่ได้");
      return updated;
    } catch (error) {
      throw mapSupabaseError(error, "แก้ไข Exercise ใน Supabase ไม่สำเร็จ");
    }
  }

  async archive(id: string): Promise<Exercise> {
    try {
      const current = await this.getById(id);
      if (!current) throw new ExerciseRepositoryError("not-found", "ไม่พบท่าฝึกที่ต้องการ archive");
      if (current.source === "starter") throw new ExerciseRepositoryError("read-only", "Starter Exercise archive ไม่ได้");
      if (current.archivedAt) return current;
      await this.client.request<unknown>({
        method: "POST",
        path: "rpc/archive_custom_exercise",
        body: { p_exercise_id: id, p_expected_version: current.version },
      });
      const archived = await this.getById(id);
      if (!archived) throw new ExerciseRepositoryError("unknown", "archive แล้วแต่โหลดข้อมูลกลับไม่ได้");
      return archived;
    } catch (error) {
      throw mapSupabaseError(error, "Archive Exercise ใน Supabase ไม่สำเร็จ");
    }
  }
}

class UnconfiguredExerciseRepository implements ExerciseRepository {
  private readonly error = new ExerciseRepositoryError(
    "unknown",
    "ยังไม่ได้ตั้งค่า Supabase โปรดสร้าง .env.local ตามคู่มือการติดตั้ง",
  );

  list(): Promise<Exercise[]> { return Promise.reject(this.error); }
  getById(): Promise<Exercise | null> { return Promise.reject(this.error); }
  create(): Promise<Exercise> { return Promise.reject(this.error); }
  update(): Promise<Exercise> { return Promise.reject(this.error); }
  archive(): Promise<Exercise> { return Promise.reject(this.error); }
}

export function createSupabaseExerciseRepository(): ExerciseRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return new UnconfiguredExerciseRepository();
  }
  return new SupabaseExerciseRepository(new SupabaseRestClient({ url, anonKey }));
}
