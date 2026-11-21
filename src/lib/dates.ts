import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import type { ISODate } from '../types'

/** Dzisiejsza data jako YYYY-MM-DD w lokalnej strefie. */
export const todayISO = (now: Date = new Date()): ISODate => format(now, 'yyyy-MM-dd')

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd')

/** Parsuje YYYY-MM-DD jako lokalną datę (bez przesunięć UTC). */
export const fromISO = (iso: ISODate): Date => parseISO(iso)

export const addDaysISO = (iso: ISODate, n: number): ISODate => toISO(addDays(fromISO(iso), n))

/** Ile dni od `from` do `to` (ujemne = przeszłość). */
export const daysBetween = (from: ISODate, to: ISODate): number =>
  differenceInCalendarDays(fromISO(to), fromISO(from))

export const isValidISODate = (v: unknown): boolean =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && isValid(parseISO(v)) && toISO(parseISO(v)) === v

/** Dzień kalendarzowy (lokalny) dla znacznika czasu ISO. */
export const dayOf = (timestamp: string | number): ISODate => toISO(new Date(timestamp))

export const fmt = (iso: ISODate, pattern: string) => format(fromISO(iso), pattern, { locale: pl })

/** Czytelny opis daty względem dzisiaj: „dziś”, „jutro”, „za 3 dni”, „2 dni temu”. */
export function relativeDay(iso: ISODate, today: ISODate = todayISO()): string {
  const d = daysBetween(today, iso)
  if (d === 0) return 'dziś'
  if (d === 1) return 'jutro'
  if (d === -1) return 'wczoraj'
  if (d > 1 && d < 7) return `za ${d} dni`
  if (d < -1 && d > -7) return `${-d} dni temu`
  return fmt(iso, 'd MMM')
}

export const longDate = (iso: ISODate) => fmt(iso, 'EEEE, d MMMM yyyy')

export function formatMinutes(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export const msToMin = (ms: number) => ms / 60000

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
