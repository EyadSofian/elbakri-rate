import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, Building2, Upload, Grid3x3, MapPin } from 'lucide-react'
import { useHotels, useHotelGroups } from '@/lib/hooks'
import { PageHeader, EmptyState, PageLoader, ErrorState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/inputs'
import { Badge, Stars } from '@/components/ui/badge'
import { HotelForm } from '@/components/HotelForm'
import { ImportModal } from '@/components/ImportModal'
import { REGIONS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Hotel } from '@/types'

export default function HotelsPage() {
  const [showFilters, setShowFilters] = useState(false)
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [groupId, setGroupId] = useState('')
  const [status, setStatus] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { data: groups } = useHotelGroups()
  const { data: hotels, isLoading, error } = useHotels()

  const filtered = useMemo(() => {
    return (hotels ?? []).filter((h) => {
      if (q && !h.hotel_name.toLowerCase().includes(q.toLowerCase())) return false
      if (region && h.region !== region) return false
      if (groupId && String(h.hotel_group_id) !== groupId) return false
      if (status && h.status !== status) return false
      return true
    })
  }, [hotels, q, region, groupId, status])

  return (
    <div>
      <PageHeader
        title="الفنادق"
        subtitle="إدارة الفنادق المستقلة وأسعارها"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />استيراد</Button>
            <Link to="/rates/matrix/new"><Button variant="outline" size="sm"><Grid3x3 className="h-4 w-4" />مصفوفة أسعار</Button></Link>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />إضافة فندق</Button>
          </>
        }
      />

      {/* Search + filter toggle */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فندق..." className="pr-9" />
        </div>
        <Button variant={showFilters ? 'subtle' : 'outline'} size="icon" onClick={() => setShowFilters((s) => !s)} aria-label="فلترة">
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>

      {showFilters && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-card border border-navy-100 bg-white p-3 sm:grid-cols-3">
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">كل المناطق</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">كل المجموعات</option>
            {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">كل الحالات</option>
            <option value="Active">نشط</option>
            <option value="Inactive">غير نشط</option>
          </Select>
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={(error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title="لا توجد فنادق"
          description="ابدأ بإضافة أول فندق ومعه فترات الأسعار"
          action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />إضافة فندق</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => <HotelCard key={h.id} hotel={h} />)}
        </div>
      )}

      <HotelForm open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <Link to={`/hotels/${hotel.id}`} className="card group flex flex-col gap-2 p-4 transition hover:border-navy-200 hover:shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-navy-900 group-hover:text-navy-700">{hotel.hotel_name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{hotel.region || '—'}{hotel.sub_region ? ` · ${hotel.sub_region}` : ''}</span>
          </div>
        </div>
        <Stars count={hotel.star_rating} />
      </div>
      {hotel.group_name && <Badge tone="navy">{hotel.group_name}</Badge>}
      <div className="mt-1 flex items-center justify-between border-t border-navy-100 pt-2 text-xs">
        <span className="text-ink-muted">الأسعار: <span className="nums font-bold text-navy-800">{hotel.rates_count ?? 0}</span></span>
        <span className={cn('rounded-full px-2 py-0.5 font-semibold', (hotel.ready_count ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500')}>
          جاهز: <span className="nums">{hotel.ready_count ?? 0}</span>
        </span>
      </div>
    </Link>
  )
}
