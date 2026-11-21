import { Bell, Database, Download, FileJson, ImageIcon, Plus, RotateCcw, Tags, Timer, Trash2, Upload, User } from 'lucide-react'
import { useState } from 'react'
import { ImportButtons, loadSample } from '../components/ImportExport'
import { PageHeader } from '../components/layout/Shell'
import { Button, Card, Field, IconButton, SectionTitle, inputCls } from '../components/ui/primitives'
import { IMAGE_SLOTS, type ImageSlotConfig } from '../config/images'
import { parseBackup, serializeBackup } from '../lib/backup'
import { downloadText } from '../lib/contestJson'
import { formatMinutes, todayISO } from '../lib/dates'
import { TAG_COLORS } from '../lib/taskUtils'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import type { Settings } from '../types'

function NumberSetting({ label, k, min, max, step = 1, suffix }: { label: string; k: keyof Settings; min: number; max: number; step?: number; suffix: string }) {
  const value = useStore((s) => s.settings[k]) as number
  const update = useStore((s) => s.updateSettings)
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          key={value}
          onBlur={(e) => {
            const v = Math.round(Number(e.target.value))
            update({ [k]: Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : value } as Partial<Settings>)
          }}
          className={inputCls}
        />
        <span className="shrink-0 text-sm text-ink-3">{suffix}</span>
      </div>
    </Field>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-1 py-2">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-ink-3">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${checked ? 'bg-pista-500' : 'bg-beige-2'}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export function SettingsPage() {
  const s = useStore()
  const { toast, ask } = useUI()
  const [newTag, setNewTag] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied')

  const exportBackup = () => {
    downloadText(`pistacjonka-kopia-${todayISO()}.json`, serializeBackup({ tasks: s.tasks, tags: s.tags, sessions: s.sessions, settings: s.settings }))
    toast('Pobrano pełną kopię zapasową.')
  }
  const importBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return
      const r = parseBackup(await f.text())
      if (!r.ok) return toast(r.error, 'error')
      ask({
        title: 'Przywrócić kopię zapasową?',
        body: `Obecne dane zostaną zastąpione: ${r.data.tasks.length} zadań, ${r.data.sessions.length} sesji Pomodoro.`,
        confirmLabel: 'Przywróć',
        onConfirm: () => {
          s.importBackup(r.data)
          toast('Przywrócono kopię zapasową.')
        },
      })
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Ustawienia" sub="Dopasuj piekarnię do siebie." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <User size={18} className="text-pista-600" /> Profil i planowanie
            </span>
          </SectionTitle>
          <div className="space-y-4">
            <Field label="Twoje imię" hint="Do powitania na ekranie „Dziś”.">
              <input defaultValue={s.settings.userName} onBlur={(e) => s.updateSettings({ userName: e.target.value.trim() })} className={inputCls} placeholder="np. Ola" maxLength={40} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberSetting label="Pojemność dnia" k="dailyCapacityMin" min={30} max={960} step={15} suffix="min" />
              <NumberSetting label="Maks. zadań dziennie" k="maxTasksPerDay" min={1} max={30} suffix="zadań" />
            </div>
            <p className="text-xs text-ink-3">
              Pojemność ({formatMinutes(s.settings.dailyCapacityMin)}) to realny czas pracy, który chcesz poświęcić dziennie. Sugestie i kalendarz ostrzegają, gdy dzień jest przeładowany.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Timer size={18} className="text-caramel-500" /> Pieczenie (Pomodoro)
            </span>
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting label="Sesja pracy" k="workMin" min={1} max={120} suffix="min" />
            <NumberSetting label="Krótka przerwa" k="breakMin" min={1} max={60} suffix="min" />
            <NumberSetting label="Długa przerwa" k="longBreakMin" min={1} max={90} suffix="min" />
            <NumberSetting label="Długa przerwa co" k="sessionsUntilLongBreak" min={2} max={10} suffix="sesji" />
          </div>
          <div className="mt-3 divide-y divide-beige">
            <Toggle label="Automatycznie zaczynaj przerwę" checked={s.settings.autoStartBreak} onChange={(v) => s.updateSettings({ autoStartBreak: v })} />
            <Toggle label="Dźwięk dzwonka" desc="Krótki sygnał po końcu sesji i przerwy." checked={s.settings.sound} onChange={(v) => s.updateSettings({ sound: v })} />
          </div>
          {typeof Notification !== 'undefined' && perm !== 'granted' && (
            <Button
              size="sm"
              className="mt-3"
              icon={<Bell size={14} />}
              disabled={perm === 'denied'}
              onClick={async () => setPerm(await Notification.requestPermission())}
            >
              {perm === 'denied' ? 'Powiadomienia zablokowane w przeglądarce' : 'Włącz powiadomienia systemowe'}
            </Button>
          )}
          <p className="mt-3 text-xs text-ink-3">Zmiany dotyczą kolejnych sesji – trwająca sesja kończy się według czasu, z jakim wystartowała.</p>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle sub="Kliknij kolorową kropkę, aby zmienić kolor; nazwę – aby ją edytować.">
            <span className="flex items-center gap-2">
              <Tags size={18} className="text-pista-600" /> Tagi
            </span>
          </SectionTitle>
          <ul className="space-y-1.5">
            {s.tags.map((t) => {
              const count = s.tasks.filter((x) => x.tags.includes(t.name)).length
              return (
                <li key={t.name} className="group flex items-center gap-3 rounded-2xl bg-cream-2/70 px-3 py-2">
                  <label className="relative size-5 shrink-0 cursor-pointer rounded-full" style={{ background: t.color }} title="Zmień kolor">
                    <input type="color" value={t.color} onChange={(e) => s.updateTagColor(t.name, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                  {editing === t.name ? (
                    <input
                      autoFocus
                      defaultValue={t.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== t.name && !s.renameTag(t.name, e.target.value)) toast('Tag o tej nazwie już istnieje.', 'error')
                        setEditing(null)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="min-w-0 flex-1 rounded-lg bg-card px-2 py-0.5 text-sm font-semibold outline-none ring-2 ring-pista-200"
                    />
                  ) : (
                    <button type="button" onClick={() => setEditing(t.name)} className="min-w-0 flex-1 cursor-text truncate text-left text-sm font-semibold">
                      {t.name}
                    </button>
                  )}
                  <span className="text-xs text-ink-3">{count} zad.</span>
                  <IconButton
                    label={`Usuń tag ${t.name}`}
                    className="size-7"
                    onClick={() =>
                      ask({
                        title: `Usunąć tag „${t.name}”?`,
                        body: count ? `Tag zniknie z ${count} zadań. Same zadania zostaną.` : 'Tag nie jest używany.',
                        confirmLabel: 'Usuń tag',
                        danger: true,
                        onConfirm: () => (s.deleteTag(t.name), toast('Tag usunięty.', 'info')),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              )
            })}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = s.addTag(newTag, TAG_COLORS[s.tags.length % TAG_COLORS.length])
              if (name) toast(`Dodano tag „${name}”.`)
              setNewTag('')
            }}
          >
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nazwa nowego tagu" className={inputCls} />
            <Button type="submit" variant="primary" icon={<Plus size={15} />} disabled={!newTag.trim()}>
              Dodaj
            </Button>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Database size={18} className="text-caramel-500" /> Dane
            </span>
          </SectionTitle>
          <div className="space-y-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileJson size={15} /> Format konkursowy (zadania.json)
              </p>
              <p className="mb-2 mt-0.5 text-xs text-ink-3">
                Import i eksport zadań w oficjalnym formacie: <code className="rounded bg-beige px-1">wersja</code>, <code className="rounded bg-beige px-1">zadania[]</code> z polami id, tytul, opis, termin, priorytet, wykonane, tagi – bez żadnych dodatkowych pól.
              </p>
              <div className="flex flex-wrap gap-2">
                <ImportButtons />
                <Button variant="ghost" onClick={loadSample}>
                  Wczytaj przykładowe
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Pełna kopia zapasowa</p>
              <p className="mb-2 mt-0.5 text-xs text-ink-3">Osobny plik z danymi rozszerzonymi: podzadania, planowane daty, szacunki, sesje Pomodoro, tagi z kolorami i ustawienia.</p>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Download size={15} />} onClick={exportBackup}>
                  Pobierz kopię
                </Button>
                <Button icon={<Upload size={15} />} onClick={importBackup}>
                  Przywróć kopię
                </Button>
              </div>
            </div>
            <div className="border-t border-beige pt-4">
              <Button
                variant="ghost"
                className="text-prio-high hover:bg-rose/60 hover:text-prio-high"
                icon={<RotateCcw size={15} />}
                onClick={() =>
                  ask({
                    title: 'Wyczyścić wszystkie dane?',
                    body: 'Usunie zadania, tagi, sesje Pomodoro i ustawienia z tej przeglądarki. Tej operacji nie można cofnąć – najpierw pobierz kopię zapasową.',
                    confirmLabel: 'Wyczyść wszystko',
                    danger: true,
                    onConfirm: () => (s.resetAll(), toast('Wyczyszczono dane.', 'info')),
                  })
                }
              >
                Wyczyść wszystkie dane
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-2">
          <SectionTitle sub="Pliki wrzuć do public/images/, a nazwę wpisz w src/config/images.ts.">
            <span className="flex items-center gap-2">
              <ImageIcon size={18} className="text-pista-600" /> Miejsca na własne grafiki
            </span>
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(IMAGE_SLOTS as Record<string, ImageSlotConfig>).map(([key, cfg]) => (
              <div key={key} className="rounded-2xl bg-cream-2/70 px-3 py-2.5 text-sm">
                <p className="font-semibold">
                  {key} <span className={cfg.src ? 'text-pista-600' : 'text-ink-3'}>· {cfg.src ? 'ustawiono' : 'placeholder'}</span>
                </p>
                <p className="text-xs text-ink-3">
                  {cfg.alt} · <code>images/{cfg.hint}</code> · {cfg.size}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
