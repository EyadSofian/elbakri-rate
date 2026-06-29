import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Save, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Select } from '@/components/ui/inputs'
import { SectionTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { PeriodsEditor, newPeriod, periodsToApi, countRecords, type Period } from '@/components/PeriodsEditor'
import { useHotels, usePackages, useLists } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export function MatrixBuilder({
  fixedPackageId,
  presetHotelIds,
  independentOnly,
  onDone,
}: {
  fixedPackageId?: number
  presetHotelIds?: number[]
  independentOnly?: boolean
  onDone?: () => void
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: hotels } = useHotels()
  const { data: packages } = usePackages()
  const { data: lists } = useLists()

  const [packageId, setPackageId] = useState<string>(fixedPackageId ? String(fixedPackageId) : '')
  const [hotelIds, setHotelIds] = useState<number[]>(presetHotelIds ?? [])
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])
  const [overwrite, setOverwrite] = useState(false)

  // When a package is chosen, restrict the hotel list to that package's hotels.
  const pkg = packages?.find((p) => String(p.id) === packageId)
  const hotelOptions = useMemo(() => {
    if (pkg && pkg.hotels) {
      const ids = new Set(pkg.hotels.map((h) => h.id))
      return (hotels ?? []).filter((h) => ids.has(h.id))
    }
    return hotels ?? []
  }, [hotels, pkg])

  const toggle = (id: number) => setHotelIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const expected = hotelIds.length * countRecords(periods)

  const save = useMutation({
    mutationFn: () =>
      api.post<{ rates_created: number }>('/rates/matrix', {
        package_id: independentOnly ? null : packageId ? Number(packageId) : null,
        hotel_ids: hotelIds,
        periods: periodsToApi(periods),
        overwrite,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries()
      toast.success(`تم إنشاء ${res.rates_created} سعر بنجاح`)
      setPeriods([newPeriod()])
      onDone?.()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر الحفظ'),
  })

  const submit = () => {
    if (hotelIds.length === 0) return toast.error('اختر فندقًا واحدًا على الأقل')
    if (countRecords(periods) === 0) return toast.error('أدخل سعرًا واحدًا على الأقل')
    save.mutate()
  }

  return (
    <div className="space-y-5 pb-24">
      {!fixedPackageId && !independentOnly && (
        <div className="card p-4">
          <Field label="الباقة (اختياري)">
            <Select value={packageId} onChange={(e) => { setPackageId(e.target.value); setHotelIds([]) }}>
              <option value="">— بدون باقة (أسعار مستقلة) —</option>
              {packages?.map((p) => <option key={p.id} value={p.id}>{p.package_name}</option>)}
            </Select>
          </Field>
          <p className="mt-1 text-xs text-ink-muted">عند اختيار باقة، تُعرض فنادقها فقط. بدون باقة تظهر كل الفنادق لأسعار مستقلة.</p>
        </div>
      )}

      <div className="card p-4">
        <SectionTitle>
          <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-navy-500" />الفنادق <span className="nums text-ink-muted">({hotelIds.length})</span></span>
        </SectionTitle>
        <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
          {hotelOptions.map((h) => (
            <div key={h.id} className={cn('rounded-btn px-2', hotelIds.includes(h.id) && 'bg-navy-50')}>
              <Checkbox checked={hotelIds.includes(h.id)} onChange={() => toggle(h.id)} label={<span>{h.hotel_name} <span className="text-xs text-ink-muted">· {h.region ?? ''}</span></span>} />
            </div>
          ))}
          {hotelOptions.length === 0 && <p className="p-3 text-sm text-ink-muted">لا توجد فنادق متاحة</p>}
        </div>
      </div>

      <div className="card p-4">
        <SectionTitle><span className="flex items-center gap-2"><Layers className="h-4 w-4 text-navy-500" />الفترات وأنواع الغرف</span></SectionTitle>
        <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-16 z-20 px-3 lg:bottom-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-card border border-navy-200 bg-white p-2.5 shadow-pop">
          <div className="flex items-center gap-3">
            <Checkbox checked={overwrite} onChange={setOverwrite} label="استبدال المكرر" />
            <span className="text-sm text-ink-muted">المتوقع: <span className="nums font-extrabold text-navy-900">{expected}</span> سعر</span>
          </div>
          <Button onClick={submit} loading={save.isPending} disabled={expected === 0}><Save className="h-4 w-4" />حفظ الأسعار</Button>
        </div>
      </div>
    </div>
  )
}
