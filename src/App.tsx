import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { BookProvider } from "@/components/BookProvider";
import Dashboard from "@/pages/Dashboard";
import TasksPage from "@/pages/TasksPage";
import CalendarPage from "@/pages/CalendarPage";
import LibraryPage from "@/pages/LibraryPage";
import EntryDetailPage from "@/pages/EntryDetailPage";
import MetricsPage from "@/pages/MetricsPage";
import JournalsPage from "@/pages/JournalsPage";
import ReviewsPage from "@/pages/ReviewsPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BookProvider>
  );
}
