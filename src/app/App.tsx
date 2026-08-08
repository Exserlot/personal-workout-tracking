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

const exerciseRepository = createSupabaseExerciseRepository();

export function App() {
  return (
    <AuthProvider>
      <ExerciseRepositoryProvider repository={exerciseRepository}>
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
      </ExerciseRepositoryProvider>
    </AuthProvider>
  );
}
