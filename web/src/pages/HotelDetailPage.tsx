import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Baby, Bus, Pencil, Plus, CalendarPlus, MapPin, Package, Tag, Trash2, Building2, CalendarDays, Utensils, ImageDown, CheckCircle2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { PageLoader, ErrorState, Tabs, EmptyState } from '@/components/ui/misc'
import { SectionTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, Stars } from '@/components/ui/badge'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { HotelForm } from '@/components/HotelForm'
import { RateForm } from '@/components/RateForm'
import { ExportActions } from '@/components/export/ExportActions'
import { PeriodsEditor, newPeriod, periodsToApi, countRecords, type Period } from '@/components/PeriodsEditor'
import { useLists } from '@/lib/hooks'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/context/AuthContext'
import { formatPrice, formatDateRange } from '@/lib/utils'
import { mealLabel, roomLabel } from '@/lib/labels'
import { groupRates } from '@/lib/grouping'
import type { Hotel, Rate } from '@/types'

export default function HotelDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { t, lang } = useI18n()
  const { canEdit, canExport } = useAuth()
  const { data: lists } = useLists()
  const { data: hotel, isLoading, error } = useQuery({ queryKey: ['hotel', id], queryFn: () => api.get<Hotel>(`/hotels/${id}`) })

  const [tab, setTab] = useState<'independent' | 'package' | 'packages'>('independent')
  const [editHotel, setEditHotel] = useState(false)
  const [addRate, setAddRate] = useState(false)
  const [editRate, setEditRate] = useState<Rate | null>(null)
  const [delRate, setDelRate] = useState<Rate | null>(null)
  const [delHotel, setDelHotel] = useState(false)
  const [periodsOpen, setPeriodsOpen] = useState(false)
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])

  const addPeriods = useMutation({
    mutationFn: () => api.post('/rates/matrix', { hotel_ids: [Number(id)], periods: periodsToApi(periods) }),
    onSuccess: (res: unknown) => {
      qc.invalidateQueries({ queryKey: ['hotel', id] })
      toast.success(t('hotel.ratesAdded', { n: (res as { rates_created: number }).rates_created }))
      setPeriodsOpen(false)
      setPeriods([newPeriod()])
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const removeRate = useMutation({
    mutationFn: (rid: number) => api.del(`/rates/${rid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hotel', id] }); toast.success(t('hotel.rateDeleted')); setDelRate(null) },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.delete')),
  })

  const markReady = useMutation({
    mutationFn: (ids: number[]) => api.post<{ updated: number }>('/rates/bulk-status', { ids, status: 'Ready' }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['hotel', id] })
      qc.invalidateQueries({ queryKey: ['hotels'] })
      toast.success(t('bulk.periodReadyDone', { n: res.updated }))
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.update')),
  })

  const removeHotel = useMutation({
    mutationFn: () => api.del(`/hotels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hotels'] })
      toast.success(t('hotel.deleted'))
      navigate('/hotels')
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.delete')),
  })

  const independent = hotel?.independent_rates ?? []
  const pkgRates = hotel?.package_rates ?? []
  const allRates = useMemo(() => [...independent, ...pkgRates], [independent, pkgRates])
  const readyRates = useMemo(() => allRates.filter((r) => r.status === 'Ready'), [allRates])
  const list = tab === 'independent' ? independent : pkgRates
  const grouped = useMemo(() => groupRates(list), [list])

  if (isLoading) return <PageLoader />
  if (error || !hotel) return <ErrorState message={(error as Error)?.message ?? t('err.notFound')} />

  const hotelInfo = {
    [hotel.id]: {
      description: hotel.description,
      childPolicyDefault: hotel.child_policy_default,
      transferNotesDefault: hotel.transfer_notes_default,
      facilities: hotel.facilities,
    },
  }

  return (
    <div>
      <Link to="/hotels" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />{t('nav.hotels')}
      </Link>

      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-navy-900 sm:text-2xl">{hotel.hotel_name}</h1>
              <Stars count={hotel.star_rating} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{hotel.region || t('common.dash')}{hotel.sub_region ? ` · ${hotel.sub_region}` : ''}</span>
              {hotel.group_name && <Badge tone="navy">{hotel.group_name}</Badge>}
              <Badge tone={hotel.status === 'Active' ? 'green' : 'slate'}>{hotel.status === 'Active' ? t('common.active') : t('common.inactive')}</Badge>
            </div>
            {hotel.child_policy_default && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink">
                <Baby className="h-4 w-4 text-navy-500" />
                {hotel.child_policy_default}
              </p>
            )}
            {hotel.transfer_notes_default && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink">
                <Bus className="h-4 w-4 text-navy-500" />
                {hotel.transfer_notes_default}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditHotel(true)}><Pencil className="h-4 w-4" />{t('common.edit')}</Button>
                <Button variant="outline" size="sm" onClick={() => setPeriodsOpen(true)}><CalendarPlus className="h-4 w-4" />{t('hotel.periods')}</Button>
                <Button size="sm" onClick={() => setAddRate(true)}><Plus className="h-4 w-4" />{t('hotel.addRate')}</Button>
                <Button variant="danger" size="sm" onClick={() => setDelHotel(true)}><Trash2 className="h-4 w-4" />{t('common.delete')}</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Export this hotel's ready rates (grouped) */}
      {canExport && (
      <div className="card mb-5 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-navy-900">
            <ImageDown className="h-5 w-5 text-navy-600" />{t('hotel.exportTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('hotel.exportHint')}</p>
        </div>
        <ExportActions
          size="sm"
          mode="hotel"
          items={readyRates}
          subtitle={[hotel.region, hotel.sub_region].filter(Boolean).join(' · ') || null}
          hotelInfo={hotelInfo}
          fileBase={`elbakri-${hotel.hotel_name}`}
        />
      </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'independent', label: t('hotel.tabIndependent'), count: independent.length },
          { key: 'package', label: t('hotel.tabPackage'), count: pkgRates.length },
          { key: 'packages', label: t('hotel.tabPackages'), count: hotel.packages?.length },
        ]}
      />

      {tab === 'packages' ? (
        (hotel.packages ?? []).length === 0 ? (
          <EmptyState icon={<Package className="h-7 w-7" />} title={t('hotel.noPackages')} />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hotel.packages!.map((p) => (
              <Link key={p.id} to={`/packages/${p.id}`} className="card flex items-center justify-between p-3 hover:border-navy-200">
                <span className="font-semibold text-navy-900">{p.package_name}</span>
                <Badge tone="navy">{p.package_type || t('category.default.package')}</Badge>
              </Link>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState icon={<Tag className="h-7 w-7" />} title={t('hotel.noRates')} description={t('hotel.noRatesDesc')} action={canEdit ? <Button onClick={() => setAddRate(true)}><Plus className="h-4 w-4" />{t('hotel.addRate')}</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {grouped.map((h) =>
            h.periods.map((p) => (
              <div key={p.key} className="overflow-hidden rounded-card border border-navy-100 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="nums inline-flex items-center gap-1.5 text-sm font-bold text-navy-900">
                      <CalendarDays className="h-4 w-4 text-navy-500" />{formatDateRange(p.from, p.to, t('export.allPeriods'))}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                      <Utensils className="h-4 w-4 text-navy-500" />{mealLabel(p.meal, lang)}
                    </span>
                    {p.rates[0] && <Badge tone={p.rates[0].status === 'Ready' ? 'green' : p.rates[0].status === 'Draft' ? 'amber' : 'slate'}>{t(`status.${p.rates[0].status}`)}</Badge>}
                  </div>
                  {canEdit && p.rates.some((r) => r.status !== 'Ready') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markReady.mutate(p.rates.filter((r) => r.status !== 'Ready').map((r) => r.id))}
                      loading={markReady.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />{t('bulk.markPeriodReady')}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {p.rates.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-btn border border-navy-100 bg-surface px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-navy-600">{roomLabel(r.room_type, lang)}</div>
                        <div className="nums text-base font-extrabold text-navy-900">{formatPrice(r.adult_price, r.currency)}</div>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => setEditRate(r)} className="grid h-8 w-8 place-items-center rounded-btn text-navy-500 hover:bg-navy-100" aria-label={t('common.edit')}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDelRate(r)} className="grid h-8 w-8 place-items-center rounded-btn text-red-500 hover:bg-red-50" aria-label={t('common.delete')}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )),
          )}
        </div>
      )}

      {canEdit && (
        <>
          <HotelForm open={editHotel} onClose={() => setEditHotel(false)} hotel={hotel} />
          <RateForm open={addRate} onClose={() => setAddRate(false)} fixedHotelId={hotel.id} />
          {editRate && <RateForm open onClose={() => setEditRate(null)} rate={editRate} />}
        </>
      )}

      {canEdit && <Modal
        open={periodsOpen}
        onClose={() => setPeriodsOpen(false)}
        size="xl"
        title={t('hotel.addPeriodsTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPeriodsOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => addPeriods.mutate()} loading={addPeriods.isPending}>{t('hotel.savePeriods', { n: countRecords(periods) })}</Button>
          </>
        }
      >
        <SectionTitle>{t('hotel.periodsSection')}</SectionTitle>
        <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
      </Modal>}

      <ConfirmDialog
        open={!!delRate}
        onClose={() => setDelRate(null)}
        onConfirm={() => delRate && removeRate.mutate(delRate.id)}
        danger
        confirmText={t('common.delete')}
        loading={removeRate.isPending}
        message={t('hotel.deleteRateQ')}
      />
      <ConfirmDialog
        open={delHotel}
        onClose={() => setDelHotel(false)}
        onConfirm={() => removeHotel.mutate()}
        danger
        confirmText={t('common.delete')}
        loading={removeHotel.isPending}
        message={t('hotel.deleteQ', { name: hotel.hotel_name })}
      />
    </div>
  )
}
