import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, ListChecks, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/layout/Shell'
import { DeadlineLabel, PRIO_COLOR, PlannedLabel, PriorityBadge, TagChip } from '../components/task/bits'
import { useTaskActions } from '../components/task/useTaskActions'
import { Button, IconButton, ProgressBar, cx } from '../components/ui/primitives'
import { PRIORITY_WEIGHT, STATUS_SHORT, isOverdue, subtaskProgress } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Status, Task } from '../types'

const COLUMNS: { status: Status; hint: string; tone: string; dot: string }[] = [
  { status: 'todo', hint: 'Surowe ciasto', tone: 'bg-cream-2', dot: 'bg-beige-2' },
  { status: 'in_progress', hint: 'W piekarniku', tone: 'bg-caramel-100/60', dot: 'bg-caramel-400' },
  { status: 'done', hint: 'Upieczone', tone: 'bg-pista-50', dot: 'bg-pista-500' },
]
const ORDER: Status[] = ['todo', 'in_progress', 'done']

function sortFor(status: Status) {
  return (a: Task, b: Task) =>
    status === 'done'
      ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
      : PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
}

function CardBody({ task, dragging }: { task: Task; dragging?: boolean }) {
  const sp = subtaskProgress(task)
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-2xl border border-beige/80 bg-card p-3.5 shadow-soft transition',
        dragging && 'rotate-[1.5deg] shadow-lift ring-2 ring-pista-300',
        isOverdue(task) && 'border-rose',
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: PRIO_COLOR[task.priority] }} />
      <p className={cx('text-[14px] font-semibold leading-snug', task.status === 'done' && 'text-ink-3 line-through decoration-pista-400')}>{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-ink-2">{task.description}</p>}
      {sp.total > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center gap-1 text-[11px] text-ink-2">
            <ListChecks size={11} /> {sp.done}/{sp.total}
          </div>
          <ProgressBar value={sp.pct} className="h-1.5" />
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <PriorityBadge priority={task.priority} />
        <DeadlineLabel task={task} />
        <PlannedLabel task={task} />
        {task.tags.map((t) => (
          <TagChip key={t} name={t} />
        ))}
      </div>
    </div>
  )
}

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const openDetail = useUI((s) => s.openDetail)
  const actions = useTaskActions()
  const idx = ORDER.indexOf(task.status)
  return (
    <div ref={setNodeRef} className={cx('group relative touch-manipulation', isDragging && 'opacity-30')}>
      <div {...listeners} {...attributes} onClick={() => openDetail(task.id)} className="cursor-grab active:cursor-grabbing" aria-label={`${task.title} – przeciągnij, aby zmienić status`}>
        <CardBody task={task} />
      </div>
      {/* Alternatywa dla drag & drop (klawiatura / dostępność) */}
      <div className="absolute right-2 top-2.5 flex gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {idx > 0 && (
          <IconButton label={`Przenieś do ${STATUS_SHORT[ORDER[idx - 1]]}`} className="size-7 bg-card/90" onClick={() => actions.setStatus(task.id, ORDER[idx - 1])}>
            <ChevronLeft size={14} />
          </IconButton>
        )}
        {idx < 2 && (
          <IconButton label={`Przenieś do ${STATUS_SHORT[ORDER[idx + 1]]}`} className="size-7 bg-card/90" onClick={() => actions.setStatus(task.id, ORDER[idx + 1])}>
            <ChevronRight size={14} />
          </IconButton>
        )}
      </div>
    </div>
  )
}

function Column({ status, hint, tone, dot, tasks }: (typeof COLUMNS)[number] & { tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const openForm = useUI((s) => s.openForm)
  const [limit, setLimit] = useState(15)
  return (
    <div ref={setNodeRef} className={cx('flex min-h-[60dvh] w-[85vw] shrink-0 snap-center flex-col rounded-3xl p-3 transition sm:w-auto', tone, isOver && 'ring-2 ring-pista-400 ring-offset-2 ring-offset-cream')}>
      <div className="mb-3 flex items-center gap-2 px-1.5">
        <span className={cx('size-2.5 rounded-full', dot)} />
        <h2 className="whitespace-nowrap font-display text-base font-semibold">{STATUS_SHORT[status]}</h2>
        <span className="rounded-full bg-card px-2 text-xs font-bold text-ink-2">{tasks.length}</span>
        <span className="ml-auto hidden whitespace-nowrap text-[11px] font-semibold text-ink-3 xl:inline">{hint}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {tasks.slice(0, limit).map((t) => (
          <DraggableCard key={t.id} task={t} />
        ))}
        {tasks.length > limit && (
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 20)}>
            Pokaż więcej ({tasks.length - limit})
          </Button>
        )}
        {tasks.length === 0 && <p className="rounded-2xl border-2 border-dashed border-beige-2 px-4 py-8 text-center text-xs text-ink-3">Przeciągnij tu zadanie</p>}
        {status !== 'done' && (
          <button type="button" onClick={() => openForm({ status })} className="flex cursor-pointer items-center gap-1.5 rounded-2xl px-3 py-2 text-[13px] font-semibold text-ink-3 transition hover:bg-card/70 hover:text-ink-2">
            <Plus size={15} /> Dodaj zadanie
          </button>
        )}
      </div>
    </div>
  )
}

export function KanbanPage() {
  const tasks = useStore((s) => s.tasks)
  const actions = useTaskActions()
  const [activeId, setActiveId] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const active = tasks.find((t) => t.id === activeId)

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const to = e.over?.id as Status | undefined
    if (to && ORDER.includes(to)) actions.setStatus(Number(e.active.id), to)
  }

  return (
    <div>
      <PageHeader title="Kanban" sub="Przeciągaj karty między kolumnami – status zmieni się we wszystkich widokach." />
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(Number(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {COLUMNS.map((c) => (
            <Column key={c.status} {...c} tasks={tasks.filter((t) => t.status === c.status).sort(sortFor(c.status))} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0.8,0.2,1)' }}>{active ? <CardBody task={active} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
