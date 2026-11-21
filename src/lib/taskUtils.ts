import { daysBetween, todayISO } from './dates'
import type { PomodoroSession, Priority, Status, Task } from '../types'

export const PRIORITY_LABEL: Record<Priority, string> = { niski: 'Niski', sredni: 'Średni', wysoki: 'Wysoki' }
export const PRIORITY_WEIGHT: Record<Priority, number> = { niski: 1, sredni: 2, wysoki: 3 }
export const STATUS_LABEL: Record<Status, string> = { todo: 'Do zrobienia', in_progress: 'W trakcie', done: 'Zrobione' }
export const STATUS_SHORT: Record<Status, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

export const isDone = (t: Task) => t.status === 'done'

export const isOverdue = (t: Task, today = todayISO()) => !isDone(t) && !!t.deadline && t.deadline < today

/** Dni do deadline'u (ujemne = po terminie) lub null. */
export const daysLeft = (t: Task, today = todayISO()) => (t.deadline ? daysBetween(today, t.deadline) : null)

export function subtaskProgress(t: Task) {
  const total = t.subtasks.length
  const done = t.subtasks.filter((s) => s.done).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** Rzeczywisty czas pracy nad zadaniem: sesje timera + czas dopisany ręcznie (min). */
export function actualMinutes(t: Task, sessions: PomodoroSession[]): number {
  const ms = sessions.filter((s) => s.taskId === t.id).reduce((a, s) => a + s.focusMs, 0)
  return ms / 60000 + (t.manualMin || 0)
}

export const nextTaskId = (tasks: Task[]) => tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/**
 * „Osobisty współczynnik estymacji”: o ile realny czas różni się od szacowanego
 * na podstawie ukończonych zadań, które mają oba czasy. 1.0 = idealnie.
 */
export function estimationFactor(tasks: Task[], sessions: PomodoroSession[]): { factor: number; sample: number } {
  const pairs = tasks
    .filter((t) => isDone(t) && t.estimateMin && t.estimateMin > 0)
    .map((t) => ({ est: t.estimateMin as number, act: actualMinutes(t, sessions) }))
    .filter((p) => p.act >= 1)
  if (pairs.length < 2) return { factor: 1, sample: pairs.length }
  const est = pairs.reduce((a, p) => a + p.est, 0)
  const act = pairs.reduce((a, p) => a + p.act, 0)
  const f = Math.min(3, Math.max(0.4, act / est))
  return { factor: Math.round(f * 100) / 100, sample: pairs.length }
}

/** Domyślna paleta kolorów tagów – pastelowe, „cukiernicze”. */
export const TAG_COLORS = [
  '#9dbb6b', // pistacja
  '#d39b5f', // karmel
  '#c97c5d', // cynamon
  '#e3c26f', // masło
  '#b7a3cf', // lawenda
  '#e2a3a0', // malina
  '#86b5a5', // mięta
  '#a88c74', // kakao
]

export function pickTagColor(existingCount: number) {
  return TAG_COLORS[existingCount % TAG_COLORS.length]
}
