import { useEffect, useState } from 'react'
import { formatClock } from '../../lib/dates'
import { remainingMs } from '../../lib/pomodoro'
import { notify, playChime } from '../../lib/sound'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'

/** Zwraca `Date.now()` odświeżane co `ms` – do wyświetlania timera. */
export function useNow(ms = 500) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/**
 * Silnik timera – działa globalnie, niezależnie od otwartego widoku.
 * Co sekundę (i po powrocie do karty) domyka fazy, których czas minął.
 * Wyliczenia opierają się na timestampach, więc odświeżenie strony nic nie psuje.
 */
export function TimerEngine() {
  const timer = useStore((s) => s.timer)
  const toast = useUI((s) => s.toast)

  useEffect(() => {
    const check = () => {
      const res = useStore.getState().timerTick()
      const sound = useStore.getState().settings.sound
      if (res === 'work-complete') {
        if (sound) playChime()
        notify('Pistacjonka upieczona!', 'Sesja skończona – czas na przerwę.')
      } else if (res === 'break-complete') {
        if (sound) playChime()
        toast('Przerwa skończona. Gotowy na kolejną blachę?', 'info')
        notify('Koniec przerwy', 'Czas upiec kolejną pistacjonkę!')
      }
    }
    check()
    const t = setInterval(check, 1000)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [toast])

  // Pozostały czas w tytule karty.
  const now = useNow(1000)
  useEffect(() => {
    const base = 'Pistacjonka – smart planner'
    if (timer.phase === 'idle') document.title = base
    else document.title = `${timer.runningSince === null ? '⏸ ' : ''}${formatClock(remainingMs(timer, now))} · ${timer.phase === 'work' ? 'Pieczenie' : 'Przerwa'} – Pistacjonka`
  }, [timer, now])

  return null
}
