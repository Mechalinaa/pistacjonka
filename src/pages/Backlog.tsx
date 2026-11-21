import { ArrowDownNarrowWide, ArrowUpNarrowWide, CalendarPlus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ImportButtons } from '../components/ImportExport'
import { PageHeader } from '../components/layout/Shell'
import { TagChip } from '../components/task/bits'
import { QuickAdd } from '../components/task/QuickAdd'
import { TaskRow } from '../components/task/TaskRow'
import { useTaskActions } from '../components/task/useTaskActions'
import { ImageSlot } from '../components/ui/ImageSlot'
import { Button, Card, Empty, IconButton, Segmented, cx } from '../components/ui/primitives'
import { todayISO } from '../lib/dates'
import { PRIORITY_WEIGHT, isOverdue } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import type { Priority, Status, Task } from '../types'

type SortKey = 'priority' | 'deadline' | 'created' | 'title'
type StatusFilter = 'all' | Status
type Extra = 'all' | 'unplanned' | 'overdue' | 'nodeadline'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'priority', label: 'Priorytet' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'created', label: 'Utworzenie' },
  { value: 'title', label: 'Nazwa' },
]

function compare(key: SortKey) {
  return (a: Task, b: Task) => {
    switch (key) {
      case 'priority':
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
      case 'deadline':
        // Zadania bez terminu zawsze na końcu
        return (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
      case 'created':
        return b.createdAt.localeCompare(a.createdAt) || b.id - a.id
      case 'title':
        return a.title.localeCompare(b.title, 'pl')
    }
  }
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

export function BacklogPage() {
  const tasks = useStore((s) => s.tasks)
  const tags = useStore((s) => s.tags)
  const actions = useTaskActions()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [prio, setPrio] = useState<Priority | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [extra, setExtra] = useState<Extra>('all')
  const [sort, setSort] = useState<SortKey>('priority')
  const [reverse, setReverse] = useState(false)
  const today = todayISO()

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    const list = tasks.filter((t) => {
      if (status !== 'all' && t.status !== status) return false
      if (prio !== 'all' && t.priority !== prio) return false
      if (tagFilter.length && !tagFilter.every((tag) => t.tags.includes(tag))) return false
      if (extra === 'unplanned' && t.plannedDate) return false
      if (extra === 'overdue' && !isOverdue(t, today)) return false
      if (extra === 'nodeadline' && t.deadline) return false
      if (nq && !norm(`${t.title} ${t.description} ${t.tags.join(' ')} ${t.subtasks.map((s) => s.title).join(' ')}`).includes(nq)) return false
      return true
    })
    list.sort(compare(sort))
    if (reverse) list.reverse()
    return list
  }, [tasks, q, status, prio, tagFilter, extra, sort, reverse, today])

  const active = q || status !== 'all' || prio !== 'all' || tagFilter.length || extra !== 'all'
  const reset = () => {
    setQ('')
    setStatus('all')
    setPrio('all')
    setTagFilter([])
    setExtra('all')
  }
  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }

  return (
    <div>
      <PageHeader title="Backlog" sub="Wszystkie zadania w jednym miejscu. Szukaj, filtruj, sortuj." actions={<ImportButtons compact />} />

      <QuickAdd />

      <Card className="mt-4 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 basis-64 flex-1 items-center gap-2 rounded-full border border-beige-2 bg-cream px-3.5 focus-within:border-pista-400">
            <Search size={16} className="text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w tytułach, opisach, podzadaniach…" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-ink-3" aria-label="Szukaj zadań" />
            {q && (
              <button type="button" onClick={() => setQ('')} className="cursor-pointer text-ink-3 hover:text-ink" aria-label="Wyczyść wyszukiwanie">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-ink-3">Sortuj:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="cursor-pointer rounded-full border border-beige-2 bg-card px-3 py-1.5 text-sm font-semibold outline-none focus:border-pista-400" aria-label="Sortowanie">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <IconButton label={reverse ? 'Kolejność odwrócona' : 'Odwróć kolejność'} onClick={() => setReverse((v) => !v)} className={reverse ? 'bg-pista-100 text-pista-700' : ''}>
              {reverse ? <ArrowUpNarrowWide size={16} /> : <ArrowDownNarrowWide size={16} />}
            </IconButton>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: `Wszystkie ${counts.all}` },
              { value: 'todo', label: `To Do ${counts.todo}` },
              { value: 'in_progress', label: `In Progress ${counts.in_progress}` },
              { value: 'done', label: `Done ${counts.done}` },
            ]}
          />
          <Segmented
            size="sm"
            value={prio}
            onChange={setPrio}
            options={[
              { value: 'all', label: 'Każdy priorytet' },
              { value: 'wysoki', label: 'Wysoki' },
              { value: 'sredni', label: 'Średni' },
              { value: 'niski', label: 'Niski' },
            ]}
          />
          <Segmented
            size="sm"
            value={extra}
            onChange={setExtra}
            options={[
              { value: 'all', label: 'Wszystko' },
              { value: 'unplanned', label: 'Niezaplanowane' },
              { value: 'overdue', label: 'Po terminie' },
              { value: 'nodeadline', label: 'Bez terminu' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-ink-3">Tagi:</span>
          {tags.map((t) => (
            <TagChip
              key={t.name}
              name={t.name}
              active={tagFilter.includes(t.name)}
              onClick={() => setTagFilter((f) => (f.includes(t.name) ? f.filter((x) => x !== t.name) : [...f, t.name]))}
            />
          ))}
          {active ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={reset}>
              Wyczyść filtry
            </Button>
          ) : null}
        </div>
      </Card>

      <p className="mb-2 mt-5 px-1 text-xs font-bold uppercase tracking-wider text-ink-3">
        {filtered.length} {filtered.length === 1 ? 'zadanie' : 'zadań'}
      </p>
      <div className="space-y-1.5">
        {filtered.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            showStatus
            trailing={
              t.status !== 'done' &&
              t.plannedDate !== today && (
                <IconButton label="Zaplanuj na dziś" className={cx('opacity-60 hover:opacity-100')} onClick={() => actions.planToday(t.id)}>
                  <CalendarPlus size={16} />
                </IconButton>
              )
            }
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <Empty
          title={tasks.length ? 'Nic nie pasuje do filtrów' : 'Backlog jest pusty'}
          slot={<ImageSlot name="pusto" className="h-28 w-40" showHint={false} />}
          action={active ? <Button onClick={reset}>Wyczyść filtry</Button> : undefined}
        >
          {tasks.length ? 'Spróbuj zmienić wyszukiwanie albo filtry.' : 'Dodaj zadanie powyżej lub zaimportuj plik JSON.'}
        </Empty>
      )}
    </div>
  )
}
