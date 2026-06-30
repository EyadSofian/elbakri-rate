import { Languages } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Compact AR⇄EN language switch. Sets <html dir/lang> via the i18n provider. */
export function LanguageToggle({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const { toggle, t } = useI18n()
  return (
    <button
      onClick={toggle}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-btn px-2.5 text-xs font-bold transition',
        onDark ? 'text-white/80 hover:bg-white/10' : 'text-navy-700 hover:bg-navy-50',
        className,
      )}
      aria-label={t('lang.label')}
    >
      <Languages className="h-4 w-4" />
      {t('lang.toggle')}
    </button>
  )
}
