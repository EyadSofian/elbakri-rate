import { cn } from '@/lib/utils'

export function Logo({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  const isLight = variant === 'light'
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <img
        src={isLight ? '/elbakri-logo-white.png' : '/elbakri-logo.png'}
        alt="ELBAKRI OVERSEAS"
        className="h-10 max-w-[176px] object-contain sm:h-11 sm:max-w-[190px]"
      />
    </div>
  )
}
