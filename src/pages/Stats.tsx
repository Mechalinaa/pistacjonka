import { CalendarSearch, Clock, ListChecks, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DayPanel } from '../components/DayPanel'
import { PageHeader } from '../components/layout/Shell'
import { ImageSlot } from '../components/ui/ImageSlot'
import { Card, Empty, Segmented, SectionTitle, cx, inputCls } from '../components/ui/primitives'
import { addDaysISO, daysBetween, fmt, formatMinutes, fromISO, todayISO } from '../lib/dates'
import { dailySeries, statsForDay, totals, type SeriesPoint } from '../lib/stats'
import { STATUS_SHORT, actualMinutes, estimationFactor } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import type { Status } from '../types'

/* Paleta wykresów – zwalidowana pod kątem daltonizmu (dataviz validator). */
const C = {
  focus: '#7b9d42',
  done: '#b8773a',
  status: { todo: '#8a7cc0', in_progress: '#d08f4a', done: '#4f6d2a' } as Record<Status, string>,
  heat: ['#efe5d3', '#cfe0ad', '#a9c674', '#7b9d42', '#4c6329'],
  grid: '#efe5d3',
  axis: '#a19282',
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: SeriesPoint; value: number }[]; unit: 'min' | 'tasks' }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-beige bg-card px-3 py-2 text-xs shadow-lift">
      <p className="font-bold first-letter:uppercase">{fmt(p.day, 'EEEE, d MMM')}</p>
      <p className="mt-0.5 text-ink-2">{unit === 'min' ? `Praca: ${formatMinutes(p.focusMin)} · ${p.pistachios} pistacjonek` : `Wykonane zadania: ${p.tasksDone}`}</p>
      <p className="mt-1 text-[10px] text-ink-3">Kliknij, aby zobaczyć dzień</p>
    </div>
  )
}

