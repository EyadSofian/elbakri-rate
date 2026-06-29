import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { PeriodsEditor, newPeriod, periodsToApi, countRecords, type Period } from '@/components/PeriodsEditor'
import { useHotelGroups, useLists } from '@/lib/hooks'
import { REGIONS } from '@/lib/labels'
import { api, ApiError } from '@/lib/api'
import type { Hotel } from '@/types'

export function HotelForm({ open, onClose, hotel }: { open: boolean; onClose: () => void; hotel?: Hotel }) {
  const editing = !!hotel
  const toast = useToast()
  const qc = useQueryClient()
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
        (editing ? 'تم تحديث الفندق' : 'تم إضافة الفندق') +
          (createdRates > 0 ? ` وإضافة ${createdRates} سعر` : ''),
      )
      setWithPricing(false)
      setPeriods([newPeriod()])
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر الحفظ'),
  })

  const submit = () => {
    if (!form.hotel_name.trim()) return toast.error('اسم الفندق مطلوب')
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
          {editing ? 'تعديل الفندق' : 'إضافة فندق'}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={save.isPending}>{editing ? 'حفظ التعديلات' : 'حفظ الفندق'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="اسم الفندق" required className="sm:col-span-2">
            <Input value={form.hotel_name} onChange={(e) => set('hotel_name', e.target.value)} placeholder="مثال: Pickalbatros Aqua Park" />
          </Field>
          <Field label="المجموعة">
            <Select value={form.hotel_group_id} onChange={(e) => set('hotel_group_id', e.target.value)}>
              <option value="">— بدون مجموعة —</option>
              {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label="المنطقة">
            <Select value={form.region} onChange={(e) => set('region', e.target.value)}>
              <option value="">— اختر —</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="المنطقة الفرعية">
            <Input value={form.sub_region} onChange={(e) => set('sub_region', e.target.value)} placeholder="مثال: نبق باي" />
          </Field>
          <Field label="عدد النجوم">
            <Select value={form.star_rating} onChange={(e) => set('star_rating', e.target.value)}>
              <option value="">—</option>
              {[3, 4, 5].map((s) => <option key={s} value={s}>{s} نجوم</option>)}
            </Select>
          </Field>
          <Field label="سياسة الأطفال الافتراضية" className="sm:col-span-2">
            <Textarea value={form.child_policy_default} onChange={(e) => set('child_policy_default', e.target.value)} placeholder="مثال: طفل حتى 11.99 سنة مجانًا" />
          </Field>
          <Field label="ملاحظات الانتقالات" className="sm:col-span-2">
            <Textarea value={form.transfer_notes_default} onChange={(e) => set('transfer_notes_default', e.target.value)} />
          </Field>
        </div>

        <div className="rounded-card border border-navy-100 bg-white p-3">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <div className="text-sm font-bold text-navy-900">إضافة فترات أسعار الآن</div>
                <div className="text-xs text-ink-muted">
                  أسعار مستقلة للفندق بدون باكدج. يمكن إضافة أكثر من فترة، وكل فترة لها Double / Triple / Single وغرفة مخصصة.
                </div>
              </div>
              <input type="checkbox" checked={withPricing} onChange={(e) => setWithPricing(e.target.checked)} className="h-5 w-5 accent-navy-700" />
            </label>

            {withPricing && (
              <div className="mt-3 border-t border-navy-100 pt-3">
                <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
                <p className="mt-2 text-center text-xs font-semibold text-navy-600">
                  سيتم إنشاء <span className="nums">{countRecords(periods)}</span> سعر
                </p>
              </div>
            )}
          </div>
      </div>
    </Modal>
  )
}
