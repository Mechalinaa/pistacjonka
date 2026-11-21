import { X } from 'lucide-react'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'caramel'
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-pista-600 text-cream hover:bg-pista-700 shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_2px_6px_-2px_rgb(76_99_41/0.5)]',
  secondary: 'bg-card text-ink border border-beige-2 hover:border-pista-300 hover:bg-pista-50',
  ghost: 'text-ink-2 hover:bg-beige/70 hover:text-ink',
  danger: 'bg-[#b5533a] text-cream hover:bg-[#9c4430]',
  caramel: 'bg-caramel-400 text-white hover:bg-caramel-500 shadow-[0_2px_6px_-2px_rgb(184_119_58/0.6)]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none whitespace-nowrap',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        VARIANTS[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-full text-ink-2 transition hover:bg-beige hover:text-ink active:scale-95 cursor-pointer disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' }) {
  return <As className={cx('rounded-3xl border border-beige/80 bg-card shadow-soft', className)}>{children}</As>
}

export function SectionTitle({ children, action, sub }: { children: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{children}</h2>
        {sub && <p className="text-[13px] text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function ProgressBar({ value, className, tone = 'pista' }: { value: number; className?: string; tone?: 'pista' | 'caramel' | 'warn' }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-beige', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'pista' && 'bg-gradient-to-r from-pista-400 to-pista-500',
          tone === 'caramel' && 'bg-gradient-to-r from-caramel-300 to-caramel-400',
          tone === 'warn' && 'bg-gradient-to-r from-caramel-400 to-prio-high',
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  children,
  color = 'var(--color-pista-500)',
  track = 'var(--color-beige)',
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  color?: string
  track?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  side,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  wide?: boolean
  /** Panel wysuwany z prawej (szczegóły zadania). */
  side?: boolean
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={cx('fixed inset-0 z-50 flex', side ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-6')}>
      <div className="absolute inset-0 animate-fade bg-[rgb(59_47_38/0.32)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative flex max-h-[100dvh] w-full flex-col bg-cream shadow-lift',
          side
            ? 'h-full animate-[rise_0.3s_ease-out] sm:max-w-xl sm:rounded-l-[28px]'
            : cx('animate-rise rounded-t-[28px] sm:rounded-[28px] max-h-[92dvh]', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'),
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 border-b border-beige px-5 py-4 sm:px-6">
            <div className="min-w-0 font-display text-lg font-semibold">{title}</div>
            <IconButton label="Zamknij" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-beige px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-beige/70 p-1 [scrollbar-width:none]" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'shrink-0 cursor-pointer whitespace-nowrap rounded-full font-semibold transition-all',
            size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-[13px]',
            value === o.value ? 'bg-card text-ink shadow-soft' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-2xl border border-beige-2 bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-pista-400 focus:outline-none focus:ring-4 focus:ring-pista-100'

export function Empty({ title, children, action, slot }: { title: string; children?: ReactNode; action?: ReactNode; slot?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {slot}
      <p className="mt-3 font-display text-base font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-beige-2 bg-card px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{children}</kbd>
}
