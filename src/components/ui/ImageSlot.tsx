import { ImagePlus } from 'lucide-react'
import { useState } from 'react'
import { IMAGE_SLOTS, type ImageSlotConfig, type ImageSlotName } from '../../config/images'
import { cx } from './primitives'

/**
 * Miejsce na własną grafikę. Gdy w `src/config/images.ts` nie ustawiono pliku,
 * pokazuje estetyczny placeholder z podpowiedzią nazwy pliku.
 *
 * variant="frame"  – ramka z podpisem (duże sekcje),
 * variant="token"  – mała, abstrakcyjna „pistacjonka” (kolekcja, liczniki).
 */
export function ImageSlot({
  name,
  className,
  variant = 'frame',
  showHint = true,
}: {
  name: ImageSlotName
  className?: string
  variant?: 'frame' | 'token'
  showHint?: boolean
}) {
  const cfg: ImageSlotConfig = IMAGE_SLOTS[name]
  const [failed, setFailed] = useState(false)

  if (cfg.src && !failed) {
    return (
      <img
        src={cfg.src}
        alt={cfg.alt}
        onError={() => setFailed(true)}
        className={cx('object-contain', className)}
        draggable={false}
      />
    )
  }

  if (variant === 'token') {
    return <span role="img" aria-label={cfg.alt} title={cfg.alt} className={cx('pista-token inline-block shrink-0 rounded-full align-middle', className)} />
  }

  return (
    <div
      role="img"
      aria-label={`${cfg.alt} – miejsce na grafikę`}
      className={cx(
        'flex flex-col items-center justify-center gap-1.5 rounded-3xl border-2 border-dashed border-caramel-200 bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgb(239_207_166/0.18)_10px_20px)] text-center text-caramel-500',
        className,
      )}
    >
      <ImagePlus size={22} strokeWidth={1.6} />
      {showHint && (
        <>
          <span className="text-[11px] font-bold uppercase tracking-wider">Miejsce na grafikę</span>
          <span className="font-mono text-[11px] text-caramel-400">images/{cfg.hint}</span>
        </>
      )}
    </div>
  )
}
