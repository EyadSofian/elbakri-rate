import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus, User, Phone, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import { PageHeader, PageLoader, EmptyState, Tabs } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { QuoteStatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Quote, QuoteStatus } from '@/types'

export default function QuotesPage() {
  const [status, setStatus] = useState<QuoteStatus | 'all'>('all')
  const { data, isLoading } = useQuery({ queryKey: ['quotes'], queryFn: () => api.get<Quote[]>('/quotes') })

  const filtered = (data ?? []).filter((q) => status === 'all' || q.status === status)

  return (
    <div>
      <PageHeader
        title="عروض الأسعار"
        subtitle="عروض الأسعار المحفوظة والمرسلة"
        actions={<Link to="/quotes/new"><Button size="sm"><Plus className="h-4 w-4" />عرض جديد</Button></Link>}
      />

      <Tabs
        active={status}
        onChange={setStatus}
        tabs={[
          { key: 'all', label: 'الكل', count: data?.length },
          { key: 'draft', label: 'مسودة' },
          { key: 'ready', label: 'جاهز' },
          { key: 'sent', label: 'مُرسل' },
          { key: 'archived', label: 'مؤرشف' },
        ]}
      />

      {isLoading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="لا توجد عروض" action={<Link to="/quotes/new"><Button><Plus className="h-4 w-4" />عرض جديد</Button></Link>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((q) => (
            <Link key={q.id} to={`/quotes/${q.id}`} className="card flex flex-col gap-2 p-4 transition hover:border-navy-200 hover:shadow-soft">
              <div className="flex items-center justify-between">
                <span className="nums font-bold text-navy-900">{q.quote_number}</span>
                <QuoteStatusBadge status={q.status} />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-navy-800">
                <User className="h-4 w-4 text-navy-400" />{q.client_name || 'بدون اسم'}
              </div>
              {q.client_phone && (
                <div className="nums flex items-center gap-1.5 text-xs text-ink-muted"><Phone className="h-3.5 w-3.5" />{q.client_phone}</div>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-navy-100 pt-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /><span className="nums">{q.items_count ?? 0}</span> عنصر</span>
                <span className="nums">{formatDate(q.updated_at ?? q.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
