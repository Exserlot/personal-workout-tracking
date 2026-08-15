import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { ExerciseEditorPage, ExerciseLibraryPage } from "../pages/ExercisePages";
import { HistoryDetailPage, HistoryPage } from "../pages/HistoryPages";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlansPage, TemplateEditorPage } from "../pages/PlanningPages";
import { ExerciseProgressPage, ProgressPage } from "../pages/ProgressPages";
import { SettingsPage } from "../pages/SettingsPage";
import { TodayPage } from "../pages/TodayPage";
import { ActiveWorkoutPage, CompletionSummaryPage } from "../pages/WorkoutPages";
import { ExerciseRepositoryProvider } from "../features/exercises/ExerciseRepositoryProvider";
import { createSupabaseExerciseRepository } from "../features/exercises/data/SupabaseExerciseRepository";
import { AuthProvider } from "../features/auth/AuthProvider";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { PlanningRepositoryProvider } from "../features/planning/PlanningRepositoryProvider";
import { createSupabasePlanningRepository } from "../features/planning/data/SupabasePlanningRepository";
import { WorkoutRepositoryProvider } from "../features/workout/WorkoutRepositoryProvider";
import { createSupabaseWorkoutRepository } from "../features/workout/data/SupabaseWorkoutRepository";
import { WorkoutSyncProvider } from "../features/workout/WorkoutSyncProvider";
import { HistoryRepositoryProvider } from "../features/history/HistoryRepositoryProvider";
import { createSupabaseHistoryRepository } from "../features/history/data/SupabaseHistoryRepository";
import { ProgressRepositoryProvider } from "../features/progress/ProgressRepositoryProvider";
import { createSupabaseProgressRepository } from "../features/progress/data/SupabaseProgressRepository";

const exerciseRepository = createSupabaseExerciseRepository();
const planningRepository = createSupabasePlanningRepository();
const workoutRepository = createSupabaseWorkoutRepository();
const historyRepository = createSupabaseHistoryRepository();
const progressRepository = createSupabaseProgressRepository();

export function App() {
  return (
    <AuthProvider>
      <ExerciseRepositoryProvider repository={exerciseRepository}>
        <PlanningRepositoryProvider repository={planningRepository}>
          <WorkoutRepositoryProvider repository={workoutRepository}>
          <WorkoutSyncProvider>
          <HistoryRepositoryProvider repository={historyRepository}>
          <ProgressRepositoryProvider repository={progressRepository}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<TodayPage />} />
                <Route path="exercises" element={<ExerciseLibraryPage />} />
                <Route path="exercises/:exerciseId" element={<ExerciseEditorPage />} />
                <Route path="plans" element={<PlansPage />} />
                <Route path="plans/templates/:templateId" element={<TemplateEditorPage />} />
                <Route path="workout/active" element={<ActiveWorkoutPage />} />
                <Route path="workout/complete/:sessionId" element={<CompletionSummaryPage />} />
                <Route path="workout/complete" element={<CompletionSummaryPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="history/:sessionId" element={<HistoryDetailPage />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="progress/:exerciseId" element={<ExerciseProgressPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
          </ProgressRepositoryProvider>
          </HistoryRepositoryProvider>
          </WorkoutSyncProvider>
          </WorkoutRepositoryProvider>
        </PlanningRepositoryProvider>
      </ExerciseRepositoryProvider>
    </AuthProvider>
  );
}
