import { CornerDownLeft, Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatMinutes, relativeDay } from '../../lib/dates'
import { parseQuickAdd } from '../../lib/quickAdd'
import { PRIORITY_LABEL } from '../../lib/taskUtils'
import { useStore, type TaskInput } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { IconButton, Kbd } from '../ui/primitives'

/**
 * Szybkie dodawanie z mini-składnią: #tag !wysoki @jutro ~45m
 * Podgląd rozpoznanych elementów pokazuje się na bieżąco.
 */
export function QuickAdd({ defaults, placeholder }: { defaults?: Partial<TaskInput>; placeholder?: string }) {
  const [text, setText] = useState('')
  const addTask = useStore((s) => s.addTask)
  const { toast, openForm } = useUI()
  const parsed = useMemo(() => parseQuickAdd(text), [text])
  const hasExtras = parsed.tags.length > 0 || parsed.priority || parsed.deadline || parsed.estimateMin

  const submit = () => {
    if (!parsed.title) return
    addTask({
      ...defaults,
      title: parsed.title,
      tags: [...(defaults?.tags ?? []), ...parsed.tags],
      priority: parsed.priority ?? defaults?.priority,
      deadline: parsed.deadline ?? defaults?.deadline,
      estimateMin: parsed.estimateMin ?? defaults?.estimateMin,
    })
    setText('')
    toast(`Dodano „${parsed.title}”.`)
  }

  return (
    <div className="rounded-2xl border border-beige-2 bg-card shadow-soft transition focus-within:border-pista-400 focus-within:ring-4 focus-within:ring-pista-100">
      <div className="flex items-center gap-2 py-1.5 pl-4 pr-1.5">
        <Plus size={18} className="shrink-0 text-pista-500" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder ?? 'Dodaj zadanie… np. „Lab 7 #studia !wysoki @piątek ~45m”'}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-ink-3"
          aria-label="Szybkie dodawanie zadania"
        />
        {text && (
          <span className="hidden items-center gap-1 text-xs text-ink-3 sm:inline-flex">
            <Kbd>
              <CornerDownLeft size={10} className="inline" />
            </Kbd>
          </span>
        )}
        <IconButton label="Pełny formularz" onClick={() => openForm({ ...defaults, title: parsed.title, tags: parsed.tags, priority: parsed.priority ?? undefined, deadline: parsed.deadline, estimateMin: parsed.estimateMin })}>
          <SlidersHorizontal size={16} />
        </IconButton>
      </div>
      {text && hasExtras && (
        <div className="flex flex-wrap gap-1.5 border-t border-beige px-4 py-2 text-xs animate-fade">
          <span className="text-ink-3">Rozpoznano:</span>
          {parsed.priority && <span className="rounded-full bg-beige px-2 py-0.5 font-semibold">priorytet {PRIORITY_LABEL[parsed.priority].toLowerCase()}</span>}
          {parsed.deadline && <span className="rounded-full bg-caramel-100 px-2 py-0.5 font-semibold text-caramel-600">deadline {relativeDay(parsed.deadline)}</span>}
          {parsed.estimateMin && <span className="rounded-full bg-mint px-2 py-0.5 font-semibold">~{formatMinutes(parsed.estimateMin)}</span>}
          {parsed.tags.map((t) => (
            <span key={t} className="rounded-full bg-pista-100 px-2 py-0.5 font-semibold text-pista-700">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
