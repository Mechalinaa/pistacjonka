import { AlarmClock, ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react'
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { PageHeader } from '../components/layout/Shell'
import { PRIO_COLOR } from '../components/task/bits'
import { Button, Card, Empty, IconButton, Segmented, cx } from '../components/ui/primitives'
import { addDaysISO, daysBetween, fmt, fromISO, todayISO } from '../lib/dates'
import { isDone, isOverdue } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { ISODate, Task } from '../types'

const DAY_W = 46
const ROW_H = 44
type Mode = 'move' | 'start' | 'end'
interface Drag {
  id: number
  mode: Mode
  x0: number
  delta: number
}

/** Zakres paska: od planowanej daty do deadline’u (lub pojedynczy dzień). */
function span(t: Task): { start: ISODate; end: ISODate } | null {
  const a = t.plannedDate
  const b = t.deadline
  if (!a && !b) return null
  if (a && b) return a <= b ? { start: a, end: b } : { start: b, end: a }
  const d = (a ?? b)!
  return { start: d, end: d }
}

export function TimelinePage() {
  const tasks = useStore((s) => s.tasks)
  const updateTask = useStore((s) => s.updateTask)
  const openDetail = useUI((s) => s.openDetail)
  const toast = useUI((s) => s.toast)
  const today = todayISO()
  const [from, setFrom] = useState(addDaysISO(today, -3))
  const [range, setRange] = useState<'14' | '28' | '42'>('28')
  const [showDone, setShowDone] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const days = Number(range)
  const to = addDaysISO(from, days - 1)
  const dayList = Array.from({ length: days }, (_, i) => addDaysISO(from, i))

  const rows = useMemo(
    () =>
      tasks
        .filter((t) => (showDone || !isDone(t)) && span(t))
        .map((t) => ({ t, s: span(t)! }))
        .filter(({ s }) => s.end >= from && s.start <= to)
        .sort((a, b) => a.s.start.localeCompare(b.s.start) || a.s.end.localeCompare(b.s.end)),
    [tasks, showDone, from, to],
  )
  const undated = tasks.filter((t) => !isDone(t) && !t.plannedDate && !t.deadline).length

  const onDown = (e: RPointerEvent, id: number, mode: Mode) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const d = { id, mode, x0: e.clientX, delta: 0 }
    dragRef.current = d
    setDrag(d)
  }
  const onMove = (e: RPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const delta = Math.round((e.clientX - d.x0) / DAY_W)
    if (delta !== d.delta) {
      dragRef.current = { ...d, delta }
      setDrag(dragRef.current)
    }
  }
  const onUp = (e: RPointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) return
    const t = tasks.find((x) => x.id === d.id)
    if (!t) return
    if (d.delta === 0) {
      if (Math.abs(e.clientX - d.x0) < 5) openDetail(t.id)
      return
    }
    const shifted = (iso: ISODate | null) => (iso ? addDaysISO(iso, d.delta) : iso)
    const patch = preview(t, d)
    if (d.mode === 'move') updateTask(t.id, { plannedDate: shifted(t.plannedDate), deadline: shifted(t.deadline) })
    else updateTask(t.id, patch)
    toast(d.mode === 'end' ? 'Zmieniono deadline.' : d.mode === 'start' ? 'Zmieniono planowaną datę.' : `Przesunięto o ${d.delta > 0 ? '+' : ''}${d.delta} dni.`, 'info')
  }

  /** Daty zadania po uwzględnieniu trwającego przeciągania. */
  function preview(t: Task, d: Drag | null): Pick<Task, 'plannedDate' | 'deadline'> {
    if (!d || d.id !== t.id || d.delta === 0) return { plannedDate: t.plannedDate, deadline: t.deadline }
    const sh = (iso: ISODate | null) => (iso ? addDaysISO(iso, d.delta) : iso)
    if (d.mode === 'move') return { plannedDate: sh(t.plannedDate), deadline: sh(t.deadline) }
    const s = span(t)!
    // Lewy uchwyt = planowany start; prawy = deadline (jeśli brak, tworzymy go).
    if (d.mode === 'start') return { plannedDate: addDaysISO(t.plannedDate ?? s.start, d.delta), deadline: t.deadline }
    return { plannedDate: t.plannedDate, deadline: addDaysISO(t.deadline ?? s.end, d.delta) }
  }

  return (
    <div>
      <PageHeader
        title="Oś czasu"
        sub="Od planowanego startu do deadline’u. Przeciągnij pasek, by przesunąć zadanie; uchwyty zmieniają start lub termin."
        actions={
          <>
            <Segmented
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: '14', label: '2 tyg.' },
                { value: '28', label: '4 tyg.' },
                { value: '42', label: '6 tyg.' },
              ]}
            />
            <Button size="sm" variant={showDone ? 'primary' : 'secondary'} onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Ukryj wykonane' : 'Pokaż wykonane'}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="Wcześniej" onClick={() => setFrom(addDaysISO(from, -7))}>
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label="Później" onClick={() => setFrom(addDaysISO(from, 7))}>
          <ChevronRight size={18} />
        </IconButton>
        <span className="font-display text-lg font-semibold">
          {fmt(from, 'd MMM')} – {fmt(to, 'd MMM yyyy')}
        </span>
        <Button size="sm" className="ml-auto" onClick={() => setFrom(addDaysISO(today, -3))}>
          Dziś
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => ((dragRef.current = null), setDrag(null))}>
          <div style={{ width: 200 + days * DAY_W }} className="relative select-none">
            {/* nagłówek dni */}
            <div className="sticky top-0 z-10 flex border-b border-beige bg-card">
              <div className="sticky left-0 z-20 w-[200px] shrink-0 border-r border-beige bg-card px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">Zadanie</div>
              {dayList.map((d) => {
                const wd = fromISO(d).getDay()
                return (
                  <div key={d} style={{ width: DAY_W }} className={cx('shrink-0 py-1.5 text-center', d === today && 'bg-pista-100', (wd === 0 || wd === 6) && d !== today && 'bg-cream-2')}>
                    <p className="text-[10px] font-semibold uppercase text-ink-3">{fmt(d, 'EEEEEE')}</p>
                    <p className={cx('text-xs font-bold', d === today ? 'text-pista-700' : 'text-ink-2')}>{fmt(d, 'd')}</p>
                  </div>
                )
              })}
            </div>
            {/* linia „dziś” */}
            {today >= from && today <= to && (
              <div className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0.5 bg-pista-400/70" style={{ left: 200 + daysBetween(from, today) * DAY_W + DAY_W / 2 }} />
            )}
            {rows.map(({ t }) => {
              const p = preview(t, drag)
              const s = span({ ...t, ...p })!
              const left = Math.max(0, daysBetween(from, s.start))
              const right = Math.min(days - 1, daysBetween(from, s.end))
              const clippedL = s.start < from
              const clippedR = s.end > to
              const late = !!(p.plannedDate && p.deadline && p.plannedDate > p.deadline)
              const color = PRIO_COLOR[t.priority]
              const active = drag?.id === t.id
              return (
                <div key={t.id} className="group flex border-b border-beige/60 hover:bg-cream/70" style={{ height: ROW_H }}>
                  <button
                    type="button"
                    onClick={() => openDetail(t.id)}
                    className="sticky left-0 z-[6] flex w-[200px] shrink-0 cursor-pointer items-center gap-2 border-r border-beige bg-card px-3 text-left group-hover:bg-cream"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className={cx('truncate text-[13px] font-semibold', isDone(t) && 'text-ink-3 line-through')}>{t.title}</span>
                  </button>
                  <div className="relative flex-1">
                    {dayList.map((d, i) => {
                      const wd = fromISO(d).getDay()
                      return (wd === 0 || wd === 6) && <div key={d} className="absolute inset-y-0 bg-cream-2/60" style={{ left: i * DAY_W, width: DAY_W }} />
                    })}
                    <div
                      onPointerDown={(e) => onDown(e, t.id, 'move')}
                      className={cx(
                        'absolute top-2 flex h-7 cursor-grab touch-none items-center rounded-full text-[11px] font-bold transition-shadow active:cursor-grabbing',
                        active ? 'z-10 shadow-lift' : 'shadow-soft',
                        clippedL && 'rounded-l-md',
                        clippedR && 'rounded-r-md',
                      )}
                      style={{
                        left: left * DAY_W + 3,
                        width: (right - left + 1) * DAY_W - 6,
                        background: isDone(t) ? 'var(--color-pista-100)' : late ? `repeating-linear-gradient(135deg, ${color}33 0 6px, ${color}55 6px 12px)` : `color-mix(in srgb, ${color} 28%, var(--color-card))`,
                        border: `1.5px solid ${isOverdue(t) ? 'var(--color-prio-high)' : color}`,
                      }}
                      title={`${t.title}\nPlan: ${p.plannedDate ?? '—'} · Deadline: ${p.deadline ?? '—'}${late ? '\nUwaga: plan po deadlinie!' : ''}`}
                    >
                      <span onPointerDown={(e) => onDown(e, t.id, 'start')} className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize rounded-l-full hover:bg-black/10" aria-hidden />
                      {p.deadline && p.deadline >= from && p.deadline <= to && (
                        <AlarmClock size={12} className="absolute" style={{ left: (daysBetween(from, p.deadline) - left) * DAY_W + DAY_W / 2 - 9, color: 'var(--color-ink)' }} />
                      )}
                      <span onPointerDown={(e) => onDown(e, t.id, 'end')} className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize rounded-r-full hover:bg-black/10" aria-hidden />
                    </div>
                    {active && drag && drag.delta !== 0 && (
                      <span className="absolute -top-0.5 z-20 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-cream" style={{ left: left * DAY_W }}>
                        {drag.delta > 0 ? '+' : ''}
                        {drag.delta} d
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {rows.length === 0 && (
          <Empty title="Brak zadań w tym okresie" slot={<MoveHorizontal className="text-ink-3" />}>
            Nadaj zadaniom planowaną datę lub deadline, a pojawią się na osi czasu.
          </Empty>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-3">
        <AlarmClock size={11} className="inline" /> = deadline · paski kreskowane = planowany start po terminie · kolor = priorytet.
        {undated > 0 && <> {undated} zadań bez dat czeka w backlogu.</>}
      </p>
    </div>
  )
}
