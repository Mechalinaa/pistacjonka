/** Statystyki liczone wyłącznie z rzeczywistych danych (zadania + sesje). */
import { addDaysISO, dayOf, todayISO } from './dates'
import { isDone } from './taskUtils'
import type { ISODate, PomodoroSession, Task } from '../types'

export interface DayStats {
  day: ISODate
  focusMin: number
  sessions: number
  /** Pełne sesje = upieczone pistacjonki. */
  pistachios: number
  tasksDone: Task[]
  /** Zaplanowane na ten dzień lub z deadlinem tego dnia, wciąż niewykonane. */
  remaining: Task[]
  sessionList: PomodoroSession[]
}

export function statsForDay(day: ISODate, tasks: Task[], sessions: PomodoroSession[]): DayStats {
  const sessionList = sessions.filter((s) => dayOf(s.endedAt) === day)
  const completed = sessionList.filter((s) => s.completed)
  return {
    day,
    focusMin: sessionList.reduce((a, s) => a + s.focusMs, 0) / 60000,
    sessions: sessionList.length,
    pistachios: completed.length,
    tasksDone: tasks.filter((t) => t.completedAt && dayOf(t.completedAt) === day),
    remaining: tasks.filter((t) => !isDone(t) && (t.plannedDate === day || t.deadline === day)),
    sessionList: sessionList.sort((a, b) => a.endedAt.localeCompare(b.endedAt)),
  }
}

export interface SeriesPoint {
  day: ISODate
  focusMin: number
  tasksDone: number
  pistachios: number
}

/** Szereg dzienny dla ostatnich `n` dni (włącznie z dzisiaj). */
export function dailySeries(n: number, tasks: Task[], sessions: PomodoroSession[], today = todayISO()): SeriesPoint[] {
  const start = addDaysISO(today, -(n - 1))
  const map = new Map<ISODate, SeriesPoint>()
  for (let i = 0; i < n; i++) {
    const d = addDaysISO(start, i)
    map.set(d, { day: d, focusMin: 0, tasksDone: 0, pistachios: 0 })
  }
  for (const s of sessions) {
    const p = map.get(dayOf(s.endedAt))
    if (!p) continue
    p.focusMin += s.focusMs / 60000
    if (s.completed) p.pistachios++
  }
  for (const t of tasks) {
    if (!t.completedAt) continue
    const p = map.get(dayOf(t.completedAt))
    if (p) p.tasksDone++
  }
  return [...map.values()].map((p) => ({ ...p, focusMin: Math.round(p.focusMin) }))
}

export function totals(tasks: Task[], sessions: PomodoroSession[]) {
  return {
    focusMin: sessions.reduce((a, s) => a + s.focusMs, 0) / 60000,
    manualMin: tasks.reduce((a, t) => a + (t.manualMin || 0), 0),
    tasksDone: tasks.filter(isDone).length,
    pistachios: sessions.filter((s) => s.completed).length,
    sessions: sessions.length,
    byStatus: {
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    },
  }
}

/** Seria dni z rzędu z co najmniej jedną upieczoną pistacjonką (kończąca się dziś lub wczoraj). */
export function bakingStreak(sessions: PomodoroSession[], today = todayISO()): number {
  const days = new Set(sessions.filter((s) => s.completed).map((s) => dayOf(s.endedAt)))
  let d = days.has(today) ? today : addDaysISO(today, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}
