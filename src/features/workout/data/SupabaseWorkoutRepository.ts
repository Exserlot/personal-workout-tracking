import { SupabaseRestClient } from "../../../lib/supabase/SupabaseRestClient";
import { SupabaseWorkoutRepository } from "./WorkoutRepository";
import type { WorkoutRepository } from "../domain/workout";

class UnconfiguredWorkoutRepository implements WorkoutRepository {
  private readonly error = new Error("ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจสอบ .env.local");
  registerDevice(): Promise<never> { return Promise.reject(this.error); }
  listDevices(): Promise<never> { return Promise.reject(this.error); }
  getActiveSession(): Promise<never> { return Promise.reject(this.error); }
  getSession(): Promise<never> { return Promise.reject(this.error); }
  getPreviousValues(): Promise<never> { return Promise.reject(this.error); }
  startPlanned(): Promise<never> { return Promise.reject(this.error); }
  startAdHoc(): Promise<never> { return Promise.reject(this.error); }
  applyCommand(): Promise<never> { return Promise.reject(this.error); }
  applyIdempotentCommand(): Promise<never> { return Promise.reject(this.error); }
  finishSession(): Promise<never> { return Promise.reject(this.error); }
  discardSession(): Promise<never> { return Promise.reject(this.error); }
  remoteAbandonSession(): Promise<never> { return Promise.reject(this.error); }
  getCompletionSummary(): Promise<never> { return Promise.reject(this.error); }
}

export function createSupabaseWorkoutRepository(): WorkoutRepository {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new UnconfiguredWorkoutRepository();
  return new SupabaseWorkoutRepository(new SupabaseRestClient({ url, anonKey }));
}
