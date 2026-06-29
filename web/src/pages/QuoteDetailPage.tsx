import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, User, Phone, Printer, Share2, Building2, Send, Bus, StickyNote } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { PageLoader, ErrorState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { QuoteStatusBadge } from '@/components/ui/badge'
import { ExportActions } from '@/components/export/ExportActions'
import { useToast } from '@/components/ui/toast'
import { formatPrice, formatDateRange } from '@/lib/utils'
import { mealLabel, roomLabel, transferLabel } from '@/lib/labels'
import type { Quote, QuoteItem } from '@/types'

export default function QuoteDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: quote, isLoading, error } = useQuery({ queryKey: ['quote', id], queryFn: () => api.get<Quote>(`/quotes/${id}`) })

  const setStatus = useMutation({
    mutationFn: (status: string) => api.put(`/quotes/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quote', id] }); qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('تم تحديث الحالة') },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر التحديث'),
  })

  if (isLoading) return <PageLoader />
  if (error || !quote) return <ErrorState message={(error as Error)?.message ?? 'غير موجود'} />

  const items = (quote.items ?? []) as QuoteItem[]
  const groups = new Map<string, QuoteItem[]>()
  for (const it of items) {
    const k = it.hotel_name ?? 'فندق'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(it)
  }

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('تم نسخ رابط العرض')
  }

  return (
    <div>
      <Link to="/quotes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4" />عروض الأسعار
      </Link>

      <div className="card mb-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="nums text-xl font-extrabold text-navy-900">{quote.quote_number}</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              {quote.client_name && <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{quote.client_name}</span>}
              {quote.client_phone && <span className="nums inline-flex items-center gap-1"><Phone className="h-4 w-4" />{quote.client_phone}</span>}
            </div>
            {quote.client_notes && <p className="mt-2 text-sm text-ink">{quote.client_notes}</p>}
          </div>
          <ExportActions
            items={items}
            client={quote.client_name}
            title={`عرض سعر ${quote.quote_number}`}
            notes={quote.client_notes}
            quoteId={quote.id}
            fileBase={`elbakri-${quote.quote_number}`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-100 pt-3">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />نسخ الرابط</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة</Button>
          {quote.status !== 'sent' && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate('sent')}><Send className="h-4 w-4" />تعليم كمُرسل</Button>}
        </div>
      </div>

      {/* Branded preview of items */}
      <div className="space-y-5">
        {Array.from(groups.entries()).map(([hotel, rates]) => (
          <div key={hotel}>
            <h3 className="mb-2 flex items-center gap-2 border-b-2 border-navy-900 pb-1.5 text-lg font-extrabold text-navy-900">
              <Building2 className="h-5 w-5 text-navy-500" />{hotel}
            </h3>
            <div className="space-y-2">
              {rates.map((r) => (
                <div key={r.item_id} className="flex items-stretch overflow-hidden rounded-card border border-navy-100 bg-white">
                  <div className="flex-1 p-3">
                    <div className="font-bold text-navy-900">{roomLabel(r.room_type)} · {mealLabel(r.meal_plan)}</div>
                    <div className="nums mt-0.5 text-xs text-ink-muted">{formatDateRange(r.date_from, r.date_to)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      {r.transfer_included !== 'Not Included' && (
                        <span className="inline-flex items-center gap-1">
                          <Bus className="h-3.5 w-3.5 text-navy-500" />
                          {transferLabel[r.transfer_included]}
                        </span>
                      )}
                      {r.custom_note ? (
                        <span className="inline-flex items-center gap-1">
                          <StickyNote className="h-3.5 w-3.5 text-navy-500" />
                          {r.custom_note}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex w-32 shrink-0 flex-col items-center justify-center border-r border-navy-100 bg-surface p-2 text-center">
                    <div className="nums text-lg font-extrabold text-navy-900">{formatPrice(r.adult_price, r.currency)}</div>
                    <div className="text-[11px] text-ink-muted">للفرد</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
