/**
 * „Smart” sugestie zadań na dziś – przejrzysty algorytm punktowy.
 *
 * Każda reguła dodaje (lub odejmuje) punkty i zostawia czytelny powód,
 * który pokazujemy użytkownikowi. Nic nie jest losowe i nic nie jest
 * planowane automatycznie – użytkownik sam akceptuje sugestię.
 */
import { daysBetween, formatMinutes, todayISO } from './dates'
import { isDone, subtaskProgress } from './taskUtils'
import type { ISODate, Settings, Task } from '../types'

export interface Reason {
  label: string
  points: number
}

export interface Suggestion {
  task: Task
  score: number
  reasons: Reason[]
}

export interface DayLoad {
  count: number
  estimateMin: number
  /** Oszacowanie skorygowane osobistym współczynnikiem estymacji. */
  realisticMin: number
}

/** Obciążenie dnia: zadania zaplanowane na ten dzień (niewykonane). */
export function dayLoad(tasks: Task[], day: ISODate, factor = 1): DayLoad {
  const planned = tasks.filter((t) => t.plannedDate === day && !isDone(t))
  const est = planned.reduce((a, t) => a + (t.estimateMin ?? 0), 0)
  return { count: planned.length, estimateMin: est, realisticMin: Math.round(est * factor) }
}

export const WEIGHTS = {
  overdueBase: 50,
  overduePerDay: 4,
  overdueCap: 30,
  dueToday: 40,
  dueTomorrow: 30,
  dueIn3: 20,
  dueIn7: 10,
  priority: { wysoki: 25, sredni: 12, niski: 4 },
  inProgress: 15,
  slippedPlan: 15,
  plannedLater: -15,
  quickWin: 8,
  bigAndClose: 12,
  doesNotFit: -20,
  partlyDone: 6,
  waitingLong: 5,
}

export function scoreTask(
  t: Task,
  ctx: { today: ISODate; remainingCapacityMin: number; factor: number },
): Suggestion | null {
  // Wykluczenia: zrobione i te już zaplanowane na dziś (są w planie).
  if (isDone(t) || t.plannedDate === ctx.today) return null
  const reasons: Reason[] = []
  const add = (label: string, points: number) => reasons.push({ label, points })

  const dl = t.deadline ? daysBetween(ctx.today, t.deadline) : null
  if (dl !== null) {
    if (dl < 0) {
      const extra = Math.min(WEIGHTS.overdueCap, -dl * WEIGHTS.overduePerDay)
      add(`Po terminie od ${-dl} ${-dl === 1 ? 'dnia' : 'dni'}`, WEIGHTS.overdueBase + extra)
    } else if (dl === 0) add('Deadline dziś', WEIGHTS.dueToday)
    else if (dl === 1) add('Deadline jutro', WEIGHTS.dueTomorrow)
    else if (dl <= 3) add(`Deadline za ${dl} dni`, WEIGHTS.dueIn3)
    else if (dl <= 7) add(`Deadline w tym tygodniu (${dl} dni)`, WEIGHTS.dueIn7)
  }

  add(
    t.priority === 'wysoki' ? 'Wysoki priorytet' : t.priority === 'sredni' ? 'Średni priorytet' : 'Niski priorytet',
    WEIGHTS.priority[t.priority],
  )

  if (t.status === 'in_progress') add('Już rozpoczęte – warto dokończyć', WEIGHTS.inProgress)

  if (t.plannedDate && t.plannedDate < ctx.today) add('Przeniesione z wcześniejszego planu', WEIGHTS.slippedPlan)
  if (t.plannedDate && t.plannedDate > ctx.today) add('Zaplanowane na później', WEIGHTS.plannedLater)

  const sp = subtaskProgress(t)
  if (sp.total > 0 && sp.done > 0) add(`Masz już ${sp.done}/${sp.total} podzadań`, WEIGHTS.partlyDone)

  if (t.estimateMin) {
    const realistic = Math.round(t.estimateMin * ctx.factor)
    if (realistic <= 30) add(`Szybkie – ok. ${formatMinutes(realistic)}`, WEIGHTS.quickWin)
    // Duże zadanie z bliskim terminem: lepiej zacząć dziś niż w ostatniej chwili.
    if (realistic >= 120 && dl !== null && dl >= 0 && dl <= 5)
      add('Duże zadanie z bliskim terminem – zacznij wcześniej', WEIGHTS.bigAndClose)
    if (realistic > ctx.remainingCapacityMin)
      add(
        ctx.remainingCapacityMin <= 0
          ? 'Dzisiejszy plan jest już pełny'
          : `Może się nie zmieścić (zostało ${formatMinutes(ctx.remainingCapacityMin)})`,
        WEIGHTS.doesNotFit,
      )
  }

  if (!t.deadline && !t.plannedDate) {
    const age = daysBetween(t.createdAt.slice(0, 10), ctx.today)
    if (age >= 14) add(`Czeka w backlogu od ${age} dni`, WEIGHTS.waitingLong)
  }

  const score = reasons.reduce((a, r) => a + r.points, 0)
  return { task: t, score, reasons: reasons.sort((a, b) => b.points - a.points) }
}

export function suggestTasks(
  tasks: Task[],
  settings: Pick<Settings, 'dailyCapacityMin' | 'maxTasksPerDay'>,
  opts: { today?: ISODate; factor?: number; dismissed?: number[]; limit?: number } = {},
): { suggestions: Suggestion[]; load: DayLoad; planFull: boolean } {
  const today = opts.today ?? todayISO()
  const factor = opts.factor ?? 1
  const load = dayLoad(tasks, today, factor)
  const remainingCapacityMin = settings.dailyCapacityMin - load.realisticMin
  const planFull = load.count >= settings.maxTasksPerDay || remainingCapacityMin <= 0
  const dismissed = new Set(opts.dismissed ?? [])

  const suggestions = tasks
    .filter((t) => !dismissed.has(t.id))
    .map((t) => scoreTask(t, { today, remainingCapacityMin, factor }))
    .filter((s): s is Suggestion => !!s && s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.task.deadline ?? '9999').localeCompare(b.task.deadline ?? '9999') ||
        a.task.id - b.task.id,
    )

  // Im pełniejszy dzień, tym mniej propozycji – nie dokładamy na siłę.
  const free = Math.max(0, settings.maxTasksPerDay - load.count)
  const limit = opts.limit ?? Math.max(planFull ? 1 : 2, Math.min(5, free))
  return { suggestions: suggestions.slice(0, limit), load, planFull }
}
