import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { ImageSlot } from '../ui/ImageSlot'
import { Button, Modal, cx } from '../ui/primitives'

export function Toasts() {
  const { toasts, dismissToast } = useUI()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-cream shadow-lift">
          {t.tone === 'success' && <CheckCircle2 size={18} className="shrink-0 text-pista-300" />}
          {t.tone === 'info' && <Info size={18} className="shrink-0 text-caramel-200" />}
          {t.tone === 'error' && <XCircle size={18} className="shrink-0 text-rose" />}
          <span className="font-medium">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="ml-1 cursor-pointer rounded-full px-2 py-0.5 font-bold text-pista-300 hover:bg-white/10"
              onClick={() => {
                t.action!.run()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useUI()
  return (
    <Modal
      open={!!confirm}
      onClose={closeConfirm}
      title={confirm?.title}
      footer={
        <>
          <Button variant="ghost" onClick={closeConfirm}>
            Anuluj
          </Button>
          <Button
            data-autofocus
            variant={confirm?.danger ? 'danger' : 'primary'}
            onClick={() => {
              confirm?.onConfirm()
              closeConfirm()
            }}
          >
            {confirm?.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-ink-2">{confirm?.body}</p>
    </Modal>
  )
}

/** Animacja po ukończeniu sesji: pistacjonka „wyskakuje” z piekarnika. */
export function Celebration() {
  const celebrate = useStore((s) => s.celebrate)
  const clear = useStore((s) => s.clearCelebrate)
  const count = useStore((s) => s.sessions.filter((x) => x.completed).length)
  useEffect(() => {
    if (!celebrate) return
    const t = setTimeout(clear, 5200)
    return () => clearTimeout(t)
  }, [celebrate, clear])
  if (!celebrate) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" onClick={clear}>
      <div className="absolute inset-0 animate-fade bg-[rgb(251_248_241/0.75)] backdrop-blur-sm" />
      <div className="relative flex animate-pop flex-col items-center rounded-[32px] border border-caramel-200 bg-card px-10 py-8 text-center shadow-lift">
        <div className="relative">
          <div className="absolute inset-0 -m-6 animate-bake rounded-full" />
          {/* drobinki pistacji */}
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 size-2 rounded-full"
              style={{
                background: i % 2 ? 'var(--color-pista-400)' : 'var(--color-caramel-300)',
                animation: `crumb-${i} 1.1s ease-out both`,
              }}
            />
          ))}
          <style>
            {Array.from({ length: 10 })
              .map((_, i) => {
                const a = (i / 10) * Math.PI * 2
                return `@keyframes crumb-${i}{from{transform:translate(-50%,-50%) scale(1);opacity:1}to{transform:translate(calc(-50% + ${Math.cos(a) * 90}px),calc(-50% + ${Math.sin(a) * 90}px)) scale(.4);opacity:0}}`
              })
              .join('')}
          </style>
          <ImageSlot name="pistacjonka" variant="token" className="relative size-28" />
        </div>
        <p className="mt-6 font-display text-2xl font-semibold">Jedna pistacjonka więcej do kolekcji!</p>
        <p className="mt-1 text-sm text-ink-2">
          {celebrate.taskTitle ? <>Sesja przy „{celebrate.taskTitle}” ukończona. </> : 'Sesja ukończona. '}
          Masz już <b className="text-caramel-600">{count}</b> w kolekcji.
        </p>
        <p className="mt-3 text-xs text-ink-3">Teraz przerwa – ciasto musi odpocząć.</p>
      </div>
    </div>
  )
}

export function LoadingDot({ className }: { className?: string }) {
  return <span className={cx('inline-block size-2 animate-pulse rounded-full bg-caramel-400', className)} />
}
