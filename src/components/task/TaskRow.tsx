import { ListChecks, Timer } from 'lucide-react'
import { formatMinutes } from '../../lib/dates'
import { isDone, isOverdue, subtaskProgress } from '../../lib/taskUtils'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { Task } from '../../types'
import { cx } from '../ui/primitives'
import { DeadlineLabel, DoneToggle, PRIO_COLOR, PlannedLabel, PriorityBadge, StatusBadge, TagChip } from './bits'
import { useTaskActions } from './useTaskActions'
import type { ReactNode } from 'react'

/** Wiersz zadania w listach (Dziś, Backlog, dzień kalendarza). */
export function TaskRow({
  task,
  showPlanned = true,
  showStatus = false,
  trailing,
  dense,
}: {
  task: Task
  showPlanned?: boolean
  showStatus?: boolean
  trailing?: ReactNode
  dense?: boolean
}) {
  const openDetail = useUI((s) => s.openDetail)
  const timer = useStore((s) => s.timer)
  const actions = useTaskActions()
  const done = isDone(task)
  const sp = subtaskProgress(task)
  const baking = timer.phase === 'work' && timer.taskId === task.id

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openDetail(task.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), openDetail(task.id))}
      className={cx(
        'group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-card transition-all hover:border-beige-2 hover:shadow-soft',
        dense ? 'px-3 py-2.5' : 'px-4 py-3',
        isOverdue(task) && 'bg-[color-mix(in_srgb,var(--color-rose)_35%,var(--color-card))]',
      )}
    >
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-full" style={{ background: PRIO_COLOR[task.priority], opacity: done ? 0.3 : 0.9 }} />
      <div className="pt-0.5">
        <DoneToggle done={done} onToggle={() => actions.toggle(task.id)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className={cx('min-w-0 flex-1 text-[15px] font-semibold leading-snug transition', done && 'text-ink-3 line-through decoration-pista-400 decoration-2')}>
            {task.title}
          </p>
          {baking && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-caramel-100 px-2 py-0.5 text-[11px] font-bold text-caramel-600">
              <Timer size={11} /> w piekarniku
            </span>
          )}
        </div>
        {!dense && task.description && <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-2">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <PriorityBadge priority={task.priority} />
          {showStatus && <StatusBadge status={task.status} />}
          <DeadlineLabel task={task} />
          {showPlanned && <PlannedLabel task={task} />}
          {sp.total > 0 && (
            <span className={cx('inline-flex items-center gap-1 text-xs', sp.done === sp.total ? 'text-pista-600' : 'text-ink-2')}>
              <ListChecks size={12} /> {sp.done}/{sp.total}
            </span>
          )}
          {task.estimateMin ? <span className="text-xs text-ink-3">~{formatMinutes(task.estimateMin)}</span> : null}
          {task.tags.map((t) => (
            <TagChip key={t} name={t} />
          ))}
        </div>
      </div>
      {trailing && (
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      )}
    </div>
  )
}
