import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, User, Phone, Printer, Share2, Building2, Send, Bus, Baby, CalendarDays, Utensils } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { PageLoader, ErrorState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge, QuoteStatusBadge } from '@/components/ui/badge'
import { ExportActions } from '@/components/export/ExportActions'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { formatPrice, formatDateRange } from '@/lib/utils'
import { mealLabel, roomLabel, transferText } from '@/lib/labels'
import { groupRates } from '@/lib/grouping'
import type { Quote, QuoteItem } from '@/types'

export default function QuoteDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { t, lang } = useI18n()
  const { data: quote, isLoading, error } = useQuery({ queryKey: ['quote', id], queryFn: () => api.get<Quote>(`/quotes/${id}`) })

  const items = useMemo(() => (quote?.items ?? []) as QuoteItem[], [quote])
  const groups = useMemo(() => groupRates(items), [items])

  const setStatus = useMutation({
    mutationFn: (status: string) => api.put(`/quotes/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quote', id] }); qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success(t('quote.statusUpdated')) },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.update')),
  })

  if (isLoading) return <PageLoader />
  if (error || !quote) return <ErrorState message={(error as Error)?.message ?? t('err.notFound')} />

  const allPeriods = t('export.allPeriods')

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success(t('quote.linkCopied'))
  }

  return (
    <div>
      <Link to="/quotes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />{t('nav.quotes')}
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
          {/* No explicit title → the export derives a clean name (single hotel →
              "عرض سعر {hotel}", package → package name) — never the quote code. */}
          <ExportActions
            items={items}
            client={quote.client_name}
            notes={quote.client_notes}
            quoteId={quote.id}
            fileBase={`elbakri-${quote.quote_number}`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-navy-100 pt-3">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="h-4 w-4" />{t('quote.copyLink')}</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('common.print')}</Button>
          {quote.status !== 'sent' && <Button variant="ghost" size="sm" onClick={() => setStatus.mutate('sent')}><Send className="h-4 w-4" />{t('quote.markSent')}</Button>}
        </div>
      </div>

      {/* Grouped preview: hotel → period → room prices */}
      <div className="space-y-6">
        {groups.map((h) => {
          const anyPeriodChild = h.periods.some((p) => p.childPolicy)
          return (
            <div key={h.hotelId ?? h.name}>
              <h3 className="mb-2 flex flex-wrap items-center gap-2 border-b-2 border-navy-900 pb-1.5 text-lg font-extrabold text-navy-900">
                <Building2 className="h-5 w-5 text-navy-500" />
                {h.name}
                {h.packageName && <Badge tone="gold">{h.packageName}</Badge>}
                {(h.region || h.subRegion) && (
                  <span className="text-sm font-medium text-ink-muted">{[h.region, h.subRegion].filter(Boolean).join(' · ')}</span>
                )}
              </h3>
              <div className="space-y-3">
                {h.periods.map((p) => (
                  <div key={p.key} className="overflow-hidden rounded-card border border-navy-100 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-900 px-3 py-2 text-white">
                      <span className="nums inline-flex items-center gap-1.5 text-sm font-bold">
                        <CalendarDays className="h-4 w-4 text-gold" />{formatDateRange(p.from, p.to, allPeriods)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <Utensils className="h-4 w-4 text-gold" />{mealLabel(p.meal, lang)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
                      {p.rates.map((r) => (
                        <div key={r.id} className="rounded-btn border border-navy-100 bg-surface p-2.5 text-center">
                          <div className="text-xs font-bold text-navy-600">{roomLabel(r.room_type, lang)}</div>
                          <div className="nums mt-1 text-lg font-extrabold text-navy-900">{formatPrice(r.adult_price, r.currency)}</div>
                        </div>
                      ))}
                    </div>
                    {(p.transfer === 'Included' || p.childPolicy) && (
                      <div className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-navy-50 px-3 py-2 text-xs text-ink-muted">
                        {p.transfer === 'Included' && (
                          <span className="inline-flex items-center gap-1 text-green-600"><Bus className="h-3.5 w-3.5" />{transferText('Included', lang)}</span>
                        )}
                        {p.childPolicy && (
                          <span className="inline-flex items-start gap-1"><Baby className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-500" />{p.childPolicy}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* General (shared) child policy — once per hotel */}
              {!anyPeriodChild && h.sharedChildPolicy && (
                <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-ink-muted">
                  <Baby className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-500" />{h.sharedChildPolicy}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
