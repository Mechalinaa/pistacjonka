import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { AlarmClock, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { useState } from 'react'
import { DayPanel } from '../components/DayPanel'
import { PageHeader } from '../components/layout/Shell'
import { PRIO_COLOR } from '../components/task/bits'
import { Button, Card, IconButton, Segmented, cx } from '../components/ui/primitives'
import { addDaysISO, fmt, formatMinutes, fromISO, toISO, todayISO } from '../lib/dates'
import { dayLoad } from '../lib/suggestions'
import { PRIORITY_WEIGHT, estimationFactor, isDone, isOverdue } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { ISODate, Task } from '../types'

type View = 'month' | 'week' | 'day'
const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

const weekStart = (iso: ISODate) => toISO(startOfWeek(fromISO(iso), { weekStartsOn: 1 }))

export function CalendarPage() {
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState<ISODate>(todayISO())
  const [selected, setSelected] = useState<ISODate>(todayISO())
  const today = todayISO()

  const move = (dir: 1 | -1) => {
    if (view === 'month') setCursor(toISO(addMonths(fromISO(cursor), dir)))
    else if (view === 'week') setCursor(addDaysISO(cursor, 7 * dir))
    else {
      const d = addDaysISO(selected, dir)
      setSelected(d)
      setCursor(d)
    }
  }
  const title =
    view === 'month'
      ? fmt(cursor, 'LLLL yyyy')
      : view === 'week'
        ? `${fmt(weekStart(cursor), 'd MMM')} – ${fmt(addDaysISO(weekStart(cursor), 6), 'd MMM yyyy')}`
        : fmt(selected, 'EEEE, d MMMM')

  return (
    <div>
      <PageHeader
        title="Kalendarz"
        sub="Deadline’y, plan dnia i historia – kliknij dzień, aby zobaczyć szczegóły i statystyki."
        actions={
          <Segmented
            value={view}
            onChange={(v) => (setView(v), v === 'day' && setCursor(selected))}
            options={[
              { value: 'month', label: 'Miesiąc' },
              { value: 'week', label: 'Tydzień' },
              { value: 'day', label: 'Dzień' },
            ]}
          />
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Poprzedni" onClick={() => move(-1)}>
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label="Następny" onClick={() => move(1)}>
          <ChevronRight size={18} />
        </IconButton>
        <h2 className="font-display text-xl font-semibold first-letter:uppercase">{title}</h2>
        <Button size="sm" className="ml-auto" onClick={() => (setCursor(today), setSelected(today))}>
          Dziś
        </Button>
      </div>

      {view === 'month' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <MonthGrid cursor={cursor} selected={selected} onSelect={setSelected} />
          <Card className="p-4 sm:p-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
            <DayPanel day={selected} />
          </Card>
        </div>
      )}
      {view === 'week' && <WeekPlanner start={weekStart(cursor)} onOpenDay={(d) => (setSelected(d), setCursor(d), setView('day'))} />}
      {view === 'day' && (
        <Card className="mx-auto max-w-3xl p-4 sm:p-6">
          <DayPanel day={selected} />
        </Card>
      )}
      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded-full bg-prio-high" /> wysoki
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded-full bg-prio-mid" /> średni
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-1 rounded-full bg-prio-low" /> niski
      </span>
      <span className="flex items-center gap-1.5">
        <AlarmClock size={12} /> deadline
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-pista-100 px-1 text-pista-700 line-through">abc</span> wykonane
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-rose px-1 text-prio-high">abc</span> po terminie
      </span>
    </div>
  )
}

function Chip({ task, kind }: { task: Task; kind: 'plan' | 'deadline' }) {
  const done = isDone(task)
  const overdue = isOverdue(task)
  return (
    <div
      className={cx(
        'flex items-center gap-1 truncate rounded-md py-0.5 pl-1.5 pr-1 text-[11px] font-semibold leading-tight',
        done ? 'bg-pista-100 text-pista-700 line-through decoration-pista-400' : overdue ? 'bg-rose text-prio-high' : kind === 'deadline' ? 'bg-caramel-100 text-caramel-600' : 'bg-beige text-ink',
      )}
      style={{ boxShadow: `inset 2px 0 0 ${PRIO_COLOR[task.priority]}` }}
      title={`${kind === 'deadline' ? 'Deadline: ' : 'Plan: '}${task.title}`}
    >
      {kind === 'deadline' && <AlarmClock size={10} className="shrink-0" />}
      <span className="truncate">{task.title}</span>
    </div>
  )
}

function MonthGrid({ cursor, selected, onSelect }: { cursor: ISODate; selected: ISODate; onSelect: (d: ISODate) => void }) {
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const openForm = useUI((s) => s.openForm)
  const today = todayISO()
  const start = toISO(startOfWeek(startOfMonth(fromISO(cursor)), { weekStartsOn: 1 }))
  const end = toISO(endOfWeek(endOfMonth(fromISO(cursor)), { weekStartsOn: 1 }))
  const days: ISODate[] = []
  for (let d = start; d <= end; d = addDaysISO(d, 1)) days.push(d)
  const month = cursor.slice(0, 7)
  const baked = new Map<ISODate, number>()
  for (const s of sessions) if (s.completed) baked.set(toISO(new Date(s.endedAt)), (baked.get(toISO(new Date(s.endedAt))) ?? 0) + 1)

  return (
    <Card className="overflow-hidden p-2 sm:p-3">
      <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-ink-3">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const items: { task: Task; kind: 'plan' | 'deadline' }[] = [
            ...tasks.filter((t) => t.deadline === d).map((task) => ({ task, kind: 'deadline' as const })),
            ...tasks.filter((t) => t.plannedDate === d && t.deadline !== d).map((task) => ({ task, kind: 'plan' as const })),
          ].sort((a, b) => Number(isDone(a.task)) - Number(isDone(b.task)) || PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority])
          const inMonth = d.startsWith(month)
          const p = baked.get(d) ?? 0
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              onDoubleClick={() => openForm({ plannedDate: d })}
              className={cx(
                'group flex min-h-[74px] cursor-pointer flex-col gap-1 rounded-xl p-1.5 text-left transition sm:min-h-[104px]',
                inMonth ? 'bg-cream/60 hover:bg-beige/60' : 'opacity-45 hover:opacity-80',
                d === selected && 'bg-pista-50 ring-2 ring-pista-400',
              )}
              aria-label={`${fmt(d, 'd MMMM')}: ${items.length} zadań`}
            >
              <div className="flex items-center justify-between">
                <span className={cx('flex size-6 items-center justify-center rounded-full text-xs font-bold', d === today ? 'bg-pista-600 text-cream' : 'text-ink-2')}>{Number(d.slice(8))}</span>
                {p > 0 && <span className="text-[10px] font-bold text-caramel-500" title={`${p} upieczonych pistacjonek`}>●{p}</span>}
              </div>
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {items.slice(0, 3).map((it) => (
                  <Chip key={`${it.kind}${it.task.id}`} {...it} />
                ))}
                {items.length > 3 && <span className="px-1 text-[10px] font-semibold text-ink-3">+{items.length - 3} więcej</span>}
              </div>
              {/* mobile: kropki */}
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {items.slice(0, 4).map((it) => (
                  <span key={`${it.kind}${it.task.id}`} className="size-1.5 rounded-full" style={{ background: isDone(it.task) ? 'var(--color-pista-400)' : isOverdue(it.task) ? 'var(--color-prio-high)' : PRIO_COLOR[it.task.priority] }} />
                ))}
              </div>
            </button>
          )
        })}
      </div>
      <p className="px-2 pb-1 pt-3 text-[11px] text-ink-3">Kliknij dzień, aby zobaczyć szczegóły. Dwuklik – nowe zadanie na ten dzień.</p>
    </Card>
  )
}

