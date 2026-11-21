/**
 * Import / eksport w OFICJALNYM formacie konkursowym:
 *
 * { "wersja": 1, "zadania": [ { id, tytul, opis, termin, priorytet, wykonane, tagi } ] }
 *
 * Eksport zawiera wyłącznie te pola – żadnych dodatkowych. Dane rozszerzone
 * (podzadania, planowane daty, sesje Pomodoro…) żyją osobno w localStorage
 * i w osobnej „pełnej kopii zapasowej”.
 */
import { isValidISODate } from './dates'
import type { Priority, Task } from '../types'

export interface ContestTask {
  id: number
  tytul: string
  opis: string
  termin: string | null
  priorytet: Priority
  wykonane: boolean
  tagi: string[]
}

export interface ContestFile {
  wersja: number
  zadania: ContestTask[]
}

export interface ParseResult {
  ok: boolean
  tasks: ContestTask[]
  /** Błędy krytyczne – plik nie został wczytany. */
  errors: string[]
  /** Problemy naprawione automatycznie (np. nieznany priorytet). */
  warnings: string[]
  /** Liczba pominiętych (nienaprawialnych) wpisów. */
  skipped: number
}

const PRIORITIES: Priority[] = ['niski', 'sredni', 'wysoki']

/** „Średni”, „SREDNI ”, „sredni” → „sredni”. */
export function normalizePriority(v: unknown): Priority | null {
  if (typeof v !== 'string') return null
  const s = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
  return (PRIORITIES as string[]).includes(s) ? (s as Priority) : null
}

function normalizeBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === 1 || v === 'true' || v === '1') return true
  if (v === 0 || v === 'false' || v === '0') return false
  return null
}

function normalizeTags(v: unknown): string[] | null {
  if (v === undefined || v === null) return []
  if (typeof v === 'string') v = v.split(',')
  if (!Array.isArray(v)) return null
  const out: string[] = []
  for (const t of v) {
    if (typeof t !== 'string') continue
    const name = t.trim()
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** Parsuje tekst pliku. Nigdy nie rzuca – zwraca listę błędów i ostrzeżeń. */
export function parseContestJson(text: string): ParseResult {
  const res: ParseResult = { ok: false, tasks: [], errors: [], warnings: [], skipped: 0 }
  let root: unknown
  try {
    root = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    res.errors.push(`To nie jest poprawny JSON (${(e as Error).message}).`)
    return res
  }
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    res.errors.push('Główny element pliku musi być obiektem z polami „wersja” i „zadania”.')
    return res
  }
  const obj = root as Record<string, unknown>
  if (!Array.isArray(obj.zadania)) {
    res.errors.push('Brak tablicy „zadania” w pliku.')
    return res
  }
  if (obj.wersja === undefined) res.warnings.push('Brak pola „wersja” – przyjęto wersję 1.')
  else if (obj.wersja !== 1) res.warnings.push(`Nieznana wersja pliku (${String(obj.wersja)}) – próbuję wczytać jak wersję 1.`)

  const usedIds = new Set<number>()
  const pendingNoId: ContestTask[] = []

  obj.zadania.forEach((raw, i) => {
    const where = `Zadanie #${i + 1}`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      res.warnings.push(`${where}: to nie jest obiekt – pominięto.`)
      res.skipped++
      return
    }
    const r = raw as Record<string, unknown>
    const tytul = typeof r.tytul === 'string' ? r.tytul.trim() : ''
    if (!tytul) {
      res.warnings.push(`${where}: brak tytułu – pominięto.`)
      res.skipped++
      return
    }

    let opis = ''
    if (typeof r.opis === 'string') opis = r.opis
    else if (r.opis !== undefined && r.opis !== null) {
      opis = String(r.opis)
      res.warnings.push(`${where} („${tytul}”): opis nie był tekstem – zamieniono.`)
    }

    let termin: string | null = null
    if (r.termin !== undefined && r.termin !== null && r.termin !== '') {
      const t = typeof r.termin === 'string' ? r.termin.trim().slice(0, 10) : ''
      if (isValidISODate(t)) termin = t
      else res.warnings.push(`${where} („${tytul}”): niepoprawny termin „${String(r.termin)}” – ustawiono brak terminu.`)
    }

    let priorytet = normalizePriority(r.priorytet)
    if (!priorytet) {
      if (r.priorytet !== undefined)
        res.warnings.push(`${where} („${tytul}”): nieznany priorytet „${String(r.priorytet)}” – ustawiono „sredni”.`)
      priorytet = 'sredni'
    }

    let wykonane = normalizeBool(r.wykonane)
    if (wykonane === null) {
      if (r.wykonane !== undefined)
        res.warnings.push(`${where} („${tytul}”): pole „wykonane” nie jest wartością logiczną – przyjęto false.`)
      wykonane = false
    }

    let tagi = normalizeTags(r.tagi)
    if (tagi === null) {
      res.warnings.push(`${where} („${tytul}”): „tagi” nie są listą – pominięto tagi.`)
      tagi = []
    }

    const task: ContestTask = { id: 0, tytul, opis, termin, priorytet, wykonane, tagi }

    let id: number | null = null
    if (typeof r.id === 'number' && Number.isInteger(r.id)) id = r.id
    else if (typeof r.id === 'string' && /^-?\d+$/.test(r.id.trim())) id = Number(r.id)

    if (id === null) {
      if (r.id !== undefined) res.warnings.push(`${where} („${tytul}”): niepoprawne id – nadano nowe.`)
      pendingNoId.push(task)
    } else if (usedIds.has(id)) {
      res.warnings.push(`${where} („${tytul}”): zdublowane id ${id} – nadano nowe.`)
      pendingNoId.push(task)
    } else {
      usedIds.add(id)
      task.id = id
    }
    res.tasks.push(task)
  })

  // Zadania bez (unikalnego) id dostają kolejne wolne numery.
  let next = Math.max(0, ...usedIds) + 1
  for (const t of pendingNoId) {
    while (usedIds.has(next)) next++
    t.id = next
    usedIds.add(next)
  }

  if (obj.zadania.length > 0 && res.tasks.length === 0) {
    res.errors.push('Żadne zadanie w pliku nie miało poprawnej struktury.')
    return res
  }
  res.ok = true
  return res
}

/** Zadanie aplikacji → obiekt w formacie konkursowym (dokładnie 7 pól, stała kolejność). */
export function toContestTask(t: Task): ContestTask {
  return {
    id: t.id,
    tytul: t.title,
    opis: t.description,
    termin: t.deadline,
    priorytet: t.priority,
    wykonane: t.status === 'done',
    tagi: [...t.tags],
  }
}

export function buildContestFile(tasks: Task[]): ContestFile {
  return { wersja: 1, zadania: [...tasks].sort((a, b) => a.id - b.id).map(toContestTask) }
}

export const serializeContestFile = (tasks: Task[]) => JSON.stringify(buildContestFile(tasks), null, 2) + '\n'

/** Pobranie pliku w przeglądarce. */
export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
