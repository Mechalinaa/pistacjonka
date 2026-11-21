import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ImportDialog } from './components/ImportExport'
import { Celebration, ConfirmDialog, Toasts } from './components/layout/Overlays'
import { Shell } from './components/layout/Shell'
import { TimerEngine } from './components/layout/TimerEngine'
import { TaskDetail } from './components/task/TaskDetail'
import { TaskFormModal } from './components/task/TaskForm'
import { BacklogPage } from './pages/Backlog'
import { BakeryPage } from './pages/Bakery'
import { CalendarPage } from './pages/Calendar'
import { KanbanPage } from './pages/Kanban'
import { SettingsPage } from './pages/Settings'
import { TimelinePage } from './pages/Timeline'
import { TodayPage } from './pages/Today'

// Statystyki (z biblioteką wykresów) ładowane dopiero po wejściu w widok.
const StatsPage = lazy(() => import('./pages/Stats').then((m) => ({ default: m.StatsPage })))

export default function App() {
  return (
    <HashRouter>
      <TimerEngine />
      <Shell>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/backlog" element={<BacklogPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/kalendarz" element={<CalendarPage />} />
          <Route path="/os-czasu" element={<TimelinePage />} />
          <Route path="/piekarnia" element={<BakeryPage />} />
          <Route
            path="/statystyki"
            element={
              <Suspense fallback={<p className="py-20 text-center text-sm text-ink-3">Wczytywanie statystyk…</p>}>
                <StatsPage />
              </Suspense>
            }
          />
          <Route path="/ustawienia" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <TaskDetail />
      <TaskFormModal />
      <ImportDialog />
      <ConfirmDialog />
      <Celebration />
      <Toasts />
    </HashRouter>
  )
}