/* ——— Tydzień: planowanie dniami z przeciąganiem ——— */

function PlanCard({ task, overlay }: { task: Task; overlay?: boolean }) {
  const openDetail = useUI((s) => s.openDetail)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={() => openDetail(task.id)}
      className={cx(
        'relative cursor-grab touch-manipulation overflow-hidden rounded-xl border border-beige/80 bg-card py-2 pl-3 pr-2 text-left shadow-soft active:cursor-grabbing',
        isDragging && 'opacity-30',
        overlay && 'rotate-[1.5deg] shadow-lift ring-2 ring-pista-300',
        isDone(task) && 'opacity-60',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: PRIO_COLOR[task.priority] }} />
      <p className={cx('text-[13px] font-semibold leading-snug', isDone(task) && 'line-through')}>{task.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
        {task.estimateMin ? <span>~{formatMinutes(task.estimateMin)}</span> : null}
        {task.deadline && (
          <span className={cx('inline-flex items-center gap-0.5', isOverdue(task) && 'font-bold text-prio-high')}>
            <AlarmClock size={10} /> {fmt(task.deadline, 'd.MM')}
          </span>
        )}
      </div>
    </div>
  )
}

function DayColumn({ day, children, onOpen }: { day: ISODate; children: React.ReactNode; onOpen: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: day })
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const capacity = useStore((s) => s.settings.dailyCapacityMin)
  const { factor } = estimationFactor(tasks, sessions)
  const load = dayLoad(tasks, day, factor)
  const deadlines = tasks.filter((t) => t.deadline === day && !isDone(t))
  const today = todayISO()
  const pct = Math.min(100, (load.realisticMin / capacity) * 100)
  const over = load.realisticMin > capacity
  return (
    <div ref={setNodeRef} className={cx('flex w-[46vw] shrink-0 snap-start flex-col rounded-2xl p-2 transition sm:w-[190px] xl:w-auto', day === today ? 'bg-pista-50' : day < today ? 'bg-cream-2/60' : 'bg-cream-2', isOver && 'ring-2 ring-pista-400')}>
      <button type="button" onClick={onOpen} className="cursor-pointer rounded-xl px-1.5 py-1 text-left hover:bg-card/60">
        <p className={cx('text-[11px] font-bold uppercase tracking-wider', day === today ? 'text-pista-700' : 'text-ink-3')}>{fmt(day, 'EEE')}</p>
        <p className="font-display text-lg font-semibold">{fmt(day, 'd MMM')}</p>
      </button>
      <div className="mx-1.5 mb-2 mt-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-beige">
          <div className={cx('h-full rounded-full', over ? 'bg-prio-high' : pct > 75 ? 'bg-caramel-400' : 'bg-pista-400')} style={{ width: `${pct}%` }} />
        </div>
        <p className={cx('mt-1 text-[10px] font-semibold', over ? 'text-prio-high' : 'text-ink-3')}>
          {load.count} zad. · {formatMinutes(load.realisticMin)}
          {over && ' · przeładowany!'}
        </p>
      </div>
      {deadlines.length > 0 && (
        <div className="mx-1 mb-2 space-y-0.5">
          {deadlines.map((t) => (
            <p key={t.id} className="flex items-center gap-1 truncate text-[10px] font-bold text-caramel-600" title={`Deadline: ${t.title}`}>
              <AlarmClock size={10} className="shrink-0" /> <span className="truncate">{t.title}</span>
            </p>
          ))}
        </div>
      )}
      <div className="flex min-h-24 flex-1 flex-col gap-1.5">{children}</div>
    </div>
  )
}

