import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { BookProvider } from "@/components/BookProvider";
import { isOnboardingCompleted, ensureRecurringTasksForToday, isEnsureRunToday } from "@/domain/autoTask";
import Dashboard from "@/pages/Dashboard";
import TasksPage from "@/pages/TasksPage";
import CalendarPage from "@/pages/CalendarPage";
import LibraryPage from "@/pages/LibraryPage";
import EntryDetailPage from "@/pages/EntryDetailPage";
import MetricsPage from "@/pages/MetricsPage";
import JournalsPage from "@/pages/JournalsPage";
import ReviewsPage from "@/pages/ReviewsPage";
import SettingsPage from "@/pages/SettingsPage";
import Onboarding from "@/pages/Onboarding";

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
        <p className="text-sm text-ink-faint">正在启驾…</p>
      </div>
    </div>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    void (async () => {
      const done = await isOnboardingCompleted();
      setCompleted(done);
      setChecking(false);
      // 已完成引导则确保今日周期任务已生成（每天首次打开补一次）
      if (done && !(await isEnsureRunToday())) {
        await ensureRecurringTasksForToday();
      }
    })();

    // 引导页「确立纲领」完成后，立即切换到正常界面
    function onOnboardingDone() {
      setCompleted(true);
    }
    window.addEventListener("imperial:onboarding-done", onOnboardingDone);
    return () => window.removeEventListener("imperial:onboarding-done", onOnboardingDone);
  }, []);

  if (checking) return <Loading />;

  // 未完成引导：全屏显示引导页（无导航）
  if (!completed) {
    return (
      <BookProvider>
        <Onboarding />
      </BookProvider>
    );
  }

  return (
    <BookProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/entry/:entryId" element={<EntryDetailPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/journals" element={<JournalsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/onboarding" element={<Onboarding rerun />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BookProvider>
  );
}
