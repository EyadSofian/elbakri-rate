import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, Eye, EyeOff, CheckSquare } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLoader, ErrorState, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/inputs'
import { ExportActions } from '@/components/export/ExportActions'
import { formatPrice, formatDateRange, cn } from '@/lib/utils'
import { mealLabel, roomLabel } from '@/lib/labels'
import type { Package, Rate } from '@/types'

export default function SalesPackagePage() {
  const { id } = useParams()
  const { data: pkg, isLoading, error } = useQuery({ queryKey: ['sales-package', id], queryFn: () => api.get<Package>(`/packages/${id}`) })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState(false)
  const [client, setClient] = useState('')

  const readyRates = useMemo(() => (pkg?.rates ?? []).filter((r) => r.status === 'Ready'), [pkg])
  const groups = useMemo(() => {
    const map = new Map<string, Rate[]>()
    for (const r of readyRates) {
      const k = r.hotel_name ?? 'فندق'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return Array.from(map.entries())
  }, [readyRates])

  if (isLoading) return <PageLoader />
  if (error || !pkg) return <ErrorState message={(error as Error)?.message ?? 'غير موجود'} />

  const chosen = readyRates.filter((r) => selected.size === 0 || selected.has(r.id))
  const toggle = (rid: number) => setSelected((s) => { const n = new Set(s); n.has(rid) ? n.delete(rid) : n.add(rid); return n })

  return (
    <div>
      <Link to="/sales" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-navy-800">
        <ArrowRight className="h-4 w-4" />عروض المبيعات
      </Link>

      {/* Branded package banner */}
      <div className="mb-5 overflow-hidden rounded-card bg-navy-900 p-6 text-white shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone="gold">{pkg.package_type || 'باقة'}</Badge>
            <h1 className="mt-2 text-2xl font-extrabold">{pkg.package_name}</h1>
            {pkg.region && <p className="mt-1 text-navy-200">{pkg.region}</p>}
          </div>
          <div className="text-left text-sm text-navy-200">
            <div className="nums text-3xl font-extrabold text-gold">{readyRates.length}</div>
            عرض جاهز
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
            placeholder="اسم العميل (اختياري)"
            className="input-base h-10 w-48"
          />
          <Button variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {preview ? 'إنهاء المعاينة' : 'معاينة العميل'}
          </Button>
        </div>
        <ExportActions
          size="sm"
          items={chosen}
          client={client || null}
          title={pkg.package_name}
          subtitle={pkg.region}
          fileBase={`elbakri-${pkg.package_name}`}
        />
      </div>

      {readyRates.length === 0 ? (
        <EmptyState title="لا توجد أسعار جاهزة في هذه الباقة" />
      ) : (
        <div className="space-y-5 pb-10">
          <p className="text-xs text-ink-muted">
            {selected.size === 0 ? 'سيتم تصدير كل الأسعار. حدد أسعارًا معينة لتخصيص العرض.' : `محدد ${selected.size} سعر للتصدير.`}
          </p>
          {groups.map(([hotel, rates]) => (
            <div key={hotel}>
              <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-navy-800">
                <Building2 className="h-4 w-4 text-navy-500" />{hotel}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rates.map((r) => {
                  const active = selected.has(r.id)
                  return (
                    <div key={r.id} className={cn('flex items-center justify-between gap-3 rounded-card border bg-white p-3', active ? 'border-gold ring-1 ring-gold/40' : 'border-navy-100')}>
                      {!preview && (
                        <Checkbox checked={active} onChange={() => toggle(r.id)} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-navy-900">{roomLabel(r.room_type)} · {mealLabel(r.meal_plan)}</div>
                        <div className="nums text-xs text-ink-muted">{formatDateRange(r.date_from, r.date_to)}</div>
                      </div>
                      <div className="nums text-lg font-extrabold text-navy-900">{formatPrice(r.adult_price, r.currency)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!preview && (
            <Button variant="subtle" size="sm" onClick={() => setSelected(new Set(readyRates.map((r) => r.id)))}>
              <CheckSquare className="h-4 w-4" />تحديد الكل
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
