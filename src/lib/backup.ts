/**
 * Pełna kopia zapasowa – OSOBNY plik od formatu konkursowego.
 * Zawiera dane rozszerzone: podzadania, planowane daty, sesje Pomodoro, ustawienia.
 */
import type { AppData, Task } from '../types'

export const BACKUP_KIND = 'pistacjonka-backup'

export function serializeBackup(data: AppData): string {
  return JSON.stringify({ kind: BACKUP_KIND, backupVersion: 1, exportedAt: new Date().toISOString(), data }, null, 2)
}

const TASK_DEFAULTS = (): Omit<Task, 'id' | 'title'> => ({
  subtasks: [],
  tags: [],
  description: '',
  deadline: null,
  plannedDate: null,
  estimateMin: null,
  manualMin: 0,
  completedAt: null,
  priority: 'sredni',
  status: 'todo',
  createdAt: new Date().toISOString(),
})

export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Plik nie jest poprawnym JSON-em.' }
  }
  const r = root as { kind?: string; data?: Partial<AppData> }
  if (!r || r.kind !== BACKUP_KIND || !r.data) {
    return { ok: false, error: 'To nie jest kopia zapasowa Pistacjonki. Plik konkursowy wczytasz przyciskiem „Importuj zadania”.' }
  }
  const d = r.data
  if (!Array.isArray(d.tasks) || !Array.isArray(d.tags) || !Array.isArray(d.sessions) || typeof d.settings !== 'object') {
    return { ok: false, error: 'Kopia zapasowa jest niekompletna (brak zadań, tagów, sesji lub ustawień).' }
  }
  const badTask = d.tasks.find((t) => typeof t?.id !== 'number' || typeof t?.title !== 'string')
  if (badTask) return { ok: false, error: 'Kopia zapasowa zawiera uszkodzone zadanie.' }
  return {
    ok: true,
    data: {
      tasks: d.tasks.map((t) => ({ ...TASK_DEFAULTS(), ...t }) as Task),
      tags: d.tags,
      sessions: d.sessions,
      settings: d.settings!,
    },
  }
}
