import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { TagChip } from './bits'

/** Wybór wielu tagów + tworzenie nowego „w locie”. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const tags = useStore((s) => s.tags)
  const addTag = useStore((s) => s.addTag)
  const [draft, setDraft] = useState('')

  const toggle = (name: string) => onChange(value.includes(name) ? value.filter((t) => t !== name) : [...value, name])
  const create = () => {
    const name = addTag(draft)
    if (name && !value.includes(name)) onChange([...value, name])
    setDraft('')
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip key={t.name} name={t.name} size="md" active={value.includes(t.name)} onClick={() => toggle(t.name)} />
      ))}
      <div className="inline-flex items-center rounded-full border border-dashed border-beige-2 bg-card pl-3 focus-within:border-pista-400">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              create()
            }
          }}
          placeholder="nowy tag"
          className="w-24 bg-transparent py-1 text-[13px] outline-none placeholder:text-ink-3"
          aria-label="Nazwa nowego tagu"
        />
        <button type="button" onClick={create} disabled={!draft.trim()} className="cursor-pointer rounded-full p-1.5 text-pista-600 disabled:opacity-30" aria-label="Utwórz tag">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
