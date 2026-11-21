import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Flame, Pause, Play, SkipForward, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/Shell'
import { useNow } from '../components/layout/TimerEngine'
import { ImageSlot } from '../components/ui/ImageSlot'
import { Button, Card, ProgressRing, SectionTitle, cx } from '../components/ui/primitives'
import { addDaysISO, dayOf, fmt, formatClock, formatMinutes, relativeDay, todayISO } from '../lib/dates'
import { elapsedMs, remainingMs } from '../lib/pomodoro'
import { bakingStreak } from '../lib/stats'
import { PRIORITY_WEIGHT, isDone } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'

const plural = (n: number) => (n === 1 ? 'pistacjonka' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'pistacjonki' : 'pistacjonek')

export function BakeryPage() {
  const s = useStore()
  const ask = useUI((x) => x.ask)
  const toast = useUI((x) => x.toast)
  const now = useNow(250)
  const today = todayISO()
  const { timer, settings } = s
  const [pick, setPick] = useState<number | null>(timer.taskId)

  const candidates = useMemo(
    () =>
      s.tasks
        .filter((t) => !isDone(t))
        .sort(
          (a, b) =>
            Number(b.plannedDate === today) - Number(a.plannedDate === today) ||
            Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
            PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
        ),
    [s.tasks, today],
  )
  const selectedId = timer.phase === 'work' ? timer.taskId : pick
  const task = s.tasks.find((t) => t.id === selectedId)

  const rem = timer.phase === 'idle' ? settings.workMin * 60000 : remainingMs(timer, now)
  const pct = timer.phase === 'idle' ? 0 : (elapsedMs(timer, now) / timer.durationMs) * 100
  const running = timer.runningSince !== null
  const completed = s.sessions.filter((x) => x.completed)
  const todayCount = completed.filter((x) => dayOf(x.endedAt) === today).length
  const streak = bakingStreak(s.sessions, today)
  const cyclePos = timer.cycleCount % settings.sessionsUntilLongBreak

  const stop = () =>
    ask({
      title: 'Wyjąć ciasto przed czasem?',
      body: 'Przepracowany czas zapisze się w statystykach, ale za nieukończoną sesję nie dostaniesz pistacjonki.',
      confirmLabel: 'Przerwij sesję',
      danger: true,
      onConfirm: () => {
        s.timerStop()
        toast('Sesja przerwana – czas pracy zapisany.', 'info')
      },
    })

  // Kolekcja pogrupowana po dniach (ostatnie 14 dni z wypiekami)
  const byDay = useMemo(() => {
    const m = new Map<string, typeof completed>()
    for (const x of [...completed].sort((a, b) => b.endedAt.localeCompare(a.endedAt))) {
      const d = dayOf(x.endedAt)
      m.set(d, [...(m.get(d) ?? []), x])
    }
    return [...m.entries()].slice(0, 14)
  }, [completed])

  const phaseLabel =
    timer.phase === 'work' ? (running ? 'Pieczenie trwa' : 'Piekarnik wstrzymany') : timer.phase === 'break' ? (timer.longBreak ? 'Długa przerwa' : 'Przerwa – ciasto odpoczywa') : 'Piekarnik gotowy'

  return (
    <div>
      <PageHeader title="Piekarnia" sub="Pomodoro w wersji cukierniczej: 1 ukończona sesja skupienia = 1 upieczona pistacjonka." />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        {/* Piekarnik */}
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div className={cx('pointer-events-none absolute inset-0 transition-opacity duration-700', timer.phase === 'work' && running ? 'opacity-100' : 'opacity-0')} style={{ background: 'radial-gradient(circle at 50% 40%, rgb(227 178 122 / 0.22), transparent 60%)' }} />
          <div className="relative flex flex-col items-center text-center">
            <p className={cx('rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider', timer.phase === 'work' ? 'bg-caramel-100 text-caramel-600' : timer.phase === 'break' ? 'bg-pista-100 text-pista-700' : 'bg-beige text-ink-2')}>{phaseLabel}</p>
            <div className={cx('mt-6 rounded-full', timer.phase === 'work' && running && 'animate-bake')}>
              <ProgressRing value={pct} size={260} stroke={14} color={timer.phase === 'break' ? 'var(--color-pista-400)' : 'var(--color-caramel-400)'}>
                <div className="flex flex-col items-center">
                  <ImageSlot name={timer.phase === 'work' ? 'ciasto' : 'pistacjonka'} variant="token" className={cx('size-24 transition-transform duration-700', timer.phase === 'work' && running && 'scale-105')} />
                  <p className="mt-3 font-display text-5xl font-semibold tabular-nums tracking-tight">{formatClock(rem)}</p>
                </div>
              </ProgressRing>
            </div>

            <div className="mt-4 flex gap-1.5" title="Sesje do długiej przerwy">
              {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
                <span key={i} className={cx('size-2.5 rounded-full transition', i < cyclePos || (timer.phase === 'break' && timer.longBreak) ? 'bg-caramel-400' : 'bg-beige-2')} />
              ))}
            </div>

            <div className="mt-6 w-full max-w-sm">
              {timer.phase === 'idle' ? (
                <select
                  value={pick ?? ''}
                  onChange={(e) => setPick(e.target.value ? Number(e.target.value) : null)}
                  className="w-full cursor-pointer rounded-2xl border border-beige-2 bg-card px-4 py-3 text-sm font-semibold outline-none focus:border-pista-400"
                  aria-label="Zadanie do pieczenia"
                >
                  <option value="">— Sesja bez przypisanego zadania —</option>
                  {candidates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.plannedDate === today ? '★ ' : ''}
                      {t.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-ink-2">
                  {timer.phase === 'work' ? 'Pieczesz przy: ' : 'Ostatnio: '}
                  {task ? (
                    <button type="button" className="cursor-pointer font-bold text-ink underline-offset-2 hover:underline" onClick={() => useUI.getState().openDetail(task.id)}>
                      {task.title}
                    </button>
                  ) : (
                    <b>sesja bez zadania</b>
                  )}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {timer.phase === 'idle' && (
                <Button variant="caramel" size="lg" icon={<Play size={18} />} onClick={() => (s.timerStart(pick), toast('Czas upiec kolejną pistacjonkę!', 'info'))}>
                  Wstaw do pieca ({settings.workMin} min)
                </Button>
              )}
              {timer.phase !== 'idle' &&
                (running ? (
                  <Button size="lg" icon={<Pause size={18} />} onClick={s.timerPause}>
                    Pauza
                  </Button>
                ) : (
                  <Button variant="caramel" size="lg" icon={<Play size={18} />} onClick={s.timerResume}>
                    {timer.phase === 'break' && timer.accumulatedMs === 0 ? 'Zacznij przerwę' : 'Wznów'}
                  </Button>
                ))}
              {timer.phase === 'work' && (
                <Button size="lg" variant="ghost" icon={<Square size={16} />} onClick={stop}>
                  Przerwij
                </Button>
              )}
              {timer.phase === 'break' && (
                <Button size="lg" variant="ghost" icon={<SkipForward size={16} />} onClick={s.timerSkipBreak}>
                  Pomiń przerwę
                </Button>
              )}
            </div>
            <p className="mt-5 max-w-sm text-xs text-ink-3">
              Timer liczy czas od zapisanego momentu startu, więc odświeżenie strony ani zamknięcie karty go nie zatrzyma. Przerwane sesje wliczają się do czasu pracy, ale nie do kolekcji.
            </p>
          </div>
        </Card>

        {/* Kolekcja */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="font-display text-3xl font-semibold text-caramel-600">{completed.length}</p>
              <p className="text-xs font-semibold text-ink-3">w kolekcji</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-display text-3xl font-semibold">{todayCount}</p>
              <p className="text-xs font-semibold text-ink-3">dziś</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="flex items-center justify-center gap-1 font-display text-3xl font-semibold">
                {streak}
                {streak > 0 && <Flame size={20} className="text-caramel-400" />}
              </p>
              <p className="text-xs font-semibold text-ink-3">dni z rzędu</p>
            </Card>
          </div>

          <Card className="p-5">
            <SectionTitle sub={completed.length ? `Razem ${formatMinutes(completed.reduce((a, x) => a + x.focusMs, 0) / 60000)} pełnego skupienia.` : undefined}>Twoja witryna</SectionTitle>
            {byDay.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <ImageSlot name="pistacjonka" className="size-36" />
                <p className="mt-4 font-display text-base font-semibold">Witryna jeszcze pusta</p>
                <p className="mt-1 max-w-xs text-sm text-ink-2">Ukończ pierwszą sesję skupienia, a tu pojawi się Twoja pierwsza pistacjonka.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {byDay.map(([day, list]) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
                      {day === today ? 'Dziś' : day === addDaysISO(today, -1) ? 'Wczoraj' : fmt(day, 'EEEE, d MMM')} · {list.length} {plural(list.length)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((x, i) => (
                        <div key={x.id} className="group relative animate-pop" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                          <ImageSlot name="pistacjonka" variant="token" className="size-11 transition group-hover:-translate-y-0.5" />
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-52 -translate-x-1/2 rounded-xl bg-ink px-2.5 py-1.5 text-left text-[11px] text-cream opacity-0 shadow-lift transition group-hover:opacity-100">
                            <b>{x.taskTitle ?? 'Sesja bez zadania'}</b>
                            <br />
                            {format(new Date(x.endedAt), 'HH:mm', { locale: pl })} · {formatMinutes(x.focusMs / 60000)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Ostatnie sesje</SectionTitle>
            <ul className="space-y-1.5">
              {[...s.sessions]
                .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
                .slice(0, 8)
                .map((x) => (
                  <li key={x.id} className="flex items-center gap-3 rounded-xl bg-cream-2/70 px-3 py-2 text-sm">
                    <span className={x.completed ? '' : 'opacity-35 grayscale'}>
                      <ImageSlot name="pistacjonka" variant="token" className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{x.taskTitle ?? 'Sesja bez zadania'}</span>
                    <span className="text-xs text-ink-2">{formatMinutes(x.focusMs / 60000)}</span>
                    <span className="w-20 text-right text-xs text-ink-3">{relativeDay(dayOf(x.endedAt))}</span>
                  </li>
                ))}
              {s.sessions.length === 0 && <p className="text-sm text-ink-3">Brak sesji.</p>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
