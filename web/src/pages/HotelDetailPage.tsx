import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Baby, Pencil, Plus, CalendarPlus, MapPin, Package, Tag, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { PageLoader, ErrorState, Tabs, EmptyState } from '@/components/ui/misc'
import { SectionTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, Stars } from '@/components/ui/badge'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { RatePeriodCard } from '@/components/RatePeriodCard'
import { HotelForm } from '@/components/HotelForm'
import { RateForm } from '@/components/RateForm'
import { PeriodsEditor, newPeriod, periodsToApi, countRecords, type Period } from '@/components/PeriodsEditor'
import { groupRatesByPeriod } from '@/lib/rateGrouping'
import { useLists } from '@/lib/hooks'
import { useToast } from '@/components/ui/toast'
import type { Hotel, Rate } from '@/types'

export default function HotelDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: lists } = useLists()
  const { data: hotel, isLoading, error } = useQuery({ queryKey: ['hotel', id], queryFn: () => api.get<Hotel>(`/hotels/${id}`) })

  const [tab, setTab] = useState<'independent' | 'package' | 'packages'>('independent')
  const [editHotel, setEditHotel] = useState(false)
  const [addRate, setAddRate] = useState(false)
  const [editRate, setEditRate] = useState<Rate | null>(null)
  const [delRate, setDelRate] = useState<Rate | null>(null)
  const [periodsOpen, setPeriodsOpen] = useState(false)
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])

  const addPeriods = useMutation({
    mutationFn: () => api.post('/rates/matrix', { hotel_ids: [Number(id)], periods: periodsToApi(periods) }),
    onSuccess: (res: unknown) => {
      qc.invalidateQueries({ queryKey: ['hotel', id] })
      toast.success(`تمت إضافة ${(res as { rates_created: number }).rates_created} سعر`)
      setPeriodsOpen(false)
      setPeriods([newPeriod()])
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر الحفظ'),
  })

  const removeRate = useMutation({
    mutationFn: (rid: number) => api.del(`/rates/${rid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hotel', id] }); toast.success('تم حذف السعر'); setDelRate(null) },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر الحذف'),
  })

  if (isLoading) return <PageLoader />
  if (error || !hotel) return <ErrorState message={(error as Error)?.message ?? 'غير موجود'} />

  const independent = hotel.independent_rates ?? []
  const pkgRates = hotel.package_rates ?? []
  const list = tab === 'independent' ? independent : pkgRates

  return (
    <div>
      <Link to="/hotels" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4" />الفنادق
      </Link>

      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-navy-900 sm:text-2xl">{hotel.hotel_name}</h1>
              <Stars count={hotel.star_rating} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{hotel.region || '—'}{hotel.sub_region ? ` · ${hotel.sub_region}` : ''}</span>
              {hotel.group_name && <Badge tone="navy">{hotel.group_name}</Badge>}
              <Badge tone={hotel.status === 'Active' ? 'green' : 'slate'}>{hotel.status === 'Active' ? 'نشط' : 'غير نشط'}</Badge>
            </div>
            {hotel.child_policy_default && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink">
                <Baby className="h-4 w-4 text-navy-500" />
                {hotel.child_policy_default}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditHotel(true)}><Pencil className="h-4 w-4" />تعديل</Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodsOpen(true)}><CalendarPlus className="h-4 w-4" />فترات أسعار</Button>
            <Button size="sm" onClick={() => setAddRate(true)}><Plus className="h-4 w-4" />إضافة سعر</Button>
          </div>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'independent', label: 'أسعار مستقلة', count: independent.length },
          { key: 'package', label: 'أسعار داخل باكدجات', count: pkgRates.length },
          { key: 'packages', label: 'الباقات المرتبطة', count: hotel.packages?.length },
        ]}
      />

      {tab === 'packages' ? (
        (hotel.packages ?? []).length === 0 ? (
          <EmptyState icon={<Package className="h-7 w-7" />} title="غير مرتبط بأي باقة" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hotel.packages!.map((p) => (
              <Link key={p.id} to={`/packages/${p.id}`} className="card flex items-center justify-between p-3 hover:border-navy-200">
                <span className="font-semibold text-navy-900">{p.package_name}</span>
                <Badge tone="navy">{p.package_type || 'باقة'}</Badge>
              </Link>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState icon={<Tag className="h-7 w-7" />} title="لا توجد أسعار" description="أضف سعرًا أو فترات أسعار" action={<Button onClick={() => setAddRate(true)}><Plus className="h-4 w-4" />إضافة سعر</Button>} />
      ) : (
        <div className="space-y-3">
          {groupRatesByPeriod(list).map((group) => (
            <RatePeriodCard
              key={group.key}
              rates={group.rates}
              onEditRate={setEditRate}
              onDeleteRate={setDelRate}
            />
          ))}
        </div>
      )}

      <HotelForm open={editHotel} onClose={() => setEditHotel(false)} hotel={hotel} />
      <RateForm open={addRate} onClose={() => setAddRate(false)} fixedHotelId={hotel.id} />
      {editRate && <RateForm open onClose={() => setEditRate(null)} rate={editRate} />}

      <Modal
        open={periodsOpen}
        onClose={() => setPeriodsOpen(false)}
        size="xl"
        title="إضافة فترات أسعار"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPeriodsOpen(false)}>إلغاء</Button>
            <Button onClick={() => addPeriods.mutate()} loading={addPeriods.isPending}>حفظ ({countRecords(periods)} سعر)</Button>
          </>
        }
      >
        <SectionTitle>الفترات</SectionTitle>
        <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
      </Modal>

      <ConfirmDialog
        open={!!delRate}
        onClose={() => setDelRate(null)}
        onConfirm={() => delRate && removeRate.mutate(delRate.id)}
        danger
        confirmText="حذف"
        loading={removeRate.isPending}
        message="هل تريد حذف هذا السعر؟"
      />
    </div>
  )
}
