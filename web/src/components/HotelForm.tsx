import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { PeriodsEditor, newPeriod, periodsToApi, countRecords, type Period } from '@/components/PeriodsEditor'
import { useHotelGroups, useLists } from '@/lib/hooks'
import { REGIONS } from '@/lib/labels'
import { api, ApiError } from '@/lib/api'
import type { Hotel } from '@/types'

export function HotelForm({ open, onClose, hotel }: { open: boolean; onClose: () => void; hotel?: Hotel }) {
  const editing = !!hotel
  const toast = useToast()
  const qc = useQueryClient()
  const { t } = useI18n()
  const { data: groups } = useHotelGroups()
  const { data: lists } = useLists()

  const [form, setForm] = useState({
    hotel_name: hotel?.hotel_name ?? '',
    hotel_group_id: hotel?.hotel_group_id ? String(hotel.hotel_group_id) : '',
    region: hotel?.region ?? '',
    sub_region: hotel?.sub_region ?? '',
    star_rating: hotel?.star_rating ? String(hotel.star_rating) : '',
    address: hotel?.address ?? '',
    description: hotel?.description ?? '',
    child_policy_default: hotel?.child_policy_default ?? '',
    transfer_notes_default: hotel?.transfer_notes_default ?? '',
    status: hotel?.status ?? 'Active',
  })
  const [withPricing, setWithPricing] = useState(false)
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        ...form,
        hotel_group_id: form.hotel_group_id ? Number(form.hotel_group_id) : null,
        star_rating: form.star_rating ? Number(form.star_rating) : null,
      }
      if (editing) {
        const updated = await api.put(`/hotels/${hotel!.id}`, payload)
        if (withPricing && countRecords(periods) > 0) {
          await api.post('/rates/matrix', {
            hotel_ids: [hotel!.id],
            periods: periodsToApi(periods),
          })
        }
        return updated
      }
      if (withPricing && countRecords(periods) > 0) payload.periods = periodsToApi(periods)
      return api.post('/hotels', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hotels'] })
      qc.invalidateQueries({ queryKey: ['hotel', String(hotel?.id)] })
      qc.invalidateQueries({ queryKey: ['rates'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      const createdRates = withPricing ? countRecords(periods) : 0
      toast.success(
        createdRates > 0
          ? t(editing ? 'hotelForm.updatedN' : 'hotelForm.addedN', { n: createdRates })
          : t(editing ? 'hotelForm.updated' : 'hotelForm.added'),
      )
      setWithPricing(false)
      setPeriods([newPeriod()])
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const submit = () => {
    if (!form.hotel_name.trim()) return toast.error(t('hotelForm.nameRequired'))
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-navy-600" />
          {editing ? t('hotelForm.editTitle') : t('hotelForm.addTitle')}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} loading={save.isPending}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('hotelForm.name')} required className="sm:col-span-2">
            <Input value={form.hotel_name} onChange={(e) => set('hotel_name', e.target.value)} placeholder={t('hotelForm.namePlaceholder')} />
          </Field>
          <Field label={t('hotelForm.group')}>
            <Select value={form.hotel_group_id} onChange={(e) => set('hotel_group_id', e.target.value)}>
              <option value="">{t('hotelForm.noGroup')}</option>
              {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label={t('hotelForm.region')}>
            <Select value={form.region} onChange={(e) => set('region', e.target.value)}>
              <option value="">{t('common.select')}</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label={t('hotelForm.subRegion')}>
            <Input value={form.sub_region} onChange={(e) => set('sub_region', e.target.value)} placeholder={t('hotelForm.subRegionPlaceholder')} />
          </Field>
          <Field label={t('hotelForm.stars')}>
            <Select value={form.star_rating} onChange={(e) => set('star_rating', e.target.value)}>
              <option value="">{t('common.dash')}</option>
              {[3, 4, 5].map((s) => <option key={s} value={s}>{t('hotelForm.starsN', { n: s })}</option>)}
            </Select>
          </Field>
          <Field label={t('hotelForm.childPolicyDefault')} className="sm:col-span-2">
            <Textarea value={form.child_policy_default} onChange={(e) => set('child_policy_default', e.target.value)} placeholder={t('hotelForm.childPolicyPlaceholder')} />
          </Field>
          <Field label={t('hotelForm.transferNotes')} className="sm:col-span-2">
            <Textarea value={form.transfer_notes_default} onChange={(e) => set('transfer_notes_default', e.target.value)} />
          </Field>
        </div>

        <div className="rounded-card border border-navy-100 bg-white p-3">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <div className="text-sm font-bold text-navy-900">{t('hotelForm.addPricingNow')}</div>
                <div className="text-xs text-ink-muted">{t('hotelForm.addPricingHint')}</div>
              </div>
              <input type="checkbox" checked={withPricing} onChange={(e) => setWithPricing(e.target.checked)} className="h-5 w-5 accent-navy-700" />
            </label>

            {withPricing && (
              <div className="mt-3 border-t border-navy-100 pt-3">
                <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
                <p className="mt-2 text-center text-xs font-semibold text-navy-600">
                  {t('hotelForm.willCreate', { n: countRecords(periods) })}
                </p>
              </div>
            )}
          </div>
      </div>
    </Modal>
  )
}
