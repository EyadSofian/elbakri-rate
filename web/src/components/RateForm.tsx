import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers, Tag } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { useChildPolicies, useHotels, useLists } from '@/lib/hooks'
import { mealLabel, pricingText, roomLabel } from '@/lib/labels'
import { api, ApiError } from '@/lib/api'
import type { Rate, MealPlan, PricingBasis, Currency, RateStatus } from '@/types'
import { PeriodsEditor, countRecords, newPeriod, periodsToApi, type Period } from './PeriodsEditor'

export function RateForm({
  open,
  onClose,
  rate,
  fixedHotelId,
}: {
  open: boolean
  onClose: () => void
  rate?: Rate
  fixedHotelId?: number
}) {
  const editing = !!rate
  const toast = useToast()
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const { data: hotels } = useHotels()
  const { data: lists } = useLists()
  const [mode, setMode] = useState<'single' | 'periods'>('single')
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])

  const [f, setF] = useState({
    hotel_id: String(rate?.hotel_id ?? fixedHotelId ?? ''),
    room_type: rate?.room_type ?? 'Double',
    meal_plan: (rate?.meal_plan ?? 'BB') as MealPlan,
    pricing_basis: (rate?.pricing_basis ?? 'per_person_per_night') as PricingBasis,
    currency: (rate?.currency ?? 'EGP') as Currency,
    date_from: rate?.date_from ?? '',
    date_to: rate?.date_to ?? '',
    adult_price: rate?.adult_price != null ? String(rate.adult_price) : '',
    child_price: rate?.child_price != null ? String(rate.child_price) : '',
    child_policy_id: rate?.child_policy_id != null ? String(rate.child_policy_id) : '',
    season_name: rate?.season_name ?? '',
    booking_notes: rate?.booking_notes ?? '',
    status: (rate?.status ?? 'Draft') as RateStatus,
  })
  const { data: childPolicies } = useChildPolicies(f.hotel_id)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const save = useMutation({
    mutationFn: () => {
      if (!editing && mode === 'periods') {
        return api.post('/rates/matrix', {
          hotel_ids: [Number(f.hotel_id)],
          periods: periodsToApi(periods),
        })
      }
      const payload = {
        ...f,
        hotel_id: Number(f.hotel_id),
        package_id: null,
        adult_price: f.adult_price === '' ? null : Number(f.adult_price),
        child_price: f.child_price === '' ? null : Number(f.child_price),
        child_policy_id: f.child_policy_id === '' ? null : Number(f.child_policy_id),
        date_from: f.date_from || null,
        date_to: f.date_to || null,
      }
      return editing ? api.put(`/rates/${rate!.id}`, payload) : api.post('/rates', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success(
        editing
          ? t('rateForm.updated')
          : mode === 'periods'
            ? t('rateForm.addedN', { n: countRecords(periods) })
            : t('rateForm.added'),
      )
      setMode('single')
      setPeriods([newPeriod()])
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const submit = () => {
    if (!f.hotel_id) return toast.error(t('rateForm.selectHotelErr'))
    if (!editing && mode === 'periods' && countRecords(periods) === 0) return toast.error(t('rateForm.atLeastOne'))
    save.mutate()
  }

  const rooms = lists?.room_types ?? ['Single', 'Double', 'Triple', 'Family', 'Custom']

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={mode === 'periods' ? 'xl' : 'lg'}
      title={<span className="flex items-center gap-2"><Tag className="h-5 w-5 text-navy-600" />{editing ? t('rateForm.editTitle') : t('rateForm.addTitle')}</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={save.isPending}>{editing ? t('common.save') : t('common.add')}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {!editing && (
          <div className="inline-flex rounded-card border border-navy-100 bg-navy-50 p-1">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`rounded-btn px-3 py-2 text-sm font-bold transition ${mode === 'single' ? 'bg-white text-navy-900 shadow-sm' : 'text-ink-muted'}`}
            >
              <Tag className="me-1 inline h-4 w-4" />
              {t('rateForm.single')}
            </button>
            <button
              type="button"
              onClick={() => setMode('periods')}
              className={`rounded-btn px-3 py-2 text-sm font-bold transition ${mode === 'periods' ? 'bg-white text-navy-900 shadow-sm' : 'text-ink-muted'}`}
            >
              <Layers className="me-1 inline h-4 w-4" />
              {t('rateForm.multi')}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
        <Field label={t('rateForm.hotel')} required className="col-span-2">
          <Select
            value={f.hotel_id}
            onChange={(e) => setF((p) => ({ ...p, hotel_id: e.target.value, child_policy_id: '' }))}
            disabled={!!fixedHotelId}
          >
            <option value="">{t('rateForm.selectHotel')}</option>
            {hotels?.map((h) => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}
          </Select>
        </Field>
        {childPolicies && childPolicies.length > 0 && (
          <Field label={t('rateForm.structuredChildPolicy')} className="col-span-2">
            <Select value={f.child_policy_id} onChange={(e) => set('child_policy_id', e.target.value)}>
              <option value="">{t('rateForm.noStructuredPolicy')}</option>
              {childPolicies.filter((p) => p.status === 'Active').map((p) => (
                <option key={p.id} value={p.id}>{p.policy_name} ({p.policy_code})</option>
              ))}
            </Select>
            {f.child_policy_id && (
              <p className="mt-1 text-xs text-ink-muted">
                {childPolicies.find((p) => String(p.id) === f.child_policy_id)?.summary}
              </p>
            )}
          </Field>
        )}
        </div>

        {!editing && mode === 'periods' ? (
          <div className="rounded-card border border-navy-100 bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-navy-900">{t('rateForm.periodsTitle')}</h3>
                <p className="text-xs text-ink-muted">{t('rateForm.periodsHint')}</p>
              </div>
              <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-navy-900">
                {t('rateForm.willCreate', { n: countRecords(periods) })}
              </span>
            </div>
            <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} childPolicies={childPolicies ?? []} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
        <Field label={t('rateForm.roomType')}>
          <Select value={f.room_type} onChange={(e) => set('room_type', e.target.value)}>
            {rooms.map((r) => <option key={r} value={r}>{roomLabel(r, lang)}</option>)}
          </Select>
        </Field>
        <Field label={t('rateForm.meal')}>
          <Select value={f.meal_plan} onChange={(e) => set('meal_plan', e.target.value)}>
            {(lists?.meal_plans ?? ['RO', 'BB', 'HB', 'FB', 'AI', 'SAI', 'UAI']).map((m) => <option key={m} value={m}>{mealLabel(m, lang)}</option>)}
          </Select>
        </Field>
        <Field label={t('rateForm.dateFrom')}><Input type="date" value={f.date_from} onChange={(e) => set('date_from', e.target.value)} /></Field>
        <Field label={t('rateForm.dateTo')}><Input type="date" value={f.date_to} onChange={(e) => set('date_to', e.target.value)} /></Field>
        <Field label={t('rateForm.adultPrice')}><Input type="number" inputMode="decimal" value={f.adult_price} onChange={(e) => set('adult_price', e.target.value)} /></Field>
        <Field label={t('rateForm.childPrice')}><Input type="number" inputMode="decimal" value={f.child_price} onChange={(e) => set('child_price', e.target.value)} /></Field>
        <Field label={t('rateForm.pricingBasis')}>
          <Select value={f.pricing_basis} onChange={(e) => set('pricing_basis', e.target.value)}>
            {(lists?.pricing_basis ?? (['per_person_per_night', 'per_room_per_night', 'per_person_package', 'per_room_package'] as PricingBasis[])).map((b) => <option key={b} value={b}>{pricingText(b as PricingBasis, lang)}</option>)}
          </Select>
        </Field>
        <Field label={t('rateForm.currency')}>
          <Select value={f.currency} onChange={(e) => set('currency', e.target.value)}>
            {(lists?.currencies ?? ['EGP', 'USD', 'EUR', 'SAR']).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label={t('rateForm.status')}>
          <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {(['Draft', 'Ready', 'Archived'] as RateStatus[]).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('rateForm.bookingNotes')} className="col-span-2"><Textarea value={f.booking_notes} onChange={(e) => set('booking_notes', e.target.value)} /></Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