export function StatsPage() {
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const [range, setRange] = useState<'7' | '30'>('7')
  const today = todayISO()
  const [day, setDay] = useState(today)

  const series = useMemo(() => dailySeries(Number(range), tasks, sessions, today), [range, tasks, sessions, today])
  const tot = totals(tasks, sessions)
  const todayStats = statsForDay(today, tasks, sessions)
  const rangeFocus = series.reduce((a, p) => a + p.focusMin, 0)
  const rangeDone = series.reduce((a, p) => a + p.tasksDone, 0)
  const activeDays = series.filter((p) => p.focusMin > 0 || p.tasksDone > 0).length
  const { factor, sample } = estimationFactor(tasks, sessions)
  const xFmt = (d: string) => (range === '7' ? fmt(d, 'EEEEEE') : fmt(d, 'd.MM'))
  const onBarClick = (d: unknown) => {
    const p = (d as { payload?: SeriesPoint })?.payload
    if (p?.day) setDay(p.day)
  }

  const estRows = tasks
    .map((t) => ({ t, act: actualMinutes(t, sessions) }))
    .filter((r) => r.t.estimateMin || r.act >= 1)
    .sort((a, b) => b.act - a.act)
    .slice(0, 10)
  const estMax = Math.max(1, ...estRows.map((r) => Math.max(r.act, r.t.estimateMin ?? 0)))

  const tagTime = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions) {
      const t = tasks.find((x) => x.id === s.taskId)
      for (const tag of t?.tags.length ? t.tags : ['bez tagu']) m.set(tag, (m.get(tag) ?? 0) + s.focusMs / 60000)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [sessions, tasks])
  const tagMax = Math.max(1, ...tagTime.map((x) => x[1]))

  return (
    <div className="space-y-6">
      <PageHeader title="Statystyki" sub="Wszystko liczone z Twoich prawdziwych danych: ukończonych zadań i sesji skupienia." />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Clock size={16} />} label="Dziś pracy" value={formatMinutes(todayStats.focusMin)} sub={`${todayStats.sessions} sesji`} />
        <Kpi icon={<ListChecks size={16} />} label="Dziś wykonane" value={String(todayStats.tasksDone.length)} sub={`${todayStats.remaining.length} zostało na dziś`} />
        <Kpi icon={<ImageSlot name="pistacjonka" variant="token" className="size-4" />} label="Pistacjonki łącznie" value={String(tot.pistachios)} sub={`${todayStats.pistachios} dziś`} />
        <Kpi icon={<Target size={16} />} label="Łączny czas pracy" value={formatMinutes(tot.focusMin + tot.manualMin)} sub={`${tot.tasksDone} zadań wykonanych`} />
      </div>

      {/* Aktywność */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Aktywność – ostatnie {range} dni</h2>
            <p className="text-[13px] text-ink-3">
              {formatMinutes(rangeFocus)} pracy · {rangeDone} wykonanych zadań · aktywne dni: {activeDays}/{range}
            </p>
          </div>
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 dni' },
              { value: '30', label: '30 dni' },
            ]}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Minuty skupienia dziennie</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap={range === '7' ? '30%' : '18%'}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="day" tickFormatter={xFmt} tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} interval={range === '7' ? 0 : 4} />
                  <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgb(239 229 211 / 0.5)' }} content={<ChartTooltip unit="min" />} />
                  <Bar dataKey="focusMin" fill={C.focus} radius={[4, 4, 0, 0]} onClick={onBarClick} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">Wykonane zadania dziennie</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap={range === '7' ? '30%' : '18%'}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="day" tickFormatter={xFmt} tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} interval={range === '7' ? 0 : 4} />
                  <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgb(239 229 211 / 0.5)' }} content={<ChartTooltip unit="tasks" />} />
                  <Bar dataKey="tasksDone" fill={C.done} radius={[4, 4, 0, 0]} onClick={onBarClick} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Heatmap selected={day} onSelect={setDay} />

          {/* Statusy */}
          <Card className="p-4 sm:p-6">
            <SectionTitle sub={`${tasks.length} zadań łącznie`}>Zadania wg statusu</SectionTitle>
            {tasks.length > 0 ? (
              <>
                <div className="flex h-4 gap-[2px] overflow-hidden rounded-full">
                  {(['todo', 'in_progress', 'done'] as Status[]).map((s) =>
                    tot.byStatus[s] ? <div key={s} style={{ flex: tot.byStatus[s], background: C.status[s] }} title={`${STATUS_SHORT[s]}: ${tot.byStatus[s]}`} /> : null,
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {(['todo', 'in_progress', 'done'] as Status[]).map((s) => (
                    <div key={s} className="flex items-center gap-2 text-sm">
                      <span className="size-3 rounded" style={{ background: C.status[s] }} />
                      <span className="text-ink-2">{STATUS_SHORT[s]}</span>
                      <b>{tot.byStatus[s]}</b>
                      <span className="text-xs text-ink-3">({Math.round((tot.byStatus[s] / tasks.length) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-3">Brak zadań.</p>
            )}
          </Card>

          {/* Szacunek vs rzeczywistość */}
          <Card className="p-4 sm:p-6">
            <SectionTitle
              sub={
                sample >= 2
                  ? factor > 1.1
                    ? `Na podstawie ${sample} zadań: realnie pracujesz ×${factor} dłużej niż szacujesz. Planer uwzględnia to przy planowaniu dnia.`
                    : factor < 0.9
                      ? `Na podstawie ${sample} zadań: kończysz szybciej niż szacujesz (×${factor}).`
                      : `Na podstawie ${sample} zadań: Twoje szacunki są trafne (×${factor}).`
                  : 'Ukończ co najmniej 2 zadania z szacowanym czasem, a policzę Twój współczynnik estymacji.'
              }
            >
              Szacowany vs rzeczywisty czas
            </SectionTitle>
            {estRows.length === 0 ? (
              <Empty title="Brak danych o czasie">Ustaw szacowany czas w zadaniach i pracuj z timerem, a porównanie pojawi się tutaj.</Empty>
            ) : (
              <div className="space-y-3">
                {estRows.map(({ t, act }) => {
                  const over = !!t.estimateMin && act > t.estimateMin
                  return (
                    <div key={t.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{t.title}</span>
                        <span className={cx('shrink-0 text-xs', over ? 'font-bold text-prio-high' : 'text-ink-2')}>
                          {formatMinutes(act)} / {t.estimateMin ? formatMinutes(t.estimateMin) : '—'}
                        </span>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-beige">
                        <div className="h-full rounded-full" style={{ width: `${(act / estMax) * 100}%`, background: over ? 'var(--color-prio-high)' : C.focus }} />
                        {t.estimateMin ? (
                          <div className="absolute -top-1 h-[18px] w-[3px] rounded-full bg-ink" style={{ left: `calc(${(t.estimateMin / estMax) * 100}% - 1.5px)` }} title={`Szacunek: ${formatMinutes(t.estimateMin)}`} />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                <p className="flex items-center gap-4 pt-1 text-xs text-ink-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-5 rounded-full" style={{ background: C.focus }} /> rzeczywisty
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-[3px] rounded-full bg-ink" /> szacowany
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-5 rounded-full bg-prio-high" /> przekroczony
                  </span>
                </p>
              </div>
            )}
          </Card>

          {tagTime.length > 0 && (
            <Card className="p-4 sm:p-6">
              <SectionTitle sub="Czas sesji skupienia przypisany do tagów zadań">Na co idzie Twój czas</SectionTitle>
              <div className="space-y-2.5">
                {tagTime.map(([tag, min]) => (
                  <div key={tag} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-sm">
                    <span className="truncate font-semibold">{tag}</span>
                    <div className="h-2.5 rounded-full bg-beige">
                      <div className="h-full rounded-full" style={{ width: `${(min / tagMax) * 100}%`, background: C.focus }} />
                    </div>
                    <span className="text-right text-xs text-ink-2">{formatMinutes(min)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Dowolny dzień */}
        <Card className="p-4 sm:p-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto">
          <div className="mb-4 flex items-center gap-2">
            <CalendarSearch size={18} className="text-pista-600" />
            <h2 className="font-display text-lg font-semibold">Statystyki dnia</h2>
          </div>
          <input type="date" value={day} max={addDaysISO(today, 365)} onChange={(e) => e.target.value && setDay(e.target.value)} className={cx(inputCls, 'mb-4 py-2')} aria-label="Wybierz dzień" />
          <DayPanel day={day} />
        </Card>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-3">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{value}</p>
      <p className="text-xs text-ink-3">{sub}</p>
    </Card>
  )
}

/** Mapa ciepła ostatnich 18 tygodni – minuty skupienia + wykonane zadania. Klik = szczegóły dnia. */
function Heatmap({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const tasks = useStore((s) => s.tasks)
  const sessions = useStore((s) => s.sessions)
  const today = todayISO()
  const weeks = 18
  // Start w poniedziałek
  const dow = (fromISO(today).getDay() + 6) % 7
  const start = addDaysISO(today, -(weeks - 1) * 7 - dow)
  const series = dailySeries(daysBetween(start, today) + 1, tasks, sessions, today)
  const map = new Map(series.map((p) => [p.day, p]))
  const level = (p?: SeriesPoint) => {
    if (!p) return 0
    const v = p.focusMin + p.tasksDone * 15
    return v === 0 ? 0 : v < 25 ? 1 : v < 60 ? 2 : v < 120 ? 3 : 4
  }
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysISO(start, w * 7 + d)))

  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle sub="Każdy kwadrat to dzień – im ciemniejszy, tym więcej pracy. Kliknij, aby zobaczyć szczegóły.">Historia aktywności</SectionTitle>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-0 text-[9px] font-semibold text-ink-3">
            {['Pn', '', 'Śr', '', 'Pt', '', 'Nd'].map((l, i) => (
              <span key={i} className="flex h-[15px] items-center">
                {l}
              </span>
            ))}
          </div>
          {cols.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((d) => {
                const p = map.get(d)
                const future = d > today
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={future}
                    onClick={() => onSelect(d)}
                    title={`${fmt(d, 'd MMM yyyy')}: ${p ? `${formatMinutes(p.focusMin)}, ${p.tasksDone} zadań, ${p.pistachios} pistacjonek` : 'brak aktywności'}`}
                    className={cx('size-[15px] cursor-pointer rounded-[4px] transition hover:ring-2 hover:ring-caramel-300 disabled:cursor-default disabled:opacity-0', d === selected && 'ring-2 ring-ink')}
                    style={{ background: C.heat[level(p)] }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
        mniej
        {C.heat.map((c) => (
          <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
        ))}
        więcej
      </div>
    </Card>
  )
}
