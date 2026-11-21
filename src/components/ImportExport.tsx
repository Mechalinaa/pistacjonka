import { AlertTriangle, Download, FileJson, Upload } from 'lucide-react'
import { create } from 'zustand'
import { parseContestJson, serializeContestFile, downloadText, type ParseResult } from '../lib/contestJson'
import { todayISO } from '../lib/dates'
import { useStore, type ImportMode } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Button, Modal } from './ui/primitives'

interface ImportState {
  result: (ParseResult & { fileName: string }) | null
  set: (r: ImportState['result']) => void
}
const useImportState = create<ImportState>()((set) => ({ result: null, set: (result) => set({ result }) }))

function pickFile(accept = '.json,application/json'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

/** Otwiera wybór pliku i pokazuje okno podsumowania importu. */
export async function startImport() {
  const file = await pickFile()
  if (!file) return
  if (file.size > 5_000_000) {
    useUI.getState().toast('Plik jest za duży (limit 5 MB).', 'error')
    return
  }
  const text = await file.text()
  useImportState.getState().set({ ...parseContestJson(text), fileName: file.name })
}

/** Wczytuje tekst (np. przykładowy plik) – ten sam proces co dla pliku użytkownika. */
export function importFromText(text: string, fileName: string) {
  useImportState.getState().set({ ...parseContestJson(text), fileName })
}

export function exportContest() {
  const tasks = useStore.getState().tasks
  downloadText(`zadania-${todayISO()}.json`, serializeContestFile(tasks))
  useUI.getState().toast(`Wyeksportowano ${tasks.length} zadań w formacie konkursowym.`)
}

export async function loadSample() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}zadania-przyklad.json`)
    importFromText(await res.text(), 'zadania-przyklad.json')
  } catch {
    useUI.getState().toast('Nie udało się wczytać przykładowego pliku.', 'error')
  }
}

export function ImportButtons({ compact }: { compact?: boolean }) {
  return (
    <>
      <Button icon={<Upload size={15} />} size={compact ? 'sm' : 'md'} onClick={startImport}>
        Importuj JSON
      </Button>
      <Button icon={<Download size={15} />} size={compact ? 'sm' : 'md'} onClick={exportContest}>
        Eksportuj JSON
      </Button>
    </>
  )
}

export function ImportDialog() {
  const { result, set } = useImportState()
  const hasTasks = useStore((s) => s.tasks.length > 0)
  const importContest = useStore((s) => s.importContest)
  const toast = useUI((s) => s.toast)
  const close = () => set(null)

  const run = (mode: ImportMode) => {
    if (!result) return
    const r = importContest(result.tasks, mode)
    close()
    const parts = [`Wczytano ${result.tasks.length} zadań z „${result.fileName}”`]
    if (r.updated) parts.push(`${r.updated} zaktualizowano (z zachowaniem podzadań i planu)`)
    if (r.skipped) parts.push(`${r.skipped} duplikatów pominięto`)
    toast(parts.join(' · ') + '.')
  }

  return (
    <Modal
      open={!!result}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <FileJson size={20} className="text-pista-600" /> Import zadań
        </span>
      }
      footer={
        result?.ok ? (
          <>
            <Button variant="ghost" onClick={close}>
              Anuluj
            </Button>
            {hasTasks && (
              <Button onClick={() => run('merge')} title="Dodaje zadania do obecnych; konfliktujące id dostaną nowe numery">
                Dołącz do obecnych
              </Button>
            )}
            <Button variant="primary" data-autofocus onClick={() => run('replace')}>
              {hasTasks ? 'Zastąp listę zadań' : 'Wczytaj zadania'}
            </Button>
          </>
        ) : (
          <Button onClick={close}>Zamknij</Button>
        )
      }
    >
      {result && (
        <div className="space-y-4 text-sm">
          <p className="text-ink-2">
            Plik: <b className="text-ink">{result.fileName}</b>
          </p>
          {result.ok ? (
            <div className="rounded-2xl bg-pista-50 p-4">
              <p className="font-display text-lg font-semibold text-pista-800">Znaleziono {result.tasks.length} zadań</p>
              <p className="mt-1 text-ink-2">
                {result.tasks.filter((t) => t.wykonane).length} wykonanych · {result.tasks.filter((t) => t.termin).length} z terminem ·{' '}
                {new Set(result.tasks.flatMap((t) => t.tagi)).size} tagów
              </p>
              {hasTasks && (
                <p className="mt-2 text-xs text-ink-2">
                  „Zastąp” ustawi listę dokładnie taką jak w pliku (id zostają bez zmian). Zadania o tym samym id i tytule zachowają podzadania, plan i historię czasu.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-rose/60 p-4 text-[#8a3a24]">
              <p className="font-semibold">Nie udało się wczytać pliku</p>
              <ul className="mt-1 list-disc pl-5">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Oczekiwany format: {'{ "wersja": 1, "zadania": [ { "id", "tytul", "opis", "termin", "priorytet", "wykonane", "tagi" } ] }'}</p>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="rounded-2xl bg-butter/70 p-4">
              <p className="flex items-center gap-2 font-semibold text-caramel-600">
                <AlertTriangle size={16} /> Poprawiono automatycznie ({result.warnings.length})
              </p>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-ink-2">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
