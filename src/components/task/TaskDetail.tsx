import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CalendarPlus, Check, Clock, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addDaysISO, formatMinutes, todayISO } from '../../lib/dates'
import { actualMinutes, estimationFactor, isDone, subtaskProgress } from '../../lib/taskUtils'
import { useStore, useTask } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { Priority, Status } from '../../types'
import { ImageSlot } from '../ui/ImageSlot'
import { Button, IconButton, Modal, ProgressBar, Segmented, cx, inputCls } from '../ui/primitives'
import { DoneToggle } from './bits'
import { TagPicker } from './TagPicker'
import { useTaskActions } from './useTaskActions'

const STATUS_OPTS: { value: Status; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]
const PRIO_OPTS: { value: Priority; label: string }[] = [
  { value: 'niski', label: 'Niski' },
  { value: 'sredni', label: 'Średni' },
  { value: 'wysoki', label: 'Wysoki' },
]

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-3">{children}</h3>
}

function DateField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; hint: string }) {
  const today = todayISO()
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        <input type="date" className={cx(inputCls, 'py-2')} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label} />
        {value && (
          <IconButton label={`Wyczyść: ${label}`} onClick={() => onChange(null)}>
            <X size={15} />
          </IconButton>
        )}
      </div>
      <div className="mt-1.5 flex gap-1">
        {[
          ['Dziś', today],
          ['Jutro', addDaysISO(today, 1)],
          ['+7 dni', addDaysISO(today, 7)],
        ].map(([l, d]) => (
          <button key={l} type="button" onClick={() => onChange(d)} className={cx('cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-semibold transition', value === d ? 'bg-pista-500 text-white' : 'bg-beige/70 text-ink-2 hover:bg-beige')}>
            {l}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-3">{hint}</p>
    </div>
  )
}

export function TaskDetail() {
  const detailId = useUI((s) => s.detailId)
  const close = useUI((s) => s.closeDetail)
  const task = useTask(detailId)
  return (
    <Modal open={!!task} onClose={close} side title={task ? <span className="text-ink-3 text-sm font-sans font-semibold">Zadanie #{task.id}</span> : ''}>
      {task && <DetailBody key={task.id} id={task.id} />}
    </Modal>
  )
}

function DetailBody({ id }: { id: number }) {
  const task = useTask(id)!
  const s = useStore()
  const toast = useUI((x) => x.toast)
  const actions = useTaskActions()
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description)
  const [newSub, setNewSub] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => setTitle(task.title), [task.title])
  useEffect(() => setDesc(task.description), [task.description])

  const sp = subtaskProgress(task)
  const sessions = useMemo(() => s.sessions.filter((x) => x.taskId === id).sort((a, b) => b.endedAt.localeCompare(a.endedAt)), [s.sessions, id])
  const actual = actualMinutes(task, s.sessions)
  const { factor, sample } = estimationFactor(s.tasks, s.sessions)
  const pistachios = sessions.filter((x) => x.completed).length
  const timerHere = s.timer.phase !== 'idle' && s.timer.taskId === id
  const done = isDone(task)

  const commitTitle = () => {
    const t = title.trim()
    if (t && t !== task.title) s.updateTask(id, { title: t })
    else setTitle(task.title)
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Tytuł */}
      <div className="flex items-start gap-3">
        <div className="pt-1.5">
          <DoneToggle done={done} onToggle={() => actions.toggle(id)} size={26} />
        </div>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
          rows={1}
          aria-label="Tytuł zadania"
          className={cx('field-sizing-content w-full resize-none rounded-xl bg-transparent px-1 font-display text-2xl font-semibold leading-tight outline-none hover:bg-beige/50 focus:bg-card focus:ring-2 focus:ring-pista-200', done && 'text-ink-3 line-through decoration-pista-400')}
        />
      </div>

      <div className="grid gap-4">
        <div>
          <Label>Status</Label>
          <Segmented value={task.status} options={STATUS_OPTS} onChange={(v) => actions.setStatus(id, v)} />
        </div>
        <div>
          <Label>Priorytet</Label>
          <Segmented value={task.priority} options={PRIO_OPTS} onChange={(v) => s.updateTask(id, { priority: v })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField label="Deadline" value={task.deadline} onChange={(v) => s.updateTask(id, { deadline: v })} hint="Ostateczny termin (eksportowany jako „termin”)." />
        <DateField label="Planowana realizacja" value={task.plannedDate} onChange={(v) => s.planTask(id, v)} hint="Dzień, w którym chcesz to zrobić." />
      </div>

      <div>
        <Label>Opis</Label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== task.description && s.updateTask(id, { description: desc })}
          placeholder="Dodaj opis…"
          className={cx(inputCls, 'min-h-24 resize-y')}
        />
      </div>

      <div>
        <Label>Tagi</Label>
        <TagPicker value={task.tags} onChange={(tags) => s.updateTask(id, { tags })} />
      </div>

      {/* Podzadania */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Podzadania</Label>
          {sp.total > 0 && (
            <span className="text-xs font-bold text-pista-700">
              {sp.done}/{sp.total} wykonane – {sp.pct}%
            </span>
          )}
        </div>
        {sp.total > 0 && <ProgressBar value={sp.pct} className="mb-3" />}
        <ul className="space-y-1">
          {task.subtasks.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-beige/50">
              <DoneToggle done={sub.done} onToggle={() => s.toggleSubtask(id, sub.id)} size={19} />
              <input
                defaultValue={sub.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== sub.title && s.renameSubtask(id, sub.id, e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className={cx('min-w-0 flex-1 bg-transparent text-sm outline-none', sub.done && 'text-ink-3 line-through')}
                aria-label="Treść podzadania"
              />
              <IconButton label="Usuń podzadanie" className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => s.deleteSubtask(id, sub.id)}>
                <X size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
        <form
          className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-beige-2 px-3 py-1 focus-within:border-pista-400"
          onSubmit={(e) => {
            e.preventDefault()
            s.addSubtask(id, newSub)
            setNewSub('')
          }}
        >
          <Plus size={15} className="text-pista-500" />
          <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Dodaj podzadanie i naciśnij Enter" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-ink-3" />
        </form>
        {sp.total > 0 && sp.done === sp.total && !done && (
          <button type="button" onClick={() => actions.setStatus(id, 'done')} className="mt-2 cursor-pointer text-xs font-semibold text-pista-700 underline-offset-2 hover:underline">
            Wszystkie podzadania gotowe – oznaczyć całe zadanie jako zrobione?
          </button>
        )}
      </div>

      {/* Czas */}
      <div className="rounded-3xl bg-beige/50 p-4">
        <Label>Czas pracy</Label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-ink-2">Szacowany (min)</span>
            <input
              type="number"
              min={0}
              step={5}
              defaultValue={task.estimateMin ?? ''}
              key={task.estimateMin ?? 'none'}
              onBlur={(e) => {
                const v = Number(e.target.value)
                s.updateTask(id, { estimateMin: e.target.value && v > 0 ? Math.round(v) : null })
              }}
              className={cx(inputCls, 'mt-1 py-2')}
            />
          </label>
          <div>
            <span className="text-xs text-ink-2">Rzeczywisty</span>
            <p className="mt-1 font-display text-2xl font-semibold">{formatMinutes(actual)}</p>
          </div>
        </div>
        {task.estimateMin ? (
          <div className="mt-3">
            <ProgressBar value={(actual / task.estimateMin) * 100} tone={actual > task.estimateMin ? 'warn' : 'pista'} />
            <p className="mt-1.5 text-xs text-ink-2">
              {actual > task.estimateMin
                ? `Przekroczono szacunek o ${formatMinutes(actual - task.estimateMin)}.`
                : `Zostało ok. ${formatMinutes(task.estimateMin - actual)} z szacunku.`}
              {sample >= 2 && factor !== 1 && (
                <> Twoja historia: realnie ~{formatMinutes(task.estimateMin * factor)} (współczynnik ×{factor}).</>
              )}
            </p>
          </div>
        ) : null}
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = Math.round(Number(manual))
            if (!v) return
            s.updateTask(id, { manualMin: Math.max(0, (task.manualMin || 0) + v) })
            setManual('')
            toast(v > 0 ? `Dopisano ${formatMinutes(v)} pracy.` : 'Skorygowano czas.', 'info')
          }}
        >
          <Clock size={15} className="text-ink-3" />
          <input type="number" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Dopisz minuty spoza timera" className="min-w-0 flex-1 rounded-xl border border-beige-2 bg-card px-3 py-1.5 text-sm outline-none focus:border-pista-400" />
          <Button size="sm" type="submit" disabled={!manual}>
            Dopisz
          </Button>
        </form>
      </div>

      {/* Pomodoro */}
      <div className="overflow-hidden rounded-3xl border border-caramel-200 bg-gradient-to-br from-caramel-100/70 to-cream p-4">
        <div className="flex items-center gap-4">
          <ImageSlot name="pistacjonka" variant="token" className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold">Pieczenie pistacjonek</p>
            <p className="text-xs text-ink-2">
              {pistachios === 0 ? 'Jeszcze nic nie upieczono przy tym zadaniu.' : `Upieczono ${pistachios} ${pistachios === 1 ? 'pistacjonkę' : pistachios < 5 ? 'pistacjonki' : 'pistacjonek'} przy tym zadaniu.`}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!timerHere && (
            <Button variant="caramel" icon={<Play size={15} />} onClick={() => (s.timerStart(id), toast('Czas upiec kolejną pistacjonkę!', 'info'))} disabled={done}>
              Upiecz pistacjonkę ({s.settings.workMin} min)
            </Button>
          )}
          {timerHere && s.timer.runningSince !== null && (
            <Button icon={<Pause size={15} />} onClick={s.timerPause}>
              Pauza
            </Button>
          )}
          {timerHere && s.timer.runningSince === null && (
            <Button variant="caramel" icon={<Play size={15} />} onClick={s.timerResume}>
              Wznów
            </Button>
          )}
          {!task.plannedDate || task.plannedDate !== todayISO() ? (
            <Button icon={<CalendarPlus size={15} />} onClick={() => actions.planToday(id)} disabled={done}>
              Zaplanuj na dziś
            </Button>
          ) : null}
        </div>
        {sessions.length > 0 && (
          <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto">
            {sessions.map((x) => (
              <li key={x.id} className="flex items-center gap-2 rounded-lg bg-card/70 px-3 py-1.5 text-xs">
                {x.completed ? <Check size={13} className="text-pista-600" /> : <X size={13} className="text-ink-3" />}
                <span className="font-semibold">{format(new Date(x.endedAt), 'd MMM, HH:mm', { locale: pl })}</span>
                <span className="text-ink-2">{formatMinutes(x.focusMs / 60000)}</span>
                <span className="ml-auto text-ink-3">{x.completed ? 'pełna sesja' : 'przerwana'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-beige pt-4 text-xs text-ink-3">
        <span>
          Utworzono {format(new Date(task.createdAt), 'd MMM yyyy, HH:mm', { locale: pl })}
          {task.completedAt && <> · ukończono {format(new Date(task.completedAt), 'd MMM, HH:mm', { locale: pl })}</>}
        </span>
        <Button variant="ghost" size="sm" className="text-prio-high hover:bg-rose/60 hover:text-prio-high" icon={<Trash2 size={14} />} onClick={() => actions.remove(id)}>
          Usuń
        </Button>
      </div>
    </div>
  )
}
