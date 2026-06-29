import { Plus, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { mealPlanLabel, pricingBasisLabel, rateStatusLabel, transferLabel } from '@/lib/labels'
import type { Lists, MealPlan, PricingBasis, Currency, RateStatus, TransferOpt } from '@/types'

export interface Period {
  id: string
  date_from: string
  date_to: string
  meal_plan: MealPlan
  pricing_basis: PricingBasis
  currency: Currency
  status: RateStatus
  season_name: string
  transfer_included: TransferOpt
  child_policy: string
  transfer_details: string
  booking_notes: string
  double: string
  triple: string
  single: string
  custom_room: string
  custom_price: string
}

let counter = 0
export function newPeriod(defaults?: Partial<Period>): Period {
  counter += 1
  return {
    id: `p${counter}_${Math.random().toString(36).slice(2, 7)}`,
    date_from: '',
    date_to: '',
    meal_plan: 'BB',
    pricing_basis: 'per_person_per_night',
    currency: 'EGP',
    status: 'Draft',
    season_name: '',
    transfer_included: 'Optional',
    child_policy: '',
    transfer_details: '',
    booking_notes: '',
    double: '',
    triple: '',
    single: '',
    custom_room: '',
    custom_price: '',
    ...defaults,
  }
}

/** Convert form periods to the API `periods[]` payload (prices map per room type). */
export function periodsToApi(periods: Period[]) {
  return periods.map((p) => {
    const prices: Record<string, number> = {}
    if (Number(p.double) > 0) prices.Double = Number(p.double)
    if (Number(p.triple) > 0) prices.Triple = Number(p.triple)
    if (Number(p.single) > 0) prices.Single = Number(p.single)
    if (p.custom_room && Number(p.custom_price) > 0) prices[p.custom_room] = Number(p.custom_price)
    return {
      date_from: p.date_from || null,
      date_to: p.date_to || null,
      meal_plan: p.meal_plan,
      pricing_basis: p.pricing_basis,
      currency: p.currency,
      status: p.status,
      season_name: p.season_name || null,
      transfer_included: p.transfer_included,
      child_policy: p.child_policy || null,
      transfer_details: p.transfer_details || null,
      booking_notes: p.booking_notes || null,
      prices,
    }
  })
}

export function countRecords(periods: Period[]): number {
  return periods.reduce((sum, p) => {
    let n = 0
    if (Number(p.double) > 0) n++
    if (Number(p.triple) > 0) n++
    if (Number(p.single) > 0) n++
    if (p.custom_room && Number(p.custom_price) > 0) n++
    return sum + n
  }, 0)
}

export function PeriodsEditor({ value, onChange, lists }: { value: Period[]; onChange: (p: Period[]) => void; lists?: Lists }) {
  const update = (id: string, patch: Partial<Period>) => onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const remove = (id: string) => onChange(value.filter((p) => p.id !== id))
  const duplicate = (p: Period) => onChange([...value, newPeriod({ ...p, id: undefined })])

  const meals = lists?.meal_plans ?? (['RO', 'BB', 'HB', 'FB', 'AI', 'SAI', 'UAI'] as MealPlan[])
  const bases = lists?.pricing_basis ?? (Object.keys(pricingBasisLabel) as PricingBasis[])
  const currencies = lists?.currencies ?? (['EGP', 'USD', 'EUR', 'SAR'] as Currency[])
  const transfers = lists?.transfer_opts ?? (['Included', 'Optional', 'Not Included'] as TransferOpt[])

  return (
    <div className="space-y-3">
      {value.map((p, idx) => (
        <div key={p.id} className="rounded-card border border-navy-100 bg-surface/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-navy-800">الفترة {idx + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => duplicate(p)} className="grid h-8 w-8 place-items-center rounded-btn text-navy-500 hover:bg-navy-50" title="تكرار">
                <Copy className="h-4 w-4" />
              </button>
              {value.length > 1 && (
                <button type="button" onClick={() => remove(p.id)} className="grid h-8 w-8 place-items-center rounded-btn text-red-500 hover:bg-red-50" title="حذف">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="من تاريخ"><Input type="date" value={p.date_from} onChange={(e) => update(p.id, { date_from: e.target.value })} /></Field>
            <Field label="إلى تاريخ"><Input type="date" value={p.date_to} onChange={(e) => update(p.id, { date_to: e.target.value })} /></Field>
            <Field label="الإقامة">
              <Select value={p.meal_plan} onChange={(e) => update(p.id, { meal_plan: e.target.value as MealPlan })}>
                {meals.map((m) => <option key={m} value={m}>{mealPlanLabel[m] ?? m}</option>)}
              </Select>
            </Field>
            <Field label="أساس التسعير">
              <Select value={p.pricing_basis} onChange={(e) => update(p.id, { pricing_basis: e.target.value as PricingBasis })}>
                {bases.map((b) => <option key={b} value={b}>{pricingBasisLabel[b as PricingBasis] ?? b}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="سعر مزدوجة"><Input type="number" inputMode="decimal" placeholder="0" value={p.double} onChange={(e) => update(p.id, { double: e.target.value })} /></Field>
            <Field label="سعر ثلاثية"><Input type="number" inputMode="decimal" placeholder="0" value={p.triple} onChange={(e) => update(p.id, { triple: e.target.value })} /></Field>
            <Field label="سعر فردية"><Input type="number" inputMode="decimal" placeholder="0" value={p.single} onChange={(e) => update(p.id, { single: e.target.value })} /></Field>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="غرفة مخصصة"><Input placeholder="مثال: جناح" value={p.custom_room} onChange={(e) => update(p.id, { custom_room: e.target.value })} /></Field>
            <Field label="سعرها"><Input type="number" inputMode="decimal" placeholder="0" value={p.custom_price} onChange={(e) => update(p.id, { custom_price: e.target.value })} /></Field>
            <Field label="العملة">
              <Select value={p.currency} onChange={(e) => update(p.id, { currency: e.target.value as Currency })}>
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="الحالة">
              <Select value={p.status} onChange={(e) => update(p.id, { status: e.target.value as RateStatus })}>
                {(['Draft', 'Ready'] as RateStatus[]).map((s) => <option key={s} value={s}>{rateStatusLabel[s]}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="الانتقالات">
              <Select value={p.transfer_included} onChange={(e) => update(p.id, { transfer_included: e.target.value as TransferOpt })}>
                {transfers.map((t) => <option key={t} value={t}>{transferLabel[t as TransferOpt] ?? t}</option>)}
              </Select>
            </Field>
            <Field label="اسم الموسم (اختياري)"><Input placeholder="مثال: صيف" value={p.season_name} onChange={(e) => update(p.id, { season_name: e.target.value })} /></Field>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="سياسة الأطفال للفترة">
              <Textarea
                rows={2}
                value={p.child_policy}
                onChange={(e) => update(p.id, { child_policy: e.target.value })}
                placeholder="مثال: الطفل الأول حتى 11.99 سنة مجانا"
                className="min-h-[70px]"
              />
            </Field>
            <Field label="تفاصيل الانتقالات">
              <Textarea
                rows={2}
                value={p.transfer_details}
                onChange={(e) => update(p.id, { transfer_details: e.target.value })}
                placeholder="مثال: ذهاب وعودة 600 ج للفرد"
                className="min-h-[70px]"
              />
            </Field>
            <Field label="ملاحظات الحجز">
              <Textarea
                rows={2}
                value={p.booking_notes}
                onChange={(e) => update(p.id, { booking_notes: e.target.value })}
                placeholder="أي شروط أو ملاحظات خاصة بالفترة"
                className="min-h-[70px]"
              />
            </Field>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={() => onChange([...value, newPeriod()])} className="w-full">
        <Plus className="h-4 w-4" />
        إضافة فترة
      </Button>
    </div>
  )
}
