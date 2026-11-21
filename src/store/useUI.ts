import { create } from 'zustand'
import type { TaskInput } from './useStore'

export interface Toast {
  id: number
  text: string
  tone: 'success' | 'info' | 'error'
  action?: { label: string; run: () => void }
}

interface Confirm {
  title: string
  body?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}

interface UIState {
  detailId: number | null
  formOpen: boolean
  formDefaults: Partial<TaskInput>
  confirm: Confirm | null
  toasts: Toast[]
  openDetail: (id: number) => void
  closeDetail: () => void
  openForm: (defaults?: Partial<TaskInput>) => void
  closeForm: () => void
  ask: (c: Confirm) => void
  closeConfirm: () => void
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismissToast: (id: number) => void
}

let toastSeq = 1

export const useUI = create<UIState>()((set) => ({
  detailId: null,
  formOpen: false,
  formDefaults: {},
  confirm: null,
  toasts: [],
  openDetail: (id) => set({ detailId: id }),
  closeDetail: () => set({ detailId: null }),
  openForm: (defaults = {}) => set({ formOpen: true, formDefaults: defaults }),
  closeForm: () => set({ formOpen: false }),
  ask: (c) => set({ confirm: c }),
  closeConfirm: () => set({ confirm: null }),
  toast: (text, tone = 'success', action) => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone, action }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), action ? 6000 : 3500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
