import { cn } from '@/lib/utils'

export function Logo({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  const isLight = variant === 'light'
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn('flex h-11 shrink-0 items-center rounded-card border p-1.5 shadow-sm', isLight ? 'border-white/15 bg-white' : 'border-navy-100 bg-white')}>
        <img src="/elbakri-logo.png" alt="ELBAKRI OVERSEAS" className="h-8 w-auto object-contain" />
      </div>
      <div className="leading-tight">
        <div className={cn('text-xs font-extrabold tracking-tight', isLight ? 'text-white' : 'text-navy-900')}>ELBAKRI OVERSEAS</div>
        <div className={cn('text-[10px] font-semibold tracking-wide', isLight ? 'text-white/70' : 'text-ink-muted')}>
          EST. 1982
        </div>
      </div>
    </div>
  )
}
