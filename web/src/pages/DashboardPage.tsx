import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tag, CheckCircle2, FileEdit, Archive, Building2, Package, Plus, Grid3x3, Upload, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { useHotels, usePackages } from '@/lib/hooks'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/ui/misc'
import { StatCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, EmptyState } from '@/components/ui/misc'
import { RatePeriodCard } from '@/components/RatePeriodCard'
import { HotelForm } from '@/components/HotelForm'
import { RateForm } from '@/components/RateForm'
import { ImportModal } from '@/components/ImportModal'
import { groupRatesByHotel, groupRatesByPeriod } from '@/lib/rateGrouping'
import { downloadBlob } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import type { Rate } from '@/types'

function useCount(status?: string) {
  return useQuery({
    queryKey: ['rates-count', status],
    queryFn: () => api.get<{ total: number }>('/rates', { per_page: 1, ...(status ? { status } : {}) }),
    select: (d) => d.total,
  })
}

export default function DashboardPage() {
  const { canExport } = useAuth()
  const toast = useToast()
  const total = useCount()
  const ready = useCount('Ready')
  const draft = useCount('Draft')
  const archived = useCount('Archived')
  const { data: hotels } = useHotels()
  const { data: packages } = usePackages()
  const { data: recent } = useQuery({ queryKey: ['rates-recent'], queryFn: () => api.get<{ items: Rate[] }>('/rates', { per_page: 50 }), select: (d) => d.items })

  const [tab, setTab] = useState<'independent' | 'package' | 'recent'>('independent')
  const [addHotel, setAddHotel] = useState(false)
  const [addRate, setAddRate] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const independent = useMemo(() => (recent ?? []).filter((r) => !r.package_id), [recent])
  const pkgRates = useMemo(() => (recent ?? []).filter((r) => r.package_id), [recent])
  const independentGroups = useMemo(() => groupRatesByHotel(independent), [independent])
  const packageGroups = useMemo(() => groupRatesByHotel(pkgRates), [pkgRates])
  const recentGroups = useMemo(() => groupRatesByHotel(recent ?? []), [recent])
  const list = tab === 'independent' ? independent : tab === 'package' ? pkgRates : (recent ?? [])
  const groupedList = tab === 'independent' ? independentGroups : tab === 'package' ? packageGroups : recentGroups

  const exportCsv = async () => {
    try {
      const res = await api.raw.get('/export', { params: { type: 'rates' }, responseType: 'blob' })
      downloadBlob(res.data as Blob, 'elbakri_rates.csv')
    } catch {
      toast.error('تعذّر التصدير')
    }
  }

  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على الأسعار والفنادق والباقات" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="إجمالي الأسعار" value={total.data ?? '—'} icon={<Tag className="h-5 w-5" />} tone="navy" />
        <StatCard label="جاهزة" value={ready.data ?? '—'} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="مسودات" value={draft.data ?? '—'} icon={<FileEdit className="h-5 w-5" />} tone="amber" />
        <StatCard label="مؤرشفة" value={archived.data ?? '—'} icon={<Archive className="h-5 w-5" />} tone="slate" />
        <StatCard label="الفنادق" value={hotels?.length ?? '—'} icon={<Building2 className="h-5 w-5" />} tone="navy" />
        <StatCard label="الباقات" value={packages?.length ?? '—'} icon={<Package className="h-5 w-5" />} tone="gold" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAddHotel(true)}><Plus className="h-4 w-4" />إضافة فندق</Button>
        <Link to="/packages"><Button size="sm" variant="outline"><Package className="h-4 w-4" />إضافة باكدج</Button></Link>
        <Button size="sm" variant="outline" onClick={() => setAddRate(true)}><Tag className="h-4 w-4" />إضافة سعر</Button>
        <Link to="/rates/matrix/new"><Button size="sm" variant="outline"><Grid3x3 className="h-4 w-4" />مصفوفة أسعار</Button></Link>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />استيراد</Button>
        {canExport && <Button size="sm" variant="ghost" onClick={exportCsv}><Download className="h-4 w-4" />تصدير CSV</Button>}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'independent', label: 'أسعار الفنادق المستقلة', count: independentGroups.length },
          { key: 'package', label: 'أسعار الباقات', count: packageGroups.length },
          { key: 'recent', label: 'أحدث التعديلات', count: recentGroups.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState title="لا توجد أسعار بعد" description="أضف سعرًا أو فندقًا للبدء" />
      ) : (
        <div className="space-y-4">
          {groupedList.slice(0, 8).map(([hotelName, rates]) => {
            const first = rates[0]
            const periods = groupRatesByPeriod(rates)

            return (
              <section key={`${hotelName}-${first?.hotel_id ?? 'unknown'}`} className="rounded-card border border-navy-100 bg-white p-3 shadow-sm">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-4 w-4 text-navy-500" />
                      <h2 className="truncate text-base font-extrabold text-navy-900">{hotelName}</h2>
                      <span className="nums rounded-full bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-600">{periods.length} فترة</span>
                      <span className="nums rounded-full bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold-dark">{rates.length} سعر</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-muted">
                      {first?.hotel_group && <span>{first.hotel_group}</span>}
                      {first?.region && <span>{first.region}</span>}
                      {tab !== 'independent' && first?.package_name && <span>{first.package_name}</span>}
                    </div>
                  </div>
                  {first?.hotel_id && (
                    <Link to={`/hotels/${first.hotel_id}`} className="inline-flex min-h-[36px] items-center justify-center rounded-btn border border-navy-100 px-3 text-sm font-bold text-navy-700 hover:bg-navy-50">
                      فتح الفندق
                    </Link>
                  )}
                </div>
                <div className="space-y-2">
                  {periods.slice(0, 4).map((period) => (
                    <RatePeriodCard key={period.key} rates={period.rates} compact />
                  ))}
                  {periods.length > 4 && (
                    <div className="rounded-btn bg-navy-50 px-3 py-2 text-center text-xs font-bold text-navy-600">
                      +{periods.length - 4} فترات أخرى داخل صفحة الفندق
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <HotelForm open={addHotel} onClose={() => setAddHotel(false)} />
      <RateForm open={addRate} onClose={() => setAddRate(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
