import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, CalendarDays, Eye, EyeOff, CheckSquare, Utensils } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/inputs'
import { ExportActions } from '@/components/export/ExportActions'
import { useI18n } from '@/lib/i18n'
import { formatPrice, formatDateRange, cn } from '@/lib/utils'
import { mealLabel, roomLabel, categoryText } from '@/lib/labels'
import { groupRates } from '@/lib/grouping'
import type { Package } from '@/types'

export default function SalesPackagePage() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const { data: pkg, isLoading, error } = useQuery({ queryKey: ['sales-package', id], queryFn: () => api.get<Package>(`/packages/${id}`) })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState(false)
  const [client, setClient] = useState('')

  const readyRates = useMemo(() => (pkg?.rates ?? []).filter((r) => r.status === 'Ready'), [pkg])
  const groups = useMemo(() => groupRates(readyRates), [readyRates])
  const hotelInfo = useMemo(
    () =>
      Object.fromEntries(
        (pkg?.hotels ?? []).map((h) => [
          h.id,
          {
            description: h.description,
            childPolicyDefault: h.child_policy_default,
            transferNotesDefault: h.transfer_notes_default,
            facilities: h.facilities,
          },
        ]),
      ),
    [pkg],
  )

  if (isLoading) return <PageLoader />
  if (error || !pkg) return <ErrorState message={(error as Error)?.message ?? t('common.notFound')} />

  const chosen = readyRates.filter((r) => selected.size === 0 || selected.has(r.id))
  const toggle = (rid: number) => setSelected((s) => { const n = new Set(s); n.has(rid) ? n.delete(rid) : n.add(rid); return n })

  return (
    <div>
      <Link to="/sales" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />{t('sales.title')}
      </Link>

      {/* Branded package banner */}
      <div className="mb-5 overflow-hidden rounded-card bg-navy-900 p-6 text-white shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone="gold">{categoryText(pkg.package_type, lang)}</Badge>
            <h1 className="mt-2 text-2xl font-extrabold">{pkg.package_name}</h1>
            {pkg.region && <p className="mt-1 text-navy-200">{pkg.region}</p>}
          </div>
          <div className="text-end text-sm text-navy-200">
            <div className="nums text-3xl font-extrabold text-gold">{readyRates.length}</div>
            {t('sales.readyOffers')}
          </div>
        </div>
        {pkg.description && <p className="mt-3 max-w-2xl text-navy-100">{pkg.description}</p>}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 rounded-card border border-navy-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder={t('sales.clientName')}
            className="input-base h-10 w-48"
          />
          <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? t('sales.endPreview') : t('sales.previewClient')}
          </Button>
        </div>
        <ExportActions
          size="sm"
          items={chosen}
          client={client || null}
          title={pkg.package_name}
          subtitle={pkg.region}
          notes={pkg.description}
          hotelInfo={hotelInfo}
          detailsMode="prices-only"
          fileBase={`elbakri-${pkg.package_name}`}
        />
      </div>

      {readyRates.length === 0 ? (
        <EmptyState title={t('sales.noReadyInPackage')} />
      ) : (
        <div className="space-y-5 pb-10">
          <p className="text-xs text-ink-muted">
            {selected.size === 0 ? t('sales.exportAllHint') : t('sales.selectedHint', { n: selected.size })}
          </p>
          {groups.map((hotel) => (
            <section key={hotel.hotelId ?? hotel.name} className="overflow-hidden rounded-card border border-navy-100 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-900 px-4 py-3 text-white">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <Building2 className="h-4 w-4 shrink-0" />{hotel.name}
                </h3>
                {(hotel.region || hotel.subRegion) && (
                  <span className="text-xs font-semibold text-white/70">{[hotel.region, hotel.subRegion].filter(Boolean).join(' · ')}</span>
                )}
              </div>
              <div className="space-y-3 p-3">
                {hotel.periods.map((period) => (
                  <div key={period.key} className="overflow-hidden rounded-card border border-navy-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-50 px-3 py-2">
                      <span className="nums inline-flex items-center gap-1.5 text-sm font-bold text-navy-900">
                        <CalendarDays className="h-4 w-4 text-navy-500" />{formatDateRange(period.from, period.to, t('export.allPeriods'))}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                        <Utensils className="h-4 w-4 text-navy-500" />{mealLabel(period.meal, lang)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                      {period.rates.map((r) => {
                        const active = selected.has(r.id)
                        return (
                          <div key={r.id} className={cn('flex items-center justify-between gap-3 rounded-card border bg-surface p-3', active ? 'border-gold ring-1 ring-gold/40' : 'border-navy-100')}>
                            {!preview && <Checkbox checked={active} onChange={() => toggle(r.id)} />}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-navy-900">{roomLabel(r.room_type, lang)}</div>
                              <div className="mt-1 text-xs text-ink-muted">{mealLabel(r.meal_plan, lang)}</div>
                            </div>
                            <div className="nums text-lg font-extrabold text-navy-900">{formatPrice(r.adult_price, r.currency)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {!preview && (
            <Button variant="subtle" size="sm" onClick={() => setSelected(new Set(readyRates.map((r) => r.id)))}>
              <CheckSquare className="h-4 w-4" />{t('common.selectAll')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
