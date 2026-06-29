import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHeader, PageLoader, ErrorState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SystemCheckItem } from '@/types'

const statusMeta = {
  ok: { icon: CheckCircle2, cls: 'text-green-600 bg-green-50 border-green-200', label: 'سليم' },
  warn: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-200', label: 'تحذير' },
  fail: { icon: XCircle, cls: 'text-red-600 bg-red-50 border-red-200', label: 'فشل' },
}

export default function SystemCheckPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['system-check'],
    queryFn: () => api.get<{ checks: SystemCheckItem[]; generated_at: string }>('/system-check'),
  })

  return (
    <div>
      <PageHeader
        title="فحص النظام"
        subtitle="حالة الاتصال وقاعدة البيانات والمكتبات"
        actions={<Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}><RefreshCw className="h-4 w-4" />إعادة الفحص</Button>}
      />

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : (
        <div className="space-y-2">
          {data!.checks.map((c) => {
            const meta = statusMeta[c.status]
            const Icon = meta.icon
            return (
              <div key={c.key} className="flex items-center gap-3 rounded-card border border-navy-100 bg-white p-3">
                <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-card border', meta.cls)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-navy-900">{c.label}</div>
                  {c.detail && <div className="text-xs text-ink-muted">{c.detail}</div>}
                </div>
                {c.value !== undefined && <span className="nums text-lg font-extrabold text-navy-900">{c.value}</span>}
                <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-bold', meta.cls)}>{meta.label}</span>
              </div>
            )
          })}
          <p className="nums pt-2 text-center text-xs text-ink-muted">آخر فحص: {new Date(data!.generated_at).toLocaleString('ar-EG')}</p>
        </div>
      )}
    </div>
  )
}
