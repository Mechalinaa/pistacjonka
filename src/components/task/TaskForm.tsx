import { useEffect, useState } from 'react'
import { todayISO } from '../../lib/dates'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import type { Priority } from '../../types'
import { Button, Field, Modal, Segmented, inputCls } from '../ui/primitives'
import { TagPicker } from './TagPicker'

const PRIOS: { value: Priority; label: string }[] = [
  { value: 'niski', label: 'Niski' },
  { value: 'sredni', label: 'Średni' },
  { value: 'wysoki', label: 'Wysoki' },
]

/** Modal dodawania nowego zadania (pełny formularz). */
export function TaskFormModal() {
  const { formOpen, formDefaults, closeForm, toast, openDetail } = useUI()
  const addTask = useStore((s) => s.addTask)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [priority, setPriority] = useState<Priority>('sredni')
  const [tags, setTags] = useState<string[]>([])
  const [estimate, setEstimate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!formOpen) return
    setTitle(formDefaults.title ?? '')
    setDescription(formDefaults.description ?? '')
    setDeadline(formDefaults.deadline ?? '')
    setPlannedDate(formDefaults.plannedDate ?? '')
    setPriority(formDefaults.priority ?? 'sredni')
    setTags(formDefaults.tags ?? [])
    setEstimate(formDefaults.estimateMin ? String(formDefaults.estimateMin) : '')
    setError('')
  }, [formOpen, formDefaults])

  const submit = (openAfter = false) => {
    if (!title.trim()) {
      setError('Nadaj zadaniu tytuł.')
      return
    }
    const est = Number(estimate)
    const id = addTask({
      title,
      description,
      deadline: deadline || null,
      plannedDate: plannedDate || null,
      priority,
      tags,
      status: formDefaults.status,
      estimateMin: estimate && est > 0 ? Math.round(est) : null,
    })
    closeForm()
    toast(plannedDate === todayISO() ? 'Dodano do dzisiejszego planu.' : 'Nowe zadanie w backlogu.')
    if (openAfter) openDetail(id)
  }

  return (
    <Modal
      open={formOpen}
      onClose={closeForm}
      title="Nowe zadanie"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={closeForm}>
            Anuluj
          </Button>
          <Button variant="secondary" onClick={() => submit(true)}>
            Dodaj i dodaj podzadania
          </Button>
          <Button variant="primary" onClick={() => submit()}>
            Dodaj zadanie
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Tytuł">
          <input
            data-autofocus
            className={inputCls}
            value={title}
            onChange={(e) => (setTitle(e.target.value), setError(''))}
            placeholder="np. Przygotowanie do kolokwium z matematyki"
            maxLength={200}
          />
          {error && <span className="mt-1 block text-xs font-semibold text-prio-high">{error}</span>}
        </Field>
        <Field label="Opis">
          <textarea className={`${inputCls} min-h-20 resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Szczegóły, rozdziały, linki…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline" hint="Do kiedy musi być gotowe.">
            <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Planowana realizacja" hint="Kiedy zamierzasz się tym zająć.">
            <input type="date" className={inputCls} value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priorytet">
            <Segmented value={priority} options={PRIOS} onChange={setPriority} />
          </Field>
          <Field label="Szacowany czas (min)">
            <input type="number" min={0} step={5} className={inputCls} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="np. 50" />
          </Field>
        </div>
        <Field label="Tagi">
          <TagPicker value={tags} onChange={setTags} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
