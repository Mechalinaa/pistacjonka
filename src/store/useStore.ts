import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { todayISO } from '../lib/dates'
import type { ContestTask } from '../lib/contestJson'
import { IDLE_TIMER, elapsedMs, pause, phaseEndAt, resume, startBreak, startWork } from '../lib/pomodoro'
import { nextTaskId, pickTagColor, uid } from '../lib/taskUtils'
import type { AppData, ISODate, PomodoroSession, Settings, Status, Tag, Task, TimerState } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  workMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreak: true,
  sound: true,
  dailyCapacityMin: 240,
  maxTasksPerDay: 6,
}

export const DEFAULT_TAGS: Tag[] = [
  { name: 'studia', color: '#9dbb6b' },
  { name: 'projekt', color: '#d39b5f' },
  { name: 'kolokwium', color: '#c97c5d' },
  { name: 'praca', color: '#a88c74' },
  { name: 'prywatne', color: '#b7a3cf' },
  { name: 'pilne', color: '#e2a3a0' },
]

/** Minimalny czas pracy, by zapisać przerwaną sesję w historii (bez pistacjonki). */
const MIN_PARTIAL_MS = 60_000

export interface TaskInput {
  title: string
  description?: string
  deadline?: ISODate | null
  plannedDate?: ISODate | null
  priority?: Task['priority']
  status?: Status
  tags?: string[]
  estimateMin?: number | null
}

export type ImportMode = 'replace' | 'merge'

interface State extends AppData {
  timer: TimerState
  dismissed: { day: ISODate; ids: number[] }
  /** Nietrwałe: sygnał do animacji „upieczono!”. */
  celebrate: { at: number; taskTitle: string | null } | null

  addTask: (input: TaskInput) => number
  updateTask: (id: number, patch: Partial<Task>) => void
  deleteTask: (id: number) => void
  setStatus: (id: number, status: Status) => void
  toggleDone: (id: number) => void
  planTask: (id: number, day: ISODate | null) => void

  addSubtask: (taskId: number, title: string) => void
  toggleSubtask: (taskId: number, subId: string) => void
  renameSubtask: (taskId: number, subId: string, title: string) => void
  deleteSubtask: (taskId: number, subId: string) => void

  addTag: (name: string, color?: string) => string | null
  updateTagColor: (name: string, color: string) => void
  renameTag: (oldName: string, newName: string) => boolean
  deleteTag: (name: string) => void
  toggleTaskTag: (taskId: number, tag: string) => void

  importContest: (tasks: ContestTask[], mode: ImportMode) => { added: number; updated: number; skipped: number }
  importBackup: (data: AppData) => void
  resetAll: () => void
  updateSettings: (patch: Partial<Settings>) => void
  dismissSuggestion: (id: number) => void

  timerStart: (taskId: number | null) => void
  timerPause: () => void
  timerResume: () => void
  /** Przerwanie pracy: zapisuje przepracowany czas, ale BEZ pistacjonki. */
  timerStop: () => void
  timerSkipBreak: () => void
  /** Wywoływane cyklicznie i po załadowaniu – domyka fazy, które minęły. */
  timerTick: (now?: number) => 'work-complete' | 'break-complete' | null
  clearCelebrate: () => void
}

function ensureTagList(tags: Tag[], names: string[]): Tag[] {
  const out = [...tags]
  for (const n of names) {
    if (!out.some((t) => t.name.toLowerCase() === n.toLowerCase())) out.push({ name: n, color: pickTagColor(out.length) })
  }
  return out
}

/** Zachowuje istniejącą pisownię tagu (np. „Studia” vs „studia”). */
function canonicalTags(tags: Tag[], names: string[]): string[] {
  const out: string[] = []
  for (const n of names) {
    const found = tags.find((t) => t.name.toLowerCase() === n.toLowerCase())?.name ?? n
    if (!out.includes(found)) out.push(found)
  }
  return out
}

