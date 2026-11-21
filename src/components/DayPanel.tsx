import { AlarmClock, CheckCircle2, Clock } from 'lucide-react'
import { formatMinutes, longDate, todayISO } from '../lib/dates'
import { statsForDay } from '../lib/stats'
import { dayLoad } from '../lib/suggestions'
import { estimationFactor, isDone } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import type { ISODate } from '../types'
import { QuickAdd } from './task/QuickAdd'
import { TaskRow } from './task/TaskRow'
import { ImageSlot } from './ui/ImageSlot'
import { ProgressBar } from './ui/primitives'

/** Wszystko o jednym dniu: plan, deadline'y, wykonane i statystyki pracy. */
export function DayPanel({ day }: { day: ISODate }) {
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const today = todayISO()
  const st = statsForDay(day, tasks, sessions)
  const { factor } = estimationFactor(tasks, sessions)
  const load = dayLoad(tasks, day, factor)
  const planned = tasks.filter((t) => t.plannedDate === day)
  const deadlines = tasks.filter((t) => t.deadline === day && t.plannedDate !== day)
  const doneElsewhere = st.tasksDone.filter((t) => t.plannedDate !== day && t.deadline !== day)
  const isPast = day < today

  return (
    <div className="space-y-5">
      <div>
        <p className="font-display text-xl font-semibold first-letter:uppercase">{longDate(day)}</p>
        <p className="text-xs text-ink-3">{day === today ? 'Dzisiaj' : isPast ? 'Dzień z przeszłości' : 'Przyszłość'}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Praca" value={formatMinutes(st.focusMin)} />
        <Stat label="Pistacjonki" value={String(st.pistachios)} token />
        <Stat label="Wykonane" value={String(st.tasksDone.length)} />
      </div>

      {!isPast && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-ink-2">
            <span>
              Obciążenie: {load.count} zadań · ~{formatMinutes(load.realisticMin)}
            </span>
            <span>z {formatMinutes(settings.dailyCapacityMin)}</span>
          </div>
          <ProgressBar value={(load.realisticMin / settings.dailyCapacityMin) * 100} tone={load.realisticMin > settings.dailyCapacityMin ? 'warn' : 'caramel'} />
        </div>
      )}

      <QuickAdd defaults={{ plannedDate: day }} placeholder="Dodaj zadanie na ten dzień…" />

      <Group title="Zaplanowane" icon={<Clock size={14} />} empty="Nic nie zaplanowano.">
        {planned
          .sort((a, b) => Number(isDone(a)) - Number(isDone(b)))
          .map((t) => (
            <TaskRow key={t.id} task={t} dense showPlanned={false} />
          ))}
      </Group>

      {deadlines.length > 0 && (
        <Group title="Deadline tego dnia" icon={<AlarmClock size={14} />}>
          {deadlines.map((t) => (
            <TaskRow key={t.id} task={t} dense />
          ))}
        </Group>
      )}

      {doneElsewhere.length > 0 && (
        <Group title="Wykonane tego dnia" icon={<CheckCircle2 size={14} />}>
          {doneElsewhere.map((t) => (
            <TaskRow key={t.id} task={t} dense />
          ))}
        </Group>
      )}

      {st.sessionList.length > 0 && (
        <Group title={`Sesje skupienia (${st.sessions})`}>
          <div className="flex flex-wrap gap-1.5">
            {st.sessionList.map((s) => (
              <span key={s.id} title={`${s.taskTitle ?? 'Bez zadania'} · ${formatMinutes(s.focusMs / 60000)}`} className={s.completed ? '' : 'opacity-35 grayscale'}>
                <ImageSlot name="pistacjonka" variant="token" className="size-7" />
              </span>
            ))}
          </div>
        </Group>
      )}
    </div>
  )
}

function Stat({ label, value, token }: { label: string; value: string; token?: boolean }) {
  return (
    <div className="rounded-2xl bg-cream-2 px-3 py-2">
      <p className="text-[11px] font-semibold text-ink-3">{label}</p>
      <p className="flex items-center gap-1.5 font-display text-lg font-semibold">
        {token && <ImageSlot name="pistacjonka" variant="token" className="size-4" />}
        {value}
      </p>
    </div>
  )
}

function Group({ title, icon, children, empty }: { title: string; icon?: React.ReactNode; children: React.ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-ink-3">
        {icon}
        {title}
      </h3>
      <div className="space-y-1.5">{has ? children : <p className="px-1 text-sm text-ink-3">{empty}</p>}</div>
    </div>
  )
}
