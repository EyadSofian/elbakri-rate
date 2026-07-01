import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Building2, CalendarDays, CheckCircle2, Eye, ImageDown, Pencil, Trash2, Utensils } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/misc'
import { SectionTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, RateStatusBadge } from '@/components/ui/badge'
import { Checkbox, Input } from '@/components/ui/inputs'
import { PackageForm } from '@/components/PackageForm'
import { ExportActions } from '@/components/export/ExportActions'
import { ConfirmDialog } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { categoryText, mealLabel, roomLabel } from '@/lib/labels'
import { formatDateRange, formatPrice } from '@/lib/utils'
import { groupRates } from '@/lib/grouping'
import type { Package } from '@/types'

export default function PackageDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { t, lang } = useI18n()
  const { data: pkg, isLoading, error } = useQuery({
    queryKey: ['package', id],
    queryFn: () => api.get<Package>(`/packages/${id}`),
  })

  const [edit, setEdit] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [clientName, setClientName] = useState('')

  const readyRates = useMemo(() => (pkg?.rates ?? []).filter((r) => r.status === 'Ready'), [pkg])
  const exportRates = useMemo(() => {
    const pool = pkg?.rates ?? []
    if (selected.length > 0) return pool.filter((r) => selected.includes(r.id))
    return readyRates
  }, [pkg, readyRates, selected])
  const groups = useMemo(() => groupRates(pkg?.rates ?? []), [pkg])
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

  const deletePackage = useMutation({
    mutationFn: () => api.del(`/packages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      toast.success(t('package.deleted'))
      navigate('/packages')
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.delete')),
  })

  const markReady = useMutation({
    mutationFn: (ids: number[]) => api.post<{ updated: number }>('/rates/bulk-status', { ids, status: 'Ready' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['package', id] })
      qc.invalidateQueries({ queryKey: ['packages'] })
      toast.success(t('bulk.periodReadyDone', { n: res.updated }))
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.update')),
  })

  if (isLoading) return <PageLoader />
  if (error || !pkg) return <ErrorState message={(error as Error)?.message ?? t('err.notFound')} />

  const toggle = (rid: number) => setSelected((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]))

  return (
    <div>
      <Link to="/packages" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />{t('nav.packages')}
      </Link>

      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-navy-900 sm:text-2xl">{pkg.package_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Badge tone="gold">{categoryText(pkg.package_type, lang)}</Badge>
              {pkg.region && <span>{pkg.region}</span>}
              {pkg.group_name && <Badge tone="navy">{pkg.group_name}</Badge>}
            </div>
            {pkg.description && <p className="mt-2 text-sm text-ink">{pkg.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/sales/packages/${pkg.id}`}>
              <Button variant="outline" size="sm"><Eye className="h-4 w-4" />{t('package.salesView')}</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
              <Pencil className="h-4 w-4" />{t('package.manageHotels')}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />{t('common.delete')}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-navy-100 pt-3">
          {(pkg.hotels ?? []).map((h) => (
            <Link key={h.id} to={`/hotels/${h.id}`} className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-100">
              <Building2 className="h-3 w-3" />{h.hotel_name}
            </Link>
          ))}
          {(pkg.hotels ?? []).length === 0 && <span className="text-xs text-ink-muted">{t('package.noHotels')}</span>}
        </div>
      </div>

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-navy-900">
              <ImageDown className="h-5 w-5 text-navy-600" />
              {t('pkg.exportTitle')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('pkg.exportHint')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t('sales.clientName')} className="sm:w-56" />
            <ExportActions
              size="sm"
              items={exportRates}
              client={clientName || null}
              title={pkg.package_name}
              subtitle={pkg.region}
              notes={pkg.description}
              hotelInfo={hotelInfo}
              fileBase={`elbakri-${pkg.package_name}`}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
          <span className="rounded-full bg-navy-50 px-2.5 py-1">
            {t('pkg.readyToExport')}: <span className="nums font-bold text-navy-900">{readyRates.length}</span>
          </span>
          <span className="rounded-full bg-gold/15 px-2.5 py-1 text-navy-900">
            {t('pkg.willExport')}: <span className="nums font-bold">{exportRates.length}</span>
          </span>
        </div>
      </div>

      <SectionTitle>{t('package.ratesByHotel')}</SectionTitle>
      {(pkg.hotels ?? []).length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title={t('package.noHotelsTitle')}
          description={t('package.noHotels')}
          action={<Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />{t('package.manageHotels')}</Button>}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title={t('package.noRatesInPackage')}
          description={t('package.noRatesDesc')}
        />
      ) : (
        <div className="space-y-5 pb-20">
          {groups.map((hotel) => (
            <section key={hotel.hotelId ?? hotel.name} className="overflow-hidden rounded-card border border-navy-100 bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3 bg-navy-900 px-4 py-3 text-white">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-extrabold">
                    <Building2 className="h-4 w-4" />{hotel.name}
                  </h3>
                  {(hotel.region || hotel.subRegion) && (
                    <p className="mt-1 text-xs font-semibold text-white/70">{[hotel.region, hotel.subRegion].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <Badge tone="gold"><span className="nums">{hotel.periods.reduce((sum, p) => sum + p.rates.length, 0)}</span> {t('package.ratesCount')}</Badge>
              </div>

              <div className="space-y-3 p-3">
                {hotel.periods.map((period) => (
                  <div key={period.key} className="overflow-hidden rounded-card border border-navy-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-50 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="nums inline-flex items-center gap-1.5 text-sm font-bold text-navy-900">
                          <CalendarDays className="h-4 w-4 text-navy-500" />{formatDateRange(period.from, period.to, t('export.allPeriods'))}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                          <Utensils className="h-4 w-4 text-navy-500" />{mealLabel(period.meal, lang)}
                        </span>
                      </div>
                      {period.rates.some((rate) => rate.status !== 'Ready') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markReady.mutate(period.rates.filter((rate) => rate.status !== 'Ready').map((rate) => rate.id))}
                          loading={markReady.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />{t('bulk.markPeriodReady')}
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {period.rates.map((rate) => (
                        <div key={rate.id} className="flex min-h-[76px] items-center gap-3 rounded-card border border-navy-100 bg-surface px-3 py-2 transition hover:border-navy-200">
                          <Checkbox checked={selected.includes(rate.id)} onChange={() => toggle(rate.id)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-navy-600">{roomLabel(rate.room_type, lang)}</span>
                              <RateStatusBadge status={rate.status} />
                            </div>
                            <div className="nums mt-1 text-lg font-extrabold text-navy-900">{formatPrice(rate.adult_price, rate.currency)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <PackageForm open={edit} onClose={() => setEdit(false)} pkg={pkg} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deletePackage.mutate()}
        danger
        confirmText={t('common.delete')}
        loading={deletePackage.isPending}
        message={t('package.deleteQ', { name: pkg.package_name })}
      />
    </div>
  )
}
