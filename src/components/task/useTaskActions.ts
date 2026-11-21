import { todayISO } from '../../lib/dates'
import { isDone } from '../../lib/taskUtils'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { Status } from '../../types'

const DONE_MESSAGES = [
  'Zrobione! Jedna rzecz mniej na blasze.',
  'Świetna robota – odhaczone.',
  'Gotowe! Tak trzymaj.',
  'Kolejne zadanie z głowy.',
]

/** Akcje z mikro-feedbackiem (toasty, potwierdzenia, „cofnij”). */
export function useTaskActions() {
  const toggleDone = useStore((s) => s.toggleDone)
  const setStatus = useStore((s) => s.setStatus)
  const deleteTask = useStore((s) => s.deleteTask)
  const planTask = useStore((s) => s.planTask)
  const toast = useUI((s) => s.toast)
  const ask = useUI((s) => s.ask)
  const closeDetail = useUI((s) => s.closeDetail)

  const afterDone = () => {
    const { tasks } = useStore.getState()
    const today = todayISO()
    const plan = tasks.filter((t) => t.plannedDate === today)
    const left = plan.filter((t) => !isDone(t)).length
    if (plan.length >= 2 && left === 0) return 'Cały dzisiejszy plan upieczony! Czas na zasłużoną przerwę.'
    if (plan.length >= 3 && left === 1) return 'Świetna robota! Dzisiejszy plan prawie gotowy.'
    return DONE_MESSAGES[Math.floor(Date.now() / 1000) % DONE_MESSAGES.length]
  }

  return {
    toggle(id: number) {
      const t = useStore.getState().tasks.find((x) => x.id === id)
      if (!t) return
      const prev = t.status
      toggleDone(id)
      if (!isDone(t)) toast(afterDone(), 'success', { label: 'Cofnij', run: () => setStatus(id, prev) })
      else toast('Przywrócono do zrobienia.', 'info')
    },
    setStatus(id: number, status: Status) {
      const t = useStore.getState().tasks.find((x) => x.id === id)
      if (!t || t.status === status) return
      setStatus(id, status)
      if (status === 'done') toast(afterDone(), 'success', { label: 'Cofnij', run: () => setStatus(id, t.status) })
    },
    remove(id: number) {
      const t = useStore.getState().tasks.find((x) => x.id === id)
      if (!t) return
      ask({
        title: 'Usunąć zadanie?',
        body: `„${t.title}” zniknie razem z podzadaniami. Historia sesji Pomodoro zostanie w statystykach.`,
        confirmLabel: 'Usuń zadanie',
        danger: true,
        onConfirm: () => {
          closeDetail()
          deleteTask(id)
          toast('Zadanie usunięte.', 'info')
        },
      })
    },
    planToday(id: number) {
      planTask(id, todayISO())
      toast('Dodano do dzisiejszego planu.')
    },
  }
}
