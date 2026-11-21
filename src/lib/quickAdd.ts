/**
 * Szybkie dodawanie z „mini-składnią”, np.:
 *   „Kolokwium z sieci #studia !wysoki @piątek ~90m”
 *
 *   #tag            – tag (można kilka)
 *   !wysoki / !!!   – priorytet (!niski, !sredni, !wysoki lub !, !!, !!!)
 *   @dziś @jutro @pojutrze @pon…@nd @2026-11-25 @25.11 – deadline
 *   ~30m ~1h ~1.5h  – szacowany czas
 */
import { addDays, nextDay, type Day } from 'date-fns'
import { isValidISODate, toISO } from './dates'
import { normalizePriority } from './contestJson'
import type { Priority } from '../types'

export interface QuickAddResult {
  title: string
  tags: string[]
  priority: Priority | null
  deadline: string | null
  estimateMin: number | null
}

const WEEKDAYS: Record<string, Day> = {
  nd: 0, niedziela: 0, niedz: 0,
  pon: 1, poniedzialek: 1,
  wt: 2, wto: 2, wtorek: 2,
  sr: 3, sro: 3, sroda: 3,
  czw: 4, czwartek: 4,
  pt: 5, pia: 5, piatek: 5,
  sob: 6, sobota: 6,
}

const strip = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

export function parseDateToken(token: string, now = new Date()): string | null {
  const t = strip(token)
  if (t === 'dzis' || t === 'dzisiaj') return toISO(now)
  if (t === 'jutro') return toISO(addDays(now, 1))
  if (t === 'pojutrze') return toISO(addDays(now, 2))
  if (Object.hasOwn(WEEKDAYS, t)) return toISO(nextDay(now, WEEKDAYS[t]))
  if (isValidISODate(t)) return t
  const m = t.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?$/)
  if (m) {
    const year = m[3] ? Number(m[3]) : now.getFullYear()
    const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (!isValidISODate(iso)) return null
    // Data bez roku, która już minęła → przyszły rok.
    if (!m[3] && iso < toISO(now)) return `${year + 1}${iso.slice(4)}`
    return iso
  }
  return null
}

export function parseQuickAdd(input: string, now = new Date()): QuickAddResult {
  const res: QuickAddResult = { title: '', tags: [], priority: null, deadline: null, estimateMin: null }
  const words: string[] = []
  for (const w of input.trim().split(/\s+/)) {
    if (!w) continue
    if (/^#\S+/.test(w)) {
      const tag = w.slice(1)
      if (!res.tags.includes(tag)) res.tags.push(tag)
      continue
    }
    if (/^!{1,3}$/.test(w)) {
      res.priority = (['niski', 'sredni', 'wysoki'] as Priority[])[w.length - 1]
      continue
    }
    if (/^!\S+/.test(w)) {
      const p = normalizePriority(w.slice(1))
      if (p) {
        res.priority = p
        continue
      }
    }
    if (/^@\S+/.test(w)) {
      const d = parseDateToken(w.slice(1), now)
      if (d) {
        res.deadline = d
        continue
      }
    }
    const est = w.match(/^~(\d+(?:[.,]\d+)?)(m|min|h)?$/i)
    if (est) {
      const n = Number(est[1].replace(',', '.'))
      res.estimateMin = Math.round(est[2]?.toLowerCase() === 'h' ? n * 60 : n)
      continue
    }
    words.push(w)
  }
  res.title = words.join(' ')
  return res
}
