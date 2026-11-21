import {
  BarChart3,
  CalendarDays,
  CookingPot,
  GanttChartSquare,
  Inbox,
  LayoutGrid,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings,
  Sun,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { formatClock, todayISO } from '../../lib/dates'
import { remainingMs } from '../../lib/pomodoro'
import { isOverdue } from '../../lib/taskUtils'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { ImageSlot } from '../ui/ImageSlot'
import { Button, IconButton, ProgressRing, cx } from '../ui/primitives'
import { useNow } from './TimerEngine'
import { IMAGE_SLOTS } from '../../config/images'

export const NAV = [
  { to: '/', label: 'Dziś', icon: Sun },
  { to: '/backlog', label: 'Backlog', icon: Inbox },
  { to: '/kanban', label: 'Kanban', icon: LayoutGrid },
  { to: '/kalendarz', label: 'Kalendarz', icon: CalendarDays },
  { to: '/os-czasu', label: 'Oś czasu', icon: GanttChartSquare },
  { to: '/piekarnia', label: 'Piekarnia', icon: CookingPot },
  { to: '/statystyki', label: 'Statystyki', icon: BarChart3 },
  { to: '/ustawienia', label: 'Ustawienia', icon: Settings },
] as const

function Logo() {
  const hasLogo = !!(IMAGE_SLOTS.logo as { src: string | null }).src
  return (
    <div className="flex items-center gap-2.5">
      {hasLogo ? (
        <ImageSlot name="logo" className="size-9" />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-xl bg-pista-500 font-display text-lg font-bold text-cream shadow-soft">P</span>
      )}
      <div className="leading-none">
        <p className="font-display text-[19px] font-semibold tracking-tight text-ink">Pistacjonka</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-caramel-500">smart planner</p>
      </div>
    </div>
  )
}

function Sidebar() {
  const openForm = useUI((s) => s.openForm)
  const overdue = useStore((s) => s.tasks.filter((t) => isOverdue(t, todayISO())).length)
  const pistachios = useStore((s) => s.sessions.filter((x) => x.completed).length)
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-beige bg-cream-2/70 px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <Button variant="primary" className="mt-7 w-full" icon={<Plus size={17} />} onClick={() => openForm()}>
        Nowe zadanie
      </Button>
      <nav className="mt-6 flex flex-1 flex-col gap-0.5" aria-label="Główna nawigacja">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cx(
                'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition',
                isActive ? 'bg-card text-ink shadow-soft' : 'text-ink-2 hover:bg-beige/60 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.3 : 1.9} className={isActive ? 'text-pista-600' : 'text-ink-3 group-hover:text-ink-2'} />
                {label}
                {to === '/backlog' && overdue > 0 && (
                  <span className="ml-auto rounded-full bg-rose px-1.5 text-[11px] font-bold text-prio-high" title="Zadania po terminie">
                    {overdue}
                  </span>
                )}
                {to === '/piekarnia' && pistachios > 0 && <span className="ml-auto text-[11px] font-bold text-caramel-500">{pistachios}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <p className="px-3 text-[11px] leading-relaxed text-ink-3">Planuj, skupiaj się, piecz pistacjonki.</p>
    </aside>
  )
}

function MobileNav() {
  const [more, setMore] = useState(false)
  const loc = useLocation()
  const main = NAV.slice(0, 4)
  const rest = NAV.slice(4)
  const restActive = rest.some((n) => loc.pathname.startsWith(n.to))
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-beige bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Nawigacja">
        <div className="mx-auto flex max-w-lg">
          {main.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-pista-700' : 'text-ink-3')}>
              <Icon size={21} />
              {label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMore((v) => !v)} className={cx('flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', restActive || more ? 'text-pista-700' : 'text-ink-3')}>
            <MoreHorizontal size={21} />
            Więcej
          </button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-[rgb(59_47_38/0.2)]" />
          <div className="absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] grid animate-rise grid-cols-2 gap-2 rounded-3xl bg-card p-3 shadow-lift">
            {rest.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold', isActive ? 'bg-pista-50 text-pista-700' : 'text-ink-2 hover:bg-beige/60')}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/** Pływający mini-timer widoczny w każdym widoku podczas pieczenia. */
function MiniTimer() {
  const timer = useStore((s) => s.timer)
  const task = useStore((s) => s.tasks.find((t) => t.id === s.timer.taskId))
  const { timerPause, timerResume } = useStore()
  const now = useNow(500)
  const nav = useNavigate()
  const loc = useLocation()
  if (timer.phase === 'idle' || loc.pathname === '/piekarnia') return null
  const rem = remainingMs(timer, now)
  const pct = timer.durationMs ? 100 - (rem / timer.durationMs) * 100 : 0
  const running = timer.runningSince !== null
  return (
    <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] right-3 z-40 flex animate-rise items-center gap-3 rounded-full border border-caramel-200 bg-card py-1.5 pl-1.5 pr-2 shadow-lift lg:bottom-6 lg:right-6">
      <button type="button" onClick={() => nav('/piekarnia')} className="flex cursor-pointer items-center gap-3" aria-label="Otwórz piekarnię">
        <ProgressRing value={pct} size={40} stroke={4} color={timer.phase === 'work' ? 'var(--color-caramel-400)' : 'var(--color-pista-400)'}>
          <ImageSlot name="ciasto" variant="token" className="size-6" />
        </ProgressRing>
        <div className="text-left leading-tight">
          <p className="font-mono text-[15px] font-bold tabular-nums">{formatClock(rem)}</p>
          <p className="max-w-36 truncate text-[11px] text-ink-2">{timer.phase === 'work' ? (task?.title ?? 'Pieczenie') : timer.longBreak ? 'Długa przerwa' : 'Przerwa'}</p>
        </div>
      </button>
      <IconButton label={running ? 'Pauza' : 'Wznów'} onClick={running ? timerPause : timerResume} className="bg-beige/60">
        {running ? <Pause size={16} /> : <Play size={16} />}
      </IconButton>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const openForm = useUI((s) => s.openForm)
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-beige/70 bg-cream/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => openForm()}>
            Zadanie
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>
      </div>
      <MobileNav />
      <MiniTimer />
    </div>
  )
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
