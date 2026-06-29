import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Package as PackageIcon, Search } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { PeriodsEditor, countRecords, newPeriod, periodsToApi, type Period } from '@/components/PeriodsEditor'
import { useToast } from '@/components/ui/toast'
import { useHotels, useHotelGroups, useLists } from '@/lib/hooks'
import { REGIONS, mealPlanLabel, pricingBasisLabel } from '@/lib/labels'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Package, MealPlan, PricingBasis } from '@/types'

export function PackageForm({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg?: Package }) {
  const editing = !!pkg
  const toast = useToast()
  const qc = useQueryClient()
  const { data: hotels } = useHotels()
  const { data: groups } = useHotelGroups()
  const { data: lists } = useLists()

  const [f, setF] = useState({
    package_name: pkg?.package_name ?? '',
    package_type: pkg?.package_type ?? 'Package',
    region: pkg?.region ?? '',
    hotel_group_id: pkg?.hotel_group_id ? String(pkg.hotel_group_id) : '',
    description: pkg?.description ?? '',
    default_meal_plan: (pkg?.default_meal_plan ?? '') as MealPlan | '',
    default_pricing_basis: (pkg?.default_pricing_basis ?? '') as PricingBasis | '',
    status: pkg?.status ?? 'Active',
  })
  const [selected, setSelected] = useState<number[]>(pkg?.hotels?.map((h) => h.id) ?? [])
  const [hq, setHq] = useState('')
  const [withPricing, setWithPricing] = useState(false)
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const toggle = (hid: number) => setSelected((s) => (s.includes(hid) ? s.filter((x) => x !== hid) : [...s, hid]))
  const pricingPeriods = () => periodsToApi(periods).map((p) => ({ ...p, category: f.package_type || 'Package' }))

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...f,
        hotel_group_id: f.hotel_group_id ? Number(f.hotel_group_id) : null,
        default_meal_plan: f.default_meal_plan || null,
        default_pricing_basis: f.default_pricing_basis || null,
        hotel_ids: selected,
      }
      const saved = editing
        ? await api.put<Package>(`/packages/${pkg!.id}`, payload)
        : await api.post<Package>('/packages', payload)

      let ratesCreated = 0
      if (withPricing && countRecords(periods) > 0) {
        const res = await api.post<{ rates_created: number }>('/rates/matrix', {
          package_id: saved.id,
          hotel_ids: selected,
          periods: pricingPeriods(),
        })
        ratesCreated = res.rates_created
      }

      return { saved, ratesCreated }
    },
    onSuccess: ({ saved, ratesCreated }) => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      qc.invalidateQueries({ queryKey: ['package', String(saved.id)] })
      qc.invalidateQueries({ queryKey: ['rates'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(ratesCreated > 0 ? `تم الحفظ وإضافة ${ratesCreated} سعر` : 'تم الحفظ')
      setWithPricing(false)
      setPeriods([newPeriod()])
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر الحفظ'),
  })

  const filteredHotels = (hotels ?? []).filter((h) => !hq || h.hotel_name.toLowerCase().includes(hq.toLowerCase()))
  const expectedRates = selected.length * countRecords(periods)
  const submit = () => {
    if (!f.package_name.trim()) return toast.error('اسم الباقة مطلوب')
    if (withPricing && selected.length === 0) return toast.error('اختار فندق واحد على الأقل لإضافة أسعار للباقة')
    if (withPricing && countRecords(periods) === 0) return toast.error('أدخل سعرًا واحدًا على الأقل داخل الفترات')
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={<span className="flex items-center gap-2"><PackageIcon className="h-5 w-5 text-navy-600" />{editing ? 'تعديل باقة' : 'إضافة باقة'}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={submit} loading={save.isPending}>حفظ</Button></>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="اسم الباقة" required className="sm:col-span-2"><Input value={f.package_name} onChange={(e) => set('package_name', e.target.value)} placeholder="مثال: مجموعة الباتروس شرم الشيخ" /></Field>
        <Field label="النوع">
          <Select value={f.package_type} onChange={(e) => set('package_type', e.target.value)}>
            {['Package', 'Select', 'Premium', 'Elite', 'Honeymoon', 'Trip', 'Transfer'].map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="المنطقة">
          <Select value={f.region} onChange={(e) => set('region', e.target.value)}>
            <option value="">— اختر —</option>
            <option value="متعدد">متعدد</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="المجموعة">
          <Select value={f.hotel_group_id} onChange={(e) => set('hotel_group_id', e.target.value)}>
            <option value="">— بدون —</option>
            {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label="الإقامة الافتراضية">
          <Select value={f.default_meal_plan} onChange={(e) => set('default_meal_plan', e.target.value)}>
            <option value="">—</option>
            {(lists?.meal_plans ?? ['RO', 'BB', 'HB', 'FB', 'AI', 'UAI']).map((m) => <option key={m} value={m}>{mealPlanLabel[m] ?? m}</option>)}
          </Select>
        </Field>
        <Field label="أساس التسعير الافتراضي" className="sm:col-span-2">
          <Select value={f.default_pricing_basis} onChange={(e) => set('default_pricing_basis', e.target.value)}>
            <option value="">—</option>
            {(lists?.pricing_basis ?? Object.keys(pricingBasisLabel)).map((b) => <option key={b} value={b}>{pricingBasisLabel[b as PricingBasis] ?? b}</option>)}
          </Select>
        </Field>
        <Field label="الوصف" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label-base mb-0">الفنادق المشمولة <span className="nums text-ink-muted">({selected.length})</span></label>
            <div className="relative w-40">
              <Search className="pointer-events-none absolute inset-y-0 right-2 my-auto h-3.5 w-3.5 text-ink-muted" />
              <Input value={hq} onChange={(e) => setHq(e.target.value)} placeholder="بحث..." className="h-9 pr-7 text-xs" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-card border border-navy-100 p-1">
            {filteredHotels.length === 0 ? (
              <p className="p-3 text-center text-xs text-ink-muted">لا توجد فنادق</p>
            ) : (
              filteredHotels.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  className={cn('flex w-full items-center justify-between rounded-btn px-3 py-2 text-sm transition', selected.includes(h.id) ? 'bg-navy-900 text-white' : 'hover:bg-navy-50 text-navy-800')}
                >
                  <span>{h.hotel_name}</span>
                  <span className={cn('text-xs', selected.includes(h.id) ? 'text-navy-200' : 'text-ink-muted')}>{h.region}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-card border border-navy-100 bg-white p-3 sm:col-span-2">
          <label className="flex cursor-pointer items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-navy-900">إضافة أسعار للباقة الآن</div>
              <div className="text-xs text-ink-muted">
                الأسعار ستتسجل على الفنادق المختارة داخل هذه الباقة، مع إمكانية إضافة أكثر من فترة لكل غرفة.
              </div>
            </div>
            <input type="checkbox" checked={withPricing} onChange={(e) => setWithPricing(e.target.checked)} className="mt-1 h-5 w-5 accent-navy-700" />
          </label>

          {withPricing && (
            <div className="mt-3 border-t border-navy-100 pt-3">
              <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
              <p className="mt-2 text-center text-xs font-semibold text-navy-600">
                المتوقع إنشاء <span className="nums">{expectedRates}</span> سعر داخل الباقة
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
