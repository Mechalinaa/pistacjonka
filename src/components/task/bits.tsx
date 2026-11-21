import { AlarmClock, CalendarCheck2, Flag } from 'lucide-react'
import { relativeDay, todayISO } from '../../lib/dates'
import { PRIORITY_LABEL, STATUS_LABEL, daysLeft, isDone } from '../../lib/taskUtils'
import { useTagColor } from '../../store/useStore'
import type { Priority, Status, Task } from '../../types'
import { cx } from '../ui/primitives'

export const PRIO_COLOR: Record<Priority, string> = {
  wysoki: 'var(--color-prio-high)',
  sredni: 'var(--color-prio-mid)',
  niski: 'var(--color-prio-low)',
}

export function PriorityBadge({ priority, compact }: { priority: Priority; compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ color: PRIO_COLOR[priority], background: `color-mix(in srgb, ${PRIO_COLOR[priority]} 14%, transparent)` }}
      title={`Priorytet: ${PRIORITY_LABEL[priority]}`}
    >
      <Flag size={11} strokeWidth={2.6} />
      {!compact && PRIORITY_LABEL[priority]}
    </span>
  )
}

const STATUS_STYLE: Record<Status, string> = {
  todo: 'bg-beige text-ink-2',
  in_progress: 'bg-caramel-100 text-caramel-600',
  done: 'bg-pista-100 text-pista-700',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
}

export function TagChip({ name, onRemove, active, onClick, size = 'sm' }: { name: string; onRemove?: () => void; active?: boolean; onClick?: () => void; size?: 'sm' | 'md' }) {
  const color = useTagColor()(name)
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold transition',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-[13px]',
        onClick && 'cursor-pointer',
        active === false && 'opacity-55 hover:opacity-100',
      )}
      style={{
        background: active ? color : `color-mix(in srgb, ${color} 20%, var(--color-card))`,
        color: active ? '#fff' : `color-mix(in srgb, ${color} 55%, var(--color-ink))`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: active ? '#fff' : color }} />
      {name}
      {onRemove && (
        <span
          role="button"
          aria-label={`Usuń tag ${name}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="-mr-0.5 ml-0.5 cursor-pointer rounded-full px-1 leading-none opacity-60 hover:bg-black/10 hover:opacity-100"
        >
          ×
        </span>
      )}
    </Comp>
  )
}

/** Opis deadline'u z kolorem pilności. */
export function DeadlineLabel({ task, today = todayISO() }: { task: Task; today?: string }) {
  if (!task.deadline) return null
  const d = daysLeft(task, today)!
  const done = isDone(task)
  const tone = done ? 'text-ink-3' : d < 0 ? 'text-prio-high font-bold' : d <= 1 ? 'text-caramel-500 font-bold' : d <= 3 ? 'text-caramel-500' : 'text-ink-2'
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs', tone)} title={`Deadline: ${task.deadline}`}>
      <AlarmClock size={12} strokeWidth={2.2} />
      {d < 0 && !done ? `po terminie (${relativeDay(task.deadline, today)})` : relativeDay(task.deadline, today)}
    </span>
  )
}

export function PlannedLabel({ task, today = todayISO() }: { task: Task; today?: string }) {
  if (!task.plannedDate) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-pista-700" title={`Zaplanowane na: ${task.plannedDate}`}>
      <CalendarCheck2 size={12} strokeWidth={2.2} />
      {relativeDay(task.plannedDate, today)}
    </span>
  )
}

/** Okrągły „checkbox” w stylu kremowego guzika. */
export function DoneToggle({ done, onToggle, size = 22 }: { done: boolean; onToggle: () => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={done ? 'Cofnij wykonanie' : 'Oznacz jako wykonane'}
      title={done ? 'Cofnij wykonanie' : 'Oznacz jako wykonane'}
      className={cx(
        'group/check relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90',
        done ? 'border-pista-500 bg-pista-500' : 'border-beige-2 bg-card hover:border-pista-400 hover:bg-pista-50',
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 16 16" className={cx('size-[62%] transition-all', done ? 'scale-100 opacity-100' : 'scale-50 opacity-0 group-hover/check:scale-90 group-hover/check:opacity-40')}>
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke={done ? '#fff' : 'var(--color-pista-500)'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
