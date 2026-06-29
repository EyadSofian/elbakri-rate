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
import { RateRow } from '@/components/RateRow'
import { HotelForm } from '@/components/HotelForm'
import { RateForm } from '@/components/RateForm'
import { ImportModal } from '@/components/ImportModal'
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
  const list = tab === 'independent' ? independent : tab === 'package' ? pkgRates : (recent ?? [])

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
          { key: 'independent', label: 'أسعار الفنادق المستقلة', count: independent.length },
          { key: 'package', label: 'أسعار الباقات', count: pkgRates.length },
          { key: 'recent', label: 'أحدث التعديلات', count: recent?.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState title="لا توجد أسعار بعد" description="أضف سعرًا أو فندقًا للبدء" />
      ) : (
        <div className="space-y-2">
          {list.slice(0, 12).map((r) => <RateRow key={r.id} rate={r} showHotel />)}
        </div>
      )}

      <HotelForm open={addHotel} onClose={() => setAddHotel(false)} />
      <RateForm open={addRate} onClose={() => setAddRate(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
