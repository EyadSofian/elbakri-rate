import { Languages } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageToggle({ className }: { className?: string }) {
  const { toggle, t } = useI18n()

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-btn px-2.5 text-xs font-bold text-navy-700 transition hover:bg-navy-50',
        className,
      )}
      aria-label={t('lang.label')}
    >
      <Languages className="h-4 w-4" />
      {t('lang.toggle')}
    </button>
  )
}
