import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PwaUpdatePrompt } from "../components/layout/PwaUpdatePrompt";
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

const LoginPage = lazy(() => import("../pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const TodayPage = lazy(() => import("../pages/TodayPage").then((module) => ({ default: module.TodayPage })));
const ExerciseLibraryPage = lazy(() => import("../pages/ExercisePages").then((module) => ({ default: module.ExerciseLibraryPage })));
const ExerciseEditorPage = lazy(() => import("../pages/ExercisePages").then((module) => ({ default: module.ExerciseEditorPage })));
const PlansPage = lazy(() => import("../pages/PlanningPages").then((module) => ({ default: module.PlansPage })));
const TemplateEditorPage = lazy(() => import("../pages/PlanningPages").then((module) => ({ default: module.TemplateEditorPage })));
const ActiveWorkoutPage = lazy(() => import("../pages/WorkoutPages").then((module) => ({ default: module.ActiveWorkoutPage })));
const CompletionSummaryPage = lazy(() => import("../pages/WorkoutPages").then((module) => ({ default: module.CompletionSummaryPage })));
const HistoryPage = lazy(() => import("../pages/HistoryPages").then((module) => ({ default: module.HistoryPage })));
const HistoryDetailPage = lazy(() => import("../pages/HistoryPages").then((module) => ({ default: module.HistoryDetailPage })));
const ProgressPage = lazy(() => import("../pages/ProgressPages").then((module) => ({ default: module.ProgressPage })));
const ExerciseProgressPage = lazy(() => import("../pages/ProgressPages").then((module) => ({ default: module.ExerciseProgressPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

const exerciseRepository = createSupabaseExerciseRepository();
const planningRepository = createSupabasePlanningRepository();
const workoutRepository = createSupabaseWorkoutRepository();
const historyRepository = createSupabaseHistoryRepository();
const progressRepository = createSupabaseProgressRepository();

function RouteLoading() {
  return (
    <div className="mx-auto w-full max-w-content px-4 py-10 tablet:px-6 desktop:px-8" role="status" aria-live="polite">
      <div className="border-y border-line py-8">
        <p className="text-xs font-semibold tracking-[0.08em] text-accent">FORM</p>
        <p className="mt-3 text-lg font-semibold">กำลังเปิดหน้า…</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ExerciseRepositoryProvider repository={exerciseRepository}>
        <PlanningRepositoryProvider repository={planningRepository}>
          <WorkoutRepositoryProvider repository={workoutRepository}>
          <WorkoutSyncProvider>
          <HistoryRepositoryProvider repository={historyRepository}>
          <ProgressRepositoryProvider repository={progressRepository}>
          <Suspense fallback={<RouteLoading />}>
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
          </Suspense>
          <PwaUpdatePrompt />
          </ProgressRepositoryProvider>
          </HistoryRepositoryProvider>
          </WorkoutSyncProvider>
          </WorkoutRepositoryProvider>
        </PlanningRepositoryProvider>
      </ExerciseRepositoryProvider>
    </AuthProvider>
  );
}
