import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Pencil, Plus, CheckCircle2, Archive, Copy, Eye, Building2, ImageDown } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/misc'
import { SectionTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Checkbox, Input } from '@/components/ui/inputs'
import { RatePeriodCard } from '@/components/RatePeriodCard'
import { PackageForm } from '@/components/PackageForm'
import { ExportActions } from '@/components/export/ExportActions'
import { useHotels } from '@/lib/hooks'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { groupRatesByHotel, groupRatesByPeriod } from '@/lib/rateGrouping'
import type { Package, Rate } from '@/types'

export default function PackageDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: pkg, isLoading, error } = useQuery({ queryKey: ['package', id], queryFn: () => api.get<Package>(`/packages/${id}`) })
  const { data: allHotels } = useHotels()

  const [edit, setEdit] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [copyOpen, setCopyOpen] = useState(false)
  const [targets, setTargets] = useState<number[]>([])
  const [clientName, setClientName] = useState('')

  const grouped = useMemo(() => {
    return groupRatesByHotel(pkg?.rates ?? [])
  }, [pkg])

  const readyRates = useMemo(() => (pkg?.rates ?? []).filter((r) => r.status === 'Ready'), [pkg])
  const exportRates = useMemo(() => {
    const pool = pkg?.rates ?? []
    if (selected.length > 0) return pool.filter((r) => selected.includes(r.id))
    return readyRates
  }, [pkg, readyRates, selected])

  const bulkStatus = useMutation({
    mutationFn: (status: string) => api.post('/rates/bulk-status', { ids: selected, status }),
    onSuccess: (_d, status) => { qc.invalidateQueries({ queryKey: ['package', id] }); toast.success(`تم تحديث ${selected.length} سعر`); setSelected([]); void status },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر التحديث'),
  })

  const copyRates = useMutation({
    mutationFn: () => api.post('/rates/copy', { rate_ids: selected, target_hotel_ids: targets }),
    onSuccess: (res: unknown) => { qc.invalidateQueries({ queryKey: ['package', id] }); toast.success(`تم نسخ ${(res as { rates_created: number }).rates_created} سعر`); setCopyOpen(false); setSelected([]); setTargets([]) },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر النسخ'),
  })

  if (isLoading) return <PageLoader />
  if (error || !pkg) return <ErrorState message={(error as Error)?.message ?? 'غير موجود'} />

  const toggle = (rid: number) => setSelected((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]))
  const toggleMany = (ids: number[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      ids.forEach((rid) => (checked ? next.add(rid) : next.delete(rid)))
      return Array.from(next)
    })
  }
  const selectedSet = new Set(selected)

  return (
    <div>
      <Link to="/packages" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4" />الباقات
      </Link>

      <div className="card mb-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-navy-900 sm:text-2xl">{pkg.package_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <Badge tone="gold">{pkg.package_type || 'باقة'}</Badge>
              {pkg.region && <span>{pkg.region}</span>}
              {pkg.group_name && <Badge tone="navy">{pkg.group_name}</Badge>}
            </div>
            {pkg.description && <p className="mt-2 text-sm text-ink">{pkg.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/sales/packages/${pkg.id}`}><Button variant="outline" size="sm"><Eye className="h-4 w-4" />عرض المبيعات</Button></Link>
            <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />تعديل</Button>
            <Link to={`/packages/${pkg.id}/add-rates`}><Button size="sm"><Plus className="h-4 w-4" />إضافة أسعار للفنادق</Button></Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-navy-100 pt-3">
          {(pkg.hotels ?? []).map((h) => (
            <Link key={h.id} to={`/hotels/${h.id}`} className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-100">
              <Building2 className="h-3 w-3" />{h.hotel_name}
            </Link>
          ))}
          {(pkg.hotels ?? []).length === 0 && <span className="text-xs text-ink-muted">لا توجد فنادق مرتبطة — عدّل الباقة لإضافتها</span>}
        </div>
      </div>

      <div className="card mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-navy-900">
              <ImageDown className="h-5 w-5 text-navy-600" />
              تصدير الباقة للعميل
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              بدون تحديد سيتم تصدير الأسعار الجاهزة فقط. عند تحديد أسعار من القائمة سيتم تصدير المحدد فقط.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="اسم العميل (اختياري)"
              className="sm:w-56"
            />
            <ExportActions
              size="sm"
              items={exportRates}
              client={clientName || null}
              title={pkg.package_name}
              subtitle={pkg.region}
              fileBase={`elbakri-${pkg.package_name}`}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
          <span className="rounded-full bg-navy-50 px-2.5 py-1">
            جاهز للتصدير: <span className="nums font-bold text-navy-900">{readyRates.length}</span>
          </span>
          <span className="rounded-full bg-gold/15 px-2.5 py-1 text-navy-900">
            سيصدر الآن: <span className="nums font-bold">{exportRates.length}</span>
          </span>
        </div>
      </div>

      <SectionTitle>الأسعار حسب الفندق</SectionTitle>
      {grouped.length === 0 ? (
        <EmptyState title="لا توجد أسعار في الباقة" description="أضف أسعارًا للفنادق المرتبطة وستظهر هنا تلقائيًا" action={<Link to={`/packages/${pkg.id}/add-rates`}><Button><Plus className="h-4 w-4" />إضافة أسعار للفنادق</Button></Link>} />
      ) : (
        <div className="space-y-4 pb-20">
          {grouped.map(([hotelName, rates]) => (
            <div key={hotelName}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-800"><Building2 className="h-4 w-4 text-navy-500" />{hotelName}</h3>
              <div className="space-y-3">
                {groupRatesByPeriod(rates).map((period) => (
                  <RatePeriodCard
                    key={`${hotelName}-${period.key}`}
                    rates={period.rates}
                    selectable
                    selectedIds={selectedSet}
                    onToggleRate={(rid) => toggle(rid)}
                    onToggleGroup={toggleMany}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-3 lg:bottom-4">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-card border border-navy-200 bg-white p-2.5 shadow-pop">
            <span className="px-2 text-sm font-bold text-navy-900"><span className="nums">{selected.length}</span> محدد</span>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="subtle" onClick={() => setSelected([])}>إلغاء</Button>
              <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}><Copy className="h-4 w-4" />نسخ لفنادق</Button>
              <Button size="sm" variant="outline" onClick={() => bulkStatus.mutate('Archived')} loading={bulkStatus.isPending}><Archive className="h-4 w-4" />أرشفة</Button>
              <Button size="sm" onClick={() => bulkStatus.mutate('Ready')} loading={bulkStatus.isPending}><CheckCircle2 className="h-4 w-4" />جاهز</Button>
            </div>
          </div>
        </div>
      )}

      <PackageForm open={edit} onClose={() => setEdit(false)} pkg={pkg} />

      <Modal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="نسخ الأسعار إلى فنادق"
        footer={<><Button variant="ghost" onClick={() => setCopyOpen(false)}>إلغاء</Button><Button onClick={() => targets.length ? copyRates.mutate() : toast.error('اختر فندقًا')} loading={copyRates.isPending}>نسخ ({selected.length} × {targets.length})</Button></>}
      >
        <p className="mb-3 text-sm text-ink-muted">سيتم نسخ {selected.length} سعر إلى الفنادق المختارة.</p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {(allHotels ?? []).map((h) => (
            <div key={h.id} className={cn('rounded-btn px-2', targets.includes(h.id) && 'bg-navy-50')}>
              <Checkbox checked={targets.includes(h.id)} onChange={(c) => setTargets((t) => (c ? [...t, h.id] : t.filter((x) => x !== h.id)))} label={`${h.hotel_name} · ${h.region ?? ''}`} />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
