import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildContestFile, parseContestJson, serializeContestFile } from './contestJson'
import { IDLE_TIMER, elapsedMs, pause, remainingMs, resume, startWork } from './pomodoro'
import { parseQuickAdd } from './quickAdd'
import { suggestTasks } from './suggestions'
import { statsForDay } from './stats'
import type { PomodoroSession, Settings, Task } from '../types'

const sample = readFileSync(new URL('../../public/zadania-przyklad.json', import.meta.url), 'utf8')

const toTask = (c: ReturnType<typeof parseContestJson>['tasks'][number]): Task => ({
  id: c.id,
  title: c.tytul,
  description: c.opis,
  deadline: c.termin,
  plannedDate: null,
  priority: c.priorytet,
  status: c.wykonane ? 'done' : 'todo',
  tags: c.tagi,
  subtasks: [{ id: 'x', title: 'sub', done: true }],
  estimateMin: 30,
  manualMin: 5,
  createdAt: '2026-11-01T10:00:00.000Z',
  completedAt: null,
})

describe('format konkursowy JSON', () => {
  it('wczytuje przykładowy plik bez ostrzeżeń', () => {
    const r = parseContestJson(sample)
    expect(r.ok).toBe(true)
    expect(r.tasks).toHaveLength(20)
    expect(r.warnings).toEqual([])
  })

  it('import → eksport zwraca identyczne dane (round-trip)', () => {
    const r = parseContestJson(sample)
    const exported = JSON.parse(serializeContestFile(r.tasks.map(toTask)))
    expect(exported).toEqual(JSON.parse(sample))
  })

  it('eksport nie zawiera żadnych dodatkowych pól', () => {
    const r = parseContestJson(sample)
    const file = buildContestFile(r.tasks.map(toTask))
    expect(Object.keys(file)).toEqual(['wersja', 'zadania'])
    for (const z of file.zadania) {
      expect(Object.keys(z)).toEqual(['id', 'tytul', 'opis', 'termin', 'priorytet', 'wykonane', 'tagi'])
    }
  })

  it('obsługuje null, pusty opis, puste tagi', () => {
    const r = parseContestJson(
      JSON.stringify({ wersja: 1, zadania: [{ id: 7, tytul: 'A', opis: '', termin: null, priorytet: 'niski', wykonane: true, tagi: [] }] }),
    )
    expect(r.ok).toBe(true)
    expect(r.tasks[0]).toEqual({ id: 7, tytul: 'A', opis: '', termin: null, priorytet: 'niski', wykonane: true, tagi: [] })
  })

  it('pusta lista zadań jest poprawna', () => {
    const r = parseContestJson('{"wersja":1,"zadania":[]}')
    expect(r.ok).toBe(true)
    expect(r.tasks).toEqual([])
  })

  it('odrzuca niepoprawny JSON i złą strukturę', () => {
    expect(parseContestJson('{nie json').ok).toBe(false)
    expect(parseContestJson('[]').ok).toBe(false)
    expect(parseContestJson('{"wersja":1}').ok).toBe(false)
    expect(parseContestJson('{"wersja":1,"zadania":[{"opis":"bez tytułu"}]}').ok).toBe(false)
  })

  it('naprawia drobne błędy z ostrzeżeniem', () => {
    const r = parseContestJson(
      JSON.stringify({
        wersja: 1,
        zadania: [
          { id: 1, tytul: 'A', opis: null, termin: '2026-13-45', priorytet: 'Średni', wykonane: 'true', tagi: null },
          { id: 1, tytul: 'B', opis: '', termin: null, priorytet: 'mega', wykonane: false, tagi: ['x', 5] },
          { tytul: 'C' },
        ],
      }),
    )
    expect(r.ok).toBe(true)
    expect(r.tasks.map((t) => t.id)).toEqual([1, 2, 3])
    expect(r.tasks[0]).toMatchObject({ opis: '', termin: null, priorytet: 'sredni', wykonane: true, tagi: [] })
    expect(r.tasks[1]).toMatchObject({ priorytet: 'sredni', tagi: ['x'] })
    expect(r.warnings.length).toBeGreaterThan(0)
  })
})

