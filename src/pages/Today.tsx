import { AlarmClock, CalendarPlus, Clock, FileJson, Lightbulb, Sparkles, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { loadSample, startImport } from '../components/ImportExport'
import { PageHeader } from '../components/layout/Shell'
import { QuickAdd } from '../components/task/QuickAdd'
import { TaskRow } from '../components/task/TaskRow'
import { useTaskActions } from '../components/task/useTaskActions'
import { ImageSlot } from '../components/ui/ImageSlot'
import { Button, Card, Empty, IconButton, ProgressBar, ProgressRing, SectionTitle } from '../components/ui/primitives'
import { addDaysISO, formatMinutes, longDate, todayISO } from '../lib/dates'
import { statsForDay } from '../lib/stats'
import { suggestTasks } from '../lib/suggestions'
import { PRIORITY_WEIGHT, estimationFactor, isDone, isOverdue } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Task } from '../types'

function greeting(name: string) {
  const h = new Date().getHours()
  const base = h < 5 ? 'Nocna zmiana' : h < 12 ? 'Dzień dobry' : h < 18 ? 'Cześć' : 'Dobry wieczór'
  return name ? `${base}, ${name}` : base
}

const byPriorityDeadline = (a: Task, b: Task) =>
  PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')

export function TodayPage() {
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const settings = useStore((s) => s.settings)
  const dismissed = useStore((s) => s.dismissed)
  const dismiss = useStore((s) => s.dismissSuggestion)
  const openForm = useUI((s) => s.openForm)
  const actions = useTaskActions()
  const today = todayISO()

  const plan = useMemo(() => tasks.filter((t) => t.plannedDate === today), [tasks, today])
  const planOpen = plan.filter((t) => !isDone(t)).sort(byPriorityDeadline)
  const planDone = plan.filter(isDone)
  const overdue = tasks.filter((t) => isOverdue(t, today)).sort((a, b) => a.deadline!.localeCompare(b.deadline!))
  const upcoming = tasks
    .filter((t) => !isDone(t) && t.deadline && t.deadline >= today && t.deadline <= addDaysISO(today, 7))
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
  const { factor } = estimationFactor(tasks, sessions)
  const smart = suggestTasks(tasks, settings, { today, factor, dismissed: dismissed.day === today ? dismissed.ids : [] })
  const dayStats = statsForDay(today, tasks, sessions)
  const pct = plan.length ? Math.round((planDone.length / plan.length) * 100) : 0
  const loadPct = (smart.load.realisticMin / settings.dailyCapacityMin) * 100

  const motivation =
    plan.length === 0
      ? 'Zacznij od zaplanowania dnia – poniżej znajdziesz sugestie.'
      : pct === 100
        ? 'Cały plan upieczony! Możesz odpocząć albo wziąć coś z sugestii.'
        : pct >= 66
          ? 'Świetna robota! Dzisiejszy plan prawie gotowy.'
          : upcoming.some((t) => t.deadline === addDaysISO(today, 1)) || overdue.length
            ? 'Nie odkładaj ciasta na później – deadline się zbliża!'
            : 'Czas upiec kolejną pistacjonkę!'

  if (tasks.length === 0) return <Onboarding />

  return (
    <div className="space-y-6">
      <PageHeader title={greeting(settings.userName)} sub={<span className="first-letter:uppercase">{longDate(today)}</span>} />

      {/* Podsumowanie dnia */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ProgressRing value={pct} size={128} stroke={11}>
              <div className="text-center">
                <p className="font-display text-3xl font-semibold leading-none">{pct}%</p>
                <p className="mt-1 text-[11px] font-semibold text-ink-3">
                  {planDone.length}/{plan.length} zadań
                </p>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold leading-snug">{motivation}</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Metric label="Czas pracy" value={formatMinutes(dayStats.focusMin)} />
                <Metric label="Pistacjonki" value={String(dayStats.pistachios)} token />
                <Metric label="Do zrobienia" value={String(planOpen.length)} />
              </div>
              {planOpen.length > 0 && (
                <p className="mt-4 text-[13px] text-ink-2">
                  <b className="text-ink">Najważniejsze dziś:</b> {planOpen.slice(0, 3).map((t) => t.title).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </Card>
        <ImageSlot name="hero" className="min-h-36 w-full rounded-3xl xl:min-h-0" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Plan dnia */}
        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <SectionTitle
              sub={
                <>
                  Obciążenie: {smart.load.count} zadań · ~{formatMinutes(smart.load.realisticMin)} z {formatMinutes(settings.dailyCapacityMin)}
                  {factor !== 1 && <> (skorygowane ×{factor})</>}
                </>
              }
              action={
                <Button size="sm" variant="ghost" icon={<CalendarPlus size={14} />} onClick={() => openForm({ plannedDate: today })}>
                  Dodaj
                </Button>
              }
            >
              Plan na dziś
            </SectionTitle>
            <ProgressBar value={loadPct} tone={loadPct > 100 ? 'warn' : 'caramel'} className="mb-4 h-1.5" />
            <QuickAdd defaults={{ plannedDate: today }} placeholder="Dodaj do planu na dziś… (#tag !wysoki @jutro ~30m)" />
            <div className="mt-3 space-y-1.5">
              {planOpen.map((t) => (
                <TaskRow key={t.id} task={t} showPlanned={false} />
              ))}
              {plan.length === 0 && (
                <Empty title="Na dziś nic jeszcze nie zaplanowano" slot={<ImageSlot name="pusto" className="h-28 w-40" showHint={false} />}>
                  Przyjmij którąś z sugestii albo przeciągnij zadania na dziś w kalendarzu.
                </Empty>
              )}
              {plan.length > 0 && planOpen.length === 0 && (
                <Empty title="Cały plan upieczony!" slot={<ImageSlot name="gotowe" className="h-28 w-40" showHint={false} />}>
                  Możesz odpocząć albo wziąć coś z sugestii obok.
                </Empty>
              )}
              {planDone.length > 0 && (
                <details className="group pt-2" open={planDone.length <= 3}>
                  <summary className="cursor-pointer list-none px-1 py-1 text-xs font-bold uppercase tracking-wider text-ink-3 hover:text-ink-2">
                    Upieczone dziś ({planDone.length})
                  </summary>
                  <div className="mt-1 space-y-1.5">
                    {planDone.map((t) => (
                      <TaskRow key={t.id} task={t} showPlanned={false} dense />
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Card>

          {overdue.length > 0 && (
            <Card className="border-rose bg-[color-mix(in_srgb,var(--color-rose)_25%,var(--color-card))] p-4 sm:p-5">
              <SectionTitle sub="Te zadania minęły termin – zaplanuj je albo zamknij.">
                <span className="flex items-center gap-2 text-prio-high">
                  <AlarmClock size={18} /> Po terminie ({overdue.length})
                </span>
              </SectionTitle>
              <div className="space-y-1.5">
                {overdue.slice(0, 6).map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    dense
                    trailing={
                      t.plannedDate !== today && (
                        <IconButton label="Zaplanuj na dziś" onClick={() => actions.planToday(t.id)}>
                          <CalendarPlus size={16} />
                        </IconButton>
                      )
                    }
                  />
                ))}
                {overdue.length > 6 && (
                  <Link to="/backlog" className="block px-2 pt-1 text-xs font-semibold text-prio-high hover:underline">
                    + {overdue.length - 6} więcej w backlogu
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Smart sugestie */}
          <Card className="border-pista-200 bg-gradient-to-b from-pista-50 to-card p-4 sm:p-5">
            <SectionTitle sub={smart.planFull ? 'Dzisiejszy plan jest już pełny – proponuję tylko to, co naprawdę pilne.' : 'Wybrane algorytmem na podstawie terminów, priorytetów i Twojego obciążenia.'}>
              <span className="flex items-center gap-2">
                <Sparkles size={18} className="text-pista-600" /> Sugestie na dziś
              </span>
            </SectionTitle>
            <div className="space-y-2.5">
              {smart.suggestions.map((s, i) => (
                <div key={s.task.id} className="animate-rise rounded-2xl border border-pista-100 bg-card p-3.5 shadow-soft" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-pista-100 font-display text-sm font-bold text-pista-700" title="Wynik punktowy">
                      {s.score}
                    </span>
                    <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => useUI.getState().openDetail(s.task.id)}>
                      <p className="font-semibold leading-snug">{s.task.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.reasons.map((r) => (
                          <span key={r.label} className={r.points < 0 ? 'rounded-full bg-beige px-2 py-0.5 text-[11px] text-ink-3' : 'rounded-full bg-pista-50 px-2 py-0.5 text-[11px] font-semibold text-pista-700'}>
                            {r.label} {r.points > 0 ? `+${r.points}` : r.points}
                          </span>
                        ))}
                      </div>
                    </button>
                  </div>
                  <div className="mt-3 flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={() => dismiss(s.task.id)}>
                      Nie dziś
                    </Button>
                    <Button size="sm" variant="primary" icon={<CalendarPlus size={13} />} onClick={() => actions.planToday(s.task.id)}>
                      Do planu
                    </Button>
                  </div>
                </div>
              ))}
              {smart.suggestions.length === 0 && (
                <Empty title="Brak sugestii" slot={<Lightbulb className="text-pista-400" />}>
                  Wszystko, co pilne, jest już w planie albo zrobione.
                </Empty>
              )}
            </div>
          </Card>

          {/* Nadchodzące terminy */}
          <Card className="p-4 sm:p-5">
            <SectionTitle sub="Najbliższe 7 dni">
              <span className="flex items-center gap-2">
                <Clock size={18} className="text-caramel-500" /> Zbliżające się terminy
              </span>
            </SectionTitle>
            <div className="space-y-1.5">
              {upcoming.slice(0, 7).map((t) => (
                <TaskRow key={t.id} task={t} dense />
              ))}
              {upcoming.length === 0 && <p className="px-1 py-3 text-sm text-ink-3">Żadnych terminów w tym tygodniu. Spokojnie!</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, token }: { label: string; value: string; token?: boolean }) {
  return (
    <div className="rounded-2xl bg-cream-2 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-ink-3">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-display text-xl font-semibold">
        {token && <ImageSlot name="pistacjonka" variant="token" className="size-4" />}
        {value}
      </p>
    </div>
  )
}

function Onboarding() {
  const openForm = useUI((s) => s.openForm)
  return (
    <div className="mx-auto max-w-3xl py-6">
      <Card className="overflow-hidden">
        <div className="grid sm:grid-cols-[1fr_1.1fr]">
          <ImageSlot name="hero" className="min-h-56 rounded-none border-0 border-b-2 sm:border-b-0 sm:border-r-2" />
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-caramel-500">Witaj w Pistacjonce</p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">Planer, który podpowiada, co upiec dziś.</h1>
            <p className="mt-3 text-[15px] text-ink-2">
              Dodaj zadania albo wczytaj je z pliku JSON. Pistacjonka zaproponuje plan dnia, przypilnuje terminów, a każda ukończona sesja skupienia to jedna upieczona pistacjonka.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="primary" size="lg" icon={<FileJson size={18} />} onClick={startImport}>
                Wczytaj zadania z pliku JSON
              </Button>
              <Button size="lg" onClick={loadSample}>
                Wypróbuj na przykładowych zadaniach
              </Button>
              <Button variant="ghost" onClick={() => openForm()}>
                Dodaj pierwsze zadanie ręcznie
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
