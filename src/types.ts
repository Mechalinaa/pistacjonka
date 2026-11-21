/** Priorytety – wartości identyczne jak w konkursowym formacie JSON. */
export type Priority = 'niski' | 'sredni' | 'wysoki'

/** Statusy wewnętrzne. W formacie konkursowym zapisywane jako `wykonane: boolean`. */
export type Status = 'todo' | 'in_progress' | 'done'

/** Data w formacie YYYY-MM-DD (bez strefy czasowej – dzień kalendarzowy). */
export type ISODate = string

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  /** Liczbowe id – zgodne z polem `id` w pliku konkursowym. */
  id: number
  title: string
  description: string
  /** Deadline (pole `termin` w JSON). */
  deadline: ISODate | null
  /** Planowana data realizacji – osobna informacja niż deadline. */
  plannedDate: ISODate | null
  priority: Priority
  status: Status
  /** Nazwy tagów (jak w JSON: `tagi`). Kolory trzymamy w słowniku tagów. */
  tags: string[]
  subtasks: Subtask[]
  /** Szacowany czas w minutach. */
  estimateMin: number | null
  /** Czas zalogowany ręcznie (poza timerem), w minutach. */
  manualMin: number
  createdAt: string
  completedAt: string | null
}

export interface Tag {
  name: string
  color: string
}

export interface PomodoroSession {
  id: string
  taskId: number | null
  /** Tytuł zadania w chwili sesji – zostaje w historii nawet po usunięciu zadania. */
  taskTitle: string | null
  startedAt: string
  endedAt: string
  /** Faktycznie przepracowany czas (bez pauz), ms. */
  focusMs: number
  plannedMs: number
  /** true = pełna sesja → 1 upieczona pistacjonka. */
  completed: boolean
}

export type TimerPhase = 'idle' | 'work' | 'break'

/**
 * Stan timera odporny na odświeżenie strony: nie trzymamy „pozostałych sekund”,
 * tylko znacznik czasu startu bieżącego odcinka + czas zebrany przed pauzami.
 */
export interface TimerState {
  phase: TimerPhase
  taskId: number | null
  durationMs: number
  /** Timestamp (ms) wznowienia bieżącego odcinka; null = pauza. */
  runningSince: number | null
  /** Czas upłynięty przed ostatnim wznowieniem (suma odcinków). */
  accumulatedMs: number
  /** Timestamp pierwszego startu fazy pracy. */
  phaseStartedAt: number | null
  /** Licznik pełnych sesji w bieżącym cyklu (do długiej przerwy). */
  cycleCount: number
  longBreak: boolean
}

export interface Settings {
  userName: string
  workMin: number
  breakMin: number
  longBreakMin: number
  sessionsUntilLongBreak: number
  autoStartBreak: boolean
  sound: boolean
  /** Ile minut pracy dziennie student realnie planuje (pojemność dnia). */
  dailyCapacityMin: number
  /** Ile zadań maksymalnie na dzień w planie. */
  maxTasksPerDay: number
}

export interface AppData {
  tasks: Task[]
  tags: Tag[]
  sessions: PomodoroSession[]
  settings: Settings
}
