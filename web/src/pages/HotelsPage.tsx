import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, SlidersHorizontal, Building2, Upload, MapPin, ImageDown } from 'lucide-react'
import { api } from '@/lib/api'
import { useHotels, useHotelGroups } from '@/lib/hooks'
import { PageHeader, EmptyState, PageLoader, ErrorState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/inputs'
import { Badge, Stars } from '@/components/ui/badge'
import { HotelForm } from '@/components/HotelForm'
import { ImportModal } from '@/components/ImportModal'
import { ExportActions } from '@/components/export/ExportActions'
import { useI18n } from '@/lib/i18n'
import { REGIONS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Hotel } from '@/types'

export default function HotelsPage() {
  const { t } = useI18n()
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
        title={t('nav.hotels')}
        subtitle={t('hotels.subtitle')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />{t('common.import')}</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />{t('hotels.add')}</Button>
          </>
        }
      />

      {/* Search + filter toggle */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('hotels.searchPlaceholder')} className="ps-9" />
        </div>
        <Button variant={showFilters ? 'subtle' : 'outline'} size="icon" onClick={() => setShowFilters((s) => !s)} aria-label={t('sales.filter')}>
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>

      {showFilters && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-card border border-navy-100 bg-white p-3 sm:grid-cols-3">
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t('sales.allRegions')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">{t('filter.allGroups')}</option>
            {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('filter.allStatuses')}</option>
            <option value="Active">{t('common.active')}</option>
            <option value="Inactive">{t('common.inactive')}</option>
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
          title={t('hotels.emptyTitle')}
          description={t('hotels.emptyDesc')}
          action={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />{t('hotels.add')}</Button>}
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
  const { t } = useI18n()
  return (
    <div className="card flex flex-col gap-2 p-4">
      <Link to={`/hotels/${hotel.id}`} className="group flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-navy-900 group-hover:text-navy-700">{hotel.hotel_name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{hotel.region || t('common.dash')}{hotel.sub_region ? ` · ${hotel.sub_region}` : ''}</span>
            </div>
          </div>
          <Stars count={hotel.star_rating} />
        </div>
        {hotel.group_name && <Badge tone="navy">{hotel.group_name}</Badge>}
        <div className="mt-1 flex items-center justify-between border-t border-navy-100 pt-2 text-xs">
          <span className="text-ink-muted">{t('hotels.ratesLabel')}: <span className="nums font-bold text-navy-800">{hotel.rates_count ?? 0}</span></span>
          <span className={cn('rounded-full px-2 py-0.5 font-semibold', (hotel.ready_count ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500')}>
            {t('hotels.readyLabel')}: <span className="nums">{hotel.ready_count ?? 0}</span>
          </span>
        </div>
      </Link>
      {(hotel.rates_count ?? 0) > 0 && (
        <div className="border-t border-navy-50 pt-2">
          <HotelQuickExport hotelId={hotel.id} hotelName={hotel.hotel_name} region={hotel.region} subRegion={hotel.sub_region} />
        </div>
      )}
    </div>
  )
}

/** Lazily fetches a hotel's full rate set on demand, then reveals PNG/PDF/WhatsApp. */
function HotelQuickExport({ hotelId, hotelName, region, subRegion }: { hotelId: number; hotelName: string; region: string | null; subRegion: string | null }) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const { data, isFetching } = useQuery({
    queryKey: ['hotel', String(hotelId)],
    queryFn: () => api.get<Hotel>(`/hotels/${hotelId}`),
    enabled,
  })
  const items = useMemo(() => [...(data?.independent_rates ?? []), ...(data?.package_rates ?? [])], [data])

  if (!enabled) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEnabled(true)}>
        <ImageDown className="h-4 w-4" />{t('hotels.quickExport')}
      </Button>
    )
  }
  if (isFetching || !data) {
    return <span className="text-xs text-ink-muted">{t('hotels.loadingExport')}</span>
  }
  return (
    <ExportActions
      size="sm"
      mode="hotel"
      items={items}
      subtitle={[region, subRegion].filter(Boolean).join(' · ') || null}
      hotelInfo={{ [hotelId]: { description: data.description, childPolicyDefault: data.child_policy_default, transferNotesDefault: data.transfer_notes_default, facilities: data.facilities } }}
      fileBase={`elbakri-${hotelName}`}
    />
  )
}
