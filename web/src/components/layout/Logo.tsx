import { cn } from '@/lib/utils'

const NAVY = '#07184A'

/**
 * ELBAKRI brand mark — the "B" monogram with the airplane flying through it.
 * Recreated as a transparent, scalable SVG (no baked-in white box).
 * Theme-adaptive: navy "B" + white plane on light surfaces; inverted on dark.
 */
export function BrandMark({ onDark = false, size = 40, className }: { onDark?: boolean; size?: number; className?: string }) {
  const b = onDark ? '#FFFFFF' : NAVY
  const plane = onDark ? NAVY : '#FFFFFF'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="ELBAKRI OVERSEAS"
      className={cn('shrink-0', className)}
    >
      {/* Bold "B" letterform — straight spine, two bowls, pronounced waist */}
      <path
        d="M22 11 H51 C72 11 84 20 84 33 C84 43 76 49 62 50 C78 51 88 59 88 70 C88 83 75 89 53 89 H22 Z"
        fill={b}
      />
      {/* Airplane climbing toward the upper-left, set into the upper bowl */}
      <g transform="translate(53 35) rotate(-36) scale(1.55) translate(-12 -12)">
        <path
          d="M12 1.6c1.3 0 2.2 2.1 2.2 5.2v3.4l7.6 4.6v2.4l-7.6-2.3v4.7l2.2 2v1.5l-4.4-1.1-4.4 1.1v-1.5l2.2-2v-4.7l-7.6 2.3v-2.4l7.6-4.6v-3.4c0-3.1 0.9-5.2 2.2-5.2z"
          fill={plane}
        />
      </g>
    </svg>
  )
}

/** Full lockup: mark + wordmark. Used in the app shell and login. */
export function Logo({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  const onDark = variant === 'light' // 'light' = rendered on a dark/navy surface
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark onDark={onDark} size={38} />
      <div className="leading-tight">
        <div className={cn('brand-wordmark text-[15px] font-bold tracking-tight', onDark ? 'text-white' : 'text-navy-900')}>ELBAKRI OVERSEAS</div>
        <div className={cn('text-[9px] font-semibold tracking-[0.18em]', onDark ? 'text-white/70' : 'text-ink-muted')}>FOR TRAVEL · EST. 1982</div>
      </div>
    </div>
  )
}