const statusPatch = (t: Task, status: Status): Partial<Task> => ({
  status,
  completedAt: status === 'done' ? (t.status === 'done' && t.completedAt ? t.completedAt : new Date().toISOString()) : null,
})

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patchTask = (id: number, fn: (t: Task) => Partial<Task>) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)) }))

      const recordSession = (completed: boolean, endAt: number, focusMs: number) => {
        const { timer, tasks } = get()
        const task = tasks.find((t) => t.id === timer.taskId)
        const session: PomodoroSession = {
          id: uid(),
          taskId: timer.taskId,
          taskTitle: task?.title ?? null,
          startedAt: new Date(timer.phaseStartedAt ?? endAt - focusMs).toISOString(),
          endedAt: new Date(endAt).toISOString(),
          focusMs: Math.round(focusMs),
          plannedMs: timer.durationMs,
          completed,
        }
        set((s) => ({ sessions: [...s.sessions, session] }))
      }

      return {
        tasks: [],
        tags: DEFAULT_TAGS,
        sessions: [],
        settings: DEFAULT_SETTINGS,
        timer: IDLE_TIMER,
        dismissed: { day: '', ids: [] },
        celebrate: null,

        addTask: (input) => {
          const id = nextTaskId(get().tasks)
          const tags = canonicalTags(get().tags, input.tags ?? [])
          const status = input.status ?? 'todo'
          const task: Task = {
            id,
            title: input.title.trim(),
            description: input.description ?? '',
            deadline: input.deadline ?? null,
            plannedDate: input.plannedDate ?? null,
            priority: input.priority ?? 'sredni',
            status,
            tags,
            subtasks: [],
            estimateMin: input.estimateMin ?? null,
            manualMin: 0,
            createdAt: new Date().toISOString(),
            completedAt: status === 'done' ? new Date().toISOString() : null,
          }
          set((s) => ({ tasks: [...s.tasks, task], tags: ensureTagList(s.tags, tags) }))
          return id
        },

        updateTask: (id, patch) => {
          if (patch.tags) {
            const tags = canonicalTags(get().tags, patch.tags)
            patch = { ...patch, tags }
            set((s) => ({ tags: ensureTagList(s.tags, tags) }))
          }
          patchTask(id, (t) => (patch.status && patch.status !== t.status ? { ...patch, ...statusPatch(t, patch.status) } : patch))
        },

        deleteTask: (id) =>
          set((s) => ({
            tasks: s.tasks.filter((t) => t.id !== id),
            // Sesje zostają w statystykach (z zapamiętanym tytułem), tracą tylko powiązanie.
            sessions: s.sessions.map((x) => (x.taskId === id ? { ...x, taskId: null } : x)),
            timer: s.timer.taskId === id ? { ...s.timer, taskId: null } : s.timer,
          })),

        setStatus: (id, status) => patchTask(id, (t) => statusPatch(t, status)),
        toggleDone: (id) => patchTask(id, (t) => statusPatch(t, t.status === 'done' ? 'todo' : 'done')),
        planTask: (id, day) => patchTask(id, () => ({ plannedDate: day })),

        addSubtask: (taskId, title) =>
          title.trim() &&
          patchTask(taskId, (t) => ({ subtasks: [...t.subtasks, { id: uid(), title: title.trim(), done: false }] })),
        toggleSubtask: (taskId, subId) =>
          patchTask(taskId, (t) => ({ subtasks: t.subtasks.map((x) => (x.id === subId ? { ...x, done: !x.done } : x)) })),
        renameSubtask: (taskId, subId, title) =>
          patchTask(taskId, (t) => ({ subtasks: t.subtasks.map((x) => (x.id === subId ? { ...x, title } : x)) })),
        deleteSubtask: (taskId, subId) =>
          patchTask(taskId, (t) => ({ subtasks: t.subtasks.filter((x) => x.id !== subId) })),

        addTag: (name, color) => {
          const n = name.trim().replace(/^#/, '').replace(/\s+/g, '-')
          if (!n) return null
          const existing = get().tags.find((t) => t.name.toLowerCase() === n.toLowerCase())
          if (existing) return existing.name
          set((s) => ({ tags: [...s.tags, { name: n, color: color ?? pickTagColor(s.tags.length) }] }))
          return n
        },
        updateTagColor: (name, color) => set((s) => ({ tags: s.tags.map((t) => (t.name === name ? { ...t, color } : t)) })),
        renameTag: (oldName, newName) => {
          const n = newName.trim().replace(/^#/, '').replace(/\s+/g, '-')
          if (!n || get().tags.some((t) => t.name.toLowerCase() === n.toLowerCase() && t.name !== oldName)) return false
          set((s) => ({
            tags: s.tags.map((t) => (t.name === oldName ? { ...t, name: n } : t)),
            tasks: s.tasks.map((t) => ({ ...t, tags: t.tags.map((x) => (x === oldName ? n : x)) })),
          }))
          return true
        },
        deleteTag: (name) =>
          set((s) => ({
            tags: s.tags.filter((t) => t.name !== name),
            tasks: s.tasks.map((t) => ({ ...t, tags: t.tags.filter((x) => x !== name) })),
          })),
        toggleTaskTag: (taskId, tag) =>
          patchTask(taskId, (t) => ({ tags: t.tags.includes(tag) ? t.tags.filter((x) => x !== tag) : [...t.tags, tag] })),

        importContest: (incoming, mode) => {
          const now = new Date().toISOString()
          const s = get()
          let tags = ensureTagList(s.tags, incoming.flatMap((t) => t.tagi))
          const fromContest = (c: ContestTask, id: number, base?: Task): Task => {
            const wasDone = base?.status === 'done'
            const status: Status = c.wykonane ? 'done' : base && base.status === 'in_progress' ? 'in_progress' : 'todo'
            return {
              // Dane rozszerzone zostają, jeśli to „to samo” zadanie (to samo id i tytuł).
              subtasks: base?.subtasks ?? [],
              plannedDate: base?.plannedDate ?? null,
              estimateMin: base?.estimateMin ?? null,
              manualMin: base?.manualMin ?? 0,
              createdAt: base?.createdAt ?? now,
              id,
              title: c.tytul,
              description: c.opis,
              deadline: c.termin,
              priority: c.priorytet,
              status,
              tags: canonicalTags(tags, c.tagi),
              // Data wykonania z pliku jest nieznana – nie „dopisujemy” jej do dzisiejszych statystyk.
              completedAt: c.wykonane && wasDone ? (base?.completedAt ?? null) : null,
            }
          }

          if (mode === 'replace') {
            const byId = new Map(s.tasks.map((t) => [t.id, t]))
            let updated = 0
            const tasks = incoming.map((c) => {
              const base = byId.get(c.id)
              const same = base && base.title.trim().toLowerCase() === c.tytul.trim().toLowerCase()
              if (same) updated++
              return fromContest(c, c.id, same ? base : undefined)
            })
            const ids = new Set(tasks.map((t) => t.id))
            set({
              tasks,
              tags,
              sessions: s.sessions.map((x) => (x.taskId !== null && !ids.has(x.taskId) ? { ...x, taskId: null } : x)),
              timer: s.timer.taskId !== null && !ids.has(s.timer.taskId) ? { ...s.timer, taskId: null } : s.timer,
            })
            return { added: tasks.length - updated, updated, skipped: 0 }
          }

          // merge: pomijamy identyczne zadania, konflikty id → nowe id
          const tasks = [...s.tasks]
          const used = new Set(tasks.map((t) => t.id))
          let next = Math.max(0, ...used) + 1
          let added = 0
          let skipped = 0
          for (const c of incoming) {
            const dup = tasks.some(
              (t) => t.title.trim().toLowerCase() === c.tytul.trim().toLowerCase() && t.deadline === c.termin,
            )
            if (dup) {
              skipped++
              continue
            }
            let id = c.id
            if (used.has(id)) {
              while (used.has(next)) next++
              id = next
            }
            used.add(id)
            tasks.push(fromContest(c, id))
            added++
          }
          tags = ensureTagList(tags, [])
          set({ tasks, tags })
          return { added, updated: 0, skipped }
        },

        importBackup: (data) =>
          set({
            tasks: data.tasks,
            tags: data.tags,
            sessions: data.sessions,
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
            timer: IDLE_TIMER,
          }),

        resetAll: () =>
          set({
            tasks: [],
            tags: DEFAULT_TAGS,
            sessions: [],
            settings: DEFAULT_SETTINGS,
            timer: IDLE_TIMER,
            dismissed: { day: '', ids: [] },
          }),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        dismissSuggestion: (id) =>
          set((s) => {
            const day = todayISO()
            const ids = s.dismissed.day === day ? s.dismissed.ids : []
            return { dismissed: { day, ids: [...ids, id] } }
          }),

        timerStart: (taskId) => {
          const s = get()
          // Jeśli trwała praca – zapisz ją jako przerwaną, zanim zaczniemy nową.
          if (s.timer.phase === 'work') get().timerStop()
          const task = s.tasks.find((t) => t.id === taskId)
          if (task && task.status === 'todo') get().setStatus(task.id, 'in_progress')
          set((st) => ({ timer: startWork(st.timer, taskId, st.settings) }))
        },
        timerPause: () => set((s) => ({ timer: pause(s.timer) })),
        timerResume: () => set((s) => ({ timer: resume(s.timer) })),
        timerStop: () => {
          const { timer } = get()
          if (timer.phase === 'work') {
            const now = Date.now()
            const focus = Math.min(elapsedMs(timer, now), timer.durationMs)
            if (focus >= MIN_PARTIAL_MS) recordSession(false, now, focus)
          }
          set((s) => ({ timer: { ...IDLE_TIMER, taskId: s.timer.taskId, cycleCount: s.timer.cycleCount } }))
        },
        timerSkipBreak: () =>
          set((s) => ({ timer: { ...IDLE_TIMER, taskId: s.timer.taskId, cycleCount: s.timer.cycleCount } })),

        timerTick: (now = Date.now()) => {
          const { timer, settings, tasks } = get()
          if (timer.phase === 'idle' || timer.runningSince === null) return null
          if (elapsedMs(timer, now) < timer.durationMs) return null
          const endAt = phaseEndAt(timer) ?? now
          if (timer.phase === 'work') {
            recordSession(true, endAt, timer.durationMs)
            const task = tasks.find((t) => t.id === timer.taskId)
            set((s) => ({
              timer: startBreak(s.timer, settings, endAt, settings.autoStartBreak),
              celebrate: { at: endAt, taskTitle: task?.title ?? null },
            }))
            // Przerwa mogła też już minąć (np. karta zamknięta przez godzinę).
            get().timerTick(now)
            return 'work-complete'
          }
          set((s) => ({ timer: { ...IDLE_TIMER, taskId: s.timer.taskId, cycleCount: s.timer.cycleCount } }))
          return 'break-complete'
        },
        clearCelebrate: () => set({ celebrate: null }),
      }
    },
    {
      name: 'pistacjonka-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        tasks: s.tasks,
        tags: s.tags,
        sessions: s.sessions,
        settings: s.settings,
        timer: s.timer,
        dismissed: s.dismissed,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } }
      },
    },
  ),
)

/** Wspólne selektory. */
export const useTask = (id: number | null) => useStore((s) => (id === null ? undefined : s.tasks.find((t) => t.id === id)))
export const useTagColor = () => {
  const tags = useStore((s) => s.tags)
  return (name: string) => tags.find((t) => t.name === name)?.color ?? '#c9b9a3'
}
