import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Package as PackageIcon, Search, Info } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { useHotels, useHotelGroups } from '@/lib/hooks'
import { REGIONS } from '@/lib/labels'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Package } from '@/types'

export function PackageForm({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg?: Package }) {
  const editing = !!pkg
  const toast = useToast()
  const qc = useQueryClient()
  const { t } = useI18n()
  const { data: hotels } = useHotels()
  const { data: groups } = useHotelGroups()

  const [f, setF] = useState({
    package_name: pkg?.package_name ?? '',
    package_type: pkg?.package_type ?? 'Package',
    region: pkg?.region ?? '',
    hotel_group_id: pkg?.hotel_group_id ? String(pkg.hotel_group_id) : '',
    description: pkg?.description ?? '',
    status: pkg?.status ?? 'Active',
  })
  const [selected, setSelected] = useState<number[]>(pkg?.hotels?.map((h) => h.id) ?? [])
  const [hq, setHq] = useState('')
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const toggle = (hid: number) => setSelected((s) => (s.includes(hid) ? s.filter((x) => x !== hid) : [...s, hid]))

  // A package is a pure container — no prices, no date ranges. Rates (with their
  // periods) live on hotel_rates and are added from the "Add rates" page.
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...f,
        hotel_group_id: f.hotel_group_id ? Number(f.hotel_group_id) : null,
        default_meal_plan: null,
        default_pricing_basis: null,
        hotel_ids: selected,
      }
      return editing
        ? api.put<Package>(`/packages/${pkg!.id}`, payload)
        : api.post<Package>('/packages', payload)
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['packages'] })
      qc.invalidateQueries({ queryKey: ['package', String(saved.id)] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editing ? t('rateForm.updated') : t('common.save'))
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const filteredHotels = (hotels ?? []).filter((h) => !hq || h.hotel_name.toLowerCase().includes(hq.toLowerCase()))
  const submit = () => {
    if (!f.package_name.trim()) return toast.error(t('pkgForm.nameRequired'))
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={<span className="flex items-center gap-2"><PackageIcon className="h-5 w-5 text-navy-600" />{editing ? t('pkgForm.editTitle') : t('pkgForm.addTitle')}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={save.isPending}>{t('common.save')}</Button></>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('pkgForm.name')} required className="sm:col-span-2"><Input value={f.package_name} onChange={(e) => set('package_name', e.target.value)} placeholder={t('pkgForm.namePlaceholder')} /></Field>
        <Field label={t('pkgForm.type')}>
          <Select value={f.package_type} onChange={(e) => set('package_type', e.target.value)}>
            {['Package', 'Select', 'Premium', 'Elite', 'Honeymoon', 'Trip', 'Transfer'].map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </Select>
        </Field>
        <Field label={t('pkgForm.region')}>
          <Select value={f.region} onChange={(e) => set('region', e.target.value)}>
            <option value="">{t('common.select')}</option>
            <option value="متعدد">{t('pkgForm.multi')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label={t('pkgForm.group')}>
          <Select value={f.hotel_group_id} onChange={(e) => set('hotel_group_id', e.target.value)}>
            <option value="">{t('common.noneOption')}</option>
            {groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label={t('pkgForm.description')} className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label-base mb-0">{t('pkgForm.hotels')} <span className="nums text-ink-muted">({selected.length})</span></label>
            <div className="relative w-40">
              <Search className="pointer-events-none absolute inset-y-0 end-2 my-auto h-3.5 w-3.5 text-ink-muted" />
              <Input value={hq} onChange={(e) => setHq(e.target.value)} placeholder={t('pkgForm.searchHotels')} className="h-9 pe-7 text-xs" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-card border border-navy-100 p-1">
            {filteredHotels.length === 0 ? (
              <p className="p-3 text-center text-xs text-ink-muted">{t('pkgForm.noHotels')}</p>
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

        <div className="sm:col-span-2 flex items-start gap-2 rounded-card border border-navy-100 bg-surface px-3 py-2.5 text-xs text-ink-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy-500" />
          <span>{t('pkgForm.containerNote')}</span>
        </div>
      </div>
    </Modal>
  )
}