function UnplannedTray({ tasks }: { tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unplanned' })
  return (
    <Card className={cx('mb-4 p-3 transition', isOver && 'ring-2 ring-pista-400')}>
      <div ref={setNodeRef}>
        <p className="mb-2 flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-wider text-ink-3">
          <Inbox size={14} /> Niezaplanowane ({tasks.length}) – przeciągnij na wybrany dzień
        </p>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto p-1">
          {tasks.map((t) => (
            <div key={t.id} className="w-56">
              <PlanCard task={t} />
            </div>
          ))}
          {tasks.length === 0 && <p className="px-1 text-sm text-ink-3">Wszystko ma swój dzień. Przeciągnij tu zadanie, by je odplanować.</p>}
        </div>
      </div>
    </Card>
  )
}

function WeekPlanner({ start, onOpenDay }: { start: ISODate; onOpenDay: (d: ISODate) => void }) {
  const tasks = useStore((s) => s.tasks)
  const planTask = useStore((s) => s.planTask)
  const toast = useUI((s) => s.toast)
  const [activeId, setActiveId] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }))
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
  const unplanned = tasks
    .filter((t) => !t.plannedDate && !isDone(t))
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
  const active = tasks.find((t) => t.id === activeId)

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const id = Number(e.active.id)
    const target = String(e.over.id)
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const day = target === 'unplanned' ? null : target
    if (task.plannedDate === day) return
    planTask(id, day)
    if (day && task.deadline && day > task.deadline) toast(`Uwaga: zaplanowano po deadlinie (${fmt(task.deadline, 'd MMM')}).`, 'info')
    else toast(day ? `Przeniesiono na ${fmt(day, 'EEEE, d MMM')}.` : 'Przeniesiono do niezaplanowanych.', 'info')
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(Number(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
      <UnplannedTray tasks={unplanned} />
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-7 xl:overflow-visible">
        {days.map((d) => (
          <DayColumn key={d} day={d} onOpen={() => onOpenDay(d)}>
            {tasks
              .filter((t) => t.plannedDate === d)
              .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
              .map((t) => (
                <PlanCard key={t.id} task={t} />
              ))}
          </DayColumn>
        ))}
      </div>
      <DragOverlay>{active ? <PlanCard task={active} overlay /> : null}</DragOverlay>
      <p className="mt-1 text-xs text-ink-3">
        Pasek pod datą to obciążenie dnia względem Twojej dziennej pojemności (Ustawienia). Szacunki są korygowane Twoim historycznym współczynnikiem estymacji.
      </p>
    </DndContext>
  )
}

