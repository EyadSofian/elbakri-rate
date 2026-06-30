import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, Tag, Package as PackageIcon, MapPin, CheckCircle2, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { usePackages } from '@/lib/hooks'
import { PageHeader, PageLoader, EmptyState, Tabs } from '@/components/ui/misc'
import { Input, Select } from '@/components/ui/inputs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OfferCard } from '@/components/OfferCard'
import { useI18n } from '@/lib/i18n'
import { REGIONS, mealLabel, roomLabel, categoryText } from '@/lib/labels'
import type { Rate, MealPlan } from '@/types'

export default function SalesPage() {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<'hotels' | 'packages'>('hotels')
  const [showFilters, setShowFilters] = useState(false)
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [room, setRoom] = useState('')
  const [meal, setMeal] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [transfersOnly, setTransfersOnly] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['sales-rates'], queryFn: () => api.get<{ items: Rate[] }>('/rates', { per_page: 200 }), select: (d) => d.items })
  const { data: packages } = usePackages()

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (q && !(`${r.hotel_name} ${r.package_name ?? ''} ${r.offer_name ?? ''}`.toLowerCase().includes(q.toLowerCase()))) return false
      if (region && r.region !== region) return false
      if (room && r.room_type !== room) return false
      if (meal && r.meal_plan !== meal) return false
      if (transfersOnly && r.transfer_included !== 'Included') return false
      if (maxPrice && Number(r.adult_price ?? Infinity) > Number(maxPrice)) return false
      return true
    })
  }, [data, q, region, room, meal, transfersOnly, maxPrice])

  const hotelOffers = filtered.filter((r) => !r.package_id)
  const packageOffers = filtered.filter((r) => r.package_id)
  const list = tab === 'hotels' ? hotelOffers : packageOffers
  const readyPackages = (packages ?? []).filter((p) => (p.ready_rates_count ?? 0) > 0)

  return (
    <div>
      <PageHeader title={t('sales.title')} subtitle={t('sales.subtitle')} />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('sales.searchPlaceholder')} className="ps-9" />
        </div>
        <Button variant={showFilters ? 'subtle' : 'outline'} size="icon" onClick={() => setShowFilters((s) => !s)} aria-label={t('sales.filter')}>
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>

      {showFilters && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-card border border-navy-100 bg-white p-3 sm:grid-cols-4">
          <Select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t('sales.allRegions')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">{t('sales.allRooms')}</option>
            {['Single', 'Double', 'Triple', 'Family'].map((r) => <option key={r} value={r}>{roomLabel(r, lang)}</option>)}
          </Select>
          <Select value={meal} onChange={(e) => setMeal(e.target.value)}>
            <option value="">{t('sales.allMeals')}</option>
            {(['RO', 'BB', 'HB', 'FB', 'AI', 'UAI'] as MealPlan[]).map((m) => <option key={m} value={m}>{mealLabel(m, lang)}</option>)}
          </Select>
          <Input type="number" inputMode="decimal" placeholder={t('sales.maxPrice')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <label className="col-span-2 flex min-h-[44px] items-center gap-2 text-sm sm:col-span-4">
            <input type="checkbox" checked={transfersOnly} onChange={(e) => setTransfersOnly(e.target.checked)} className="h-5 w-5 accent-navy-700" />
            {t('sales.transfersOnly')}
          </label>
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'hotels', label: t('sales.tabHotels'), count: hotelOffers.length },
          { key: 'packages', label: t('sales.tabPackages'), count: packageOffers.length },
        ]}
      />

      {isLoading ? (
        <PageLoader />
      ) : tab === 'packages' && readyPackages.length > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readyPackages.map((p) => (
              <Link key={p.id} to={`/sales/packages/${p.id}`} className="card group flex flex-col gap-2 p-4 transition hover:border-gold hover:shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-navy-900">{p.package_name}</h3>
                  <Badge tone="gold">{categoryText(p.package_type, lang)}</Badge>
                </div>
                {p.region && <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3.5 w-3.5 shrink-0" />{p.region}</span>}
                <div className="mt-1 flex items-center justify-between border-t border-navy-100 pt-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /><span className="nums">{p.ready_rates_count}</span> {t('sales.readyRate')}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-navy-700 group-hover:text-gold-dark">{t('sales.proOffer')} <ArrowLeft className="h-3.5 w-3.5 shrink-0 ltr:rotate-180" /></span>
                </div>
              </Link>
            ))}
          </div>
          {packageOffers.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {packageOffers.map((r) => <OfferCard key={r.id} rate={r} />)}
            </div>
          )}
        </>
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'hotels' ? <Tag className="h-7 w-7" /> : <PackageIcon className="h-7 w-7" />}
          title={t('sales.emptyTitle')}
          description={t('sales.emptyDesc')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => <OfferCard key={r.id} rate={r} />)}
        </div>
      )}
    </div>
  )
}