const settings: Settings = {
  userName: '', workMin: 25, breakMin: 5, longBreakMin: 15, sessionsUntilLongBreak: 4,
  autoStartBreak: true, sound: false, dailyCapacityMin: 240, maxTasksPerDay: 6,
}
const base: Task = {
  id: 0, title: '', description: '', deadline: null, plannedDate: null, priority: 'sredni', status: 'todo',
  tags: [], subtasks: [], estimateMin: null, manualMin: 0, createdAt: '2026-11-20T10:00:00Z', completedAt: null,
}

describe('sugestie', () => {
  const today = '2026-11-21'
  it('premiuje zaległe i bliskie deadline’y, wyklucza wykonane i zaplanowane na dziś', () => {
    const tasks: Task[] = [
      { ...base, id: 1, title: 'po terminie', deadline: '2026-11-18', priority: 'niski' },
      { ...base, id: 2, title: 'jutro wysoki', deadline: '2026-11-22', priority: 'wysoki' },
      { ...base, id: 3, title: 'za miesiąc', deadline: '2026-12-21', priority: 'niski' },
      { ...base, id: 4, title: 'zrobione', deadline: '2026-11-21', status: 'done', priority: 'wysoki' },
      { ...base, id: 5, title: 'już w planie', deadline: '2026-11-21', plannedDate: today, priority: 'wysoki' },
    ]
    const { suggestions } = suggestTasks(tasks, settings, { today, limit: 10 })
    const ids = suggestions.map((s) => s.task.id)
    expect(ids[0]).toBe(1)
    expect(ids[1]).toBe(2)
    expect(ids).not.toContain(4)
    expect(ids).not.toContain(5)
    expect(suggestions[0].reasons[0].label).toMatch(/Po terminie/)
  })

  it('karze zadania, które nie zmieszczą się w dzisiejszej pojemności', () => {
    const tasks: Task[] = [
      { ...base, id: 1, plannedDate: today, estimateMin: 200 },
      { ...base, id: 2, estimateMin: 120, priority: 'wysoki' },
      { ...base, id: 3, estimateMin: 20, priority: 'wysoki' },
    ]
    const { suggestions } = suggestTasks(tasks, settings, { today, limit: 10 })
    expect(suggestions[0].task.id).toBe(3)
  })
})

describe('timer Pomodoro (timestampy)', () => {
  it('liczy czas z timestampów i poprawnie pauzuje', () => {
    let t = startWork(IDLE_TIMER, 1, settings, 1_000)
    expect(remainingMs(t, 1_000)).toBe(25 * 60000)
    expect(elapsedMs(t, 61_000)).toBe(60_000)
    t = pause(t, 61_000)
    // podczas pauzy czas stoi – nawet po „odświeżeniu” godzinę później
    expect(elapsedMs(t, 3_661_000)).toBe(60_000)
    t = resume(t, 3_661_000)
    expect(elapsedMs(t, 3_721_000)).toBe(120_000)
  })
})

describe('statystyki dnia', () => {
  it('pistacjonki tylko za ukończone sesje', () => {
    const s = (completed: boolean): PomodoroSession => ({
      id: Math.random().toString(), taskId: 1, taskTitle: 'x', startedAt: '2026-11-21T09:00:00',
      endedAt: '2026-11-21T09:25:00', focusMs: completed ? 1_500_000 : 600_000, plannedMs: 1_500_000, completed,
    })
    const st = statsForDay('2026-11-21', [], [s(true), s(false), s(true)])
    expect(st.pistachios).toBe(2)
    expect(st.sessions).toBe(3)
    expect(Math.round(st.focusMin)).toBe(60)
  })
})

describe('szybkie dodawanie', () => {
  it('rozpoznaje tagi, priorytet, termin i czas', () => {
    const r = parseQuickAdd('Kolokwium z sieci #studia !wysoki @jutro ~1.5h', new Date(2026, 10, 21))
    expect(r).toEqual({ title: 'Kolokwium z sieci', tags: ['studia'], priority: 'wysoki', deadline: '2026-11-22', estimateMin: 90 })
    expect(parseQuickAdd('Raport @25.11 !!', new Date(2026, 10, 21))).toMatchObject({ deadline: '2026-11-25', priority: 'sredni' })
  })
})
