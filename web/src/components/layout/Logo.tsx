import { cn } from '@/lib/utils'

const LOGO_BLUE = '/elbakri-logo-blue.png'
const LOGO_WHITE = '/elbakri-logo-white.png'
const MARK_BLUE = '/elbakri-mark.png'

export function BrandMark({
  onDark = false,
  size = 40,
  className,
}: {
  onDark?: boolean
  size?: number
  className?: string
}) {
  return (
    <img
      src={onDark ? LOGO_WHITE : MARK_BLUE}
      alt="ELBAKRI OVERSEAS"
      className={cn('shrink-0 object-contain', className)}
      style={{ width: onDark ? size * 3.8 : size, height: size }}
    />
  )
}

/** Full ELBAKRI lockup from the real brand asset, no recreated/vector approximation. */
export function Logo({
  variant = 'dark',
  className,
}: {
  variant?: 'dark' | 'light'
  className?: string
}) {
  const onDark = variant === 'light'
  return (
    <img
      src={onDark ? LOGO_WHITE : LOGO_BLUE}
      alt="ELBAKRI OVERSEAS"
      className={cn('block h-11 w-auto max-w-[190px] object-contain', className)}
    />
  )
}
