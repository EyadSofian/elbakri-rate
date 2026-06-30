import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Boxes, Pencil, Building2, Package } from 'lucide-react'
import { useHotelGroups } from '@/lib/hooks'
import { PageHeader, PageLoader, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Field, Input, Textarea, Select } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { REGIONS } from '@/lib/labels'
import { api, ApiError } from '@/lib/api'
import type { HotelGroup } from '@/types'

export default function HotelGroupsPage() {
  const { t } = useI18n()
  const { data: groups, isLoading } = useHotelGroups()
  const [edit, setEdit] = useState<HotelGroup | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader
        title={t('nav.groups')}
        subtitle={t('groups.subtitle')}
        actions={<Button size="sm" onClick={() => { setEdit(null); setOpen(true) }}><Plus className="h-4 w-4" />{t('groups.add')}</Button>}
      />
      {isLoading ? (
        <PageLoader />
      ) : (groups ?? []).length === 0 ? (
        <EmptyState icon={<Boxes className="h-7 w-7" />} title={t('groups.empty')} action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('groups.add')}</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups!.map((g) => (
            <div key={g.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-navy-900">{g.name}</h3>
                  {g.brand_name && <p className="text-xs text-ink-muted">{g.brand_name}</p>}
                </div>
                <button onClick={() => { setEdit(g); setOpen(true) }} className="grid h-9 w-9 place-items-center rounded-btn text-navy-500 hover:bg-navy-50">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {g.notes && <p className="line-clamp-2 text-sm text-ink-muted">{g.notes}</p>}
              <div className="mt-1 flex items-center gap-3 border-t border-navy-100 pt-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /><span className="nums">{g.hotels_count ?? 0}</span> {t('groups.hotelsCount')}</span>
                <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /><span className="nums">{g.packages_count ?? 0}</span> {t('groups.packagesCount')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <GroupModal group={edit} onClose={() => setOpen(false)} />}
    </div>
  )
}

function GroupModal({ group, onClose }: { group: HotelGroup | null; onClose: () => void }) {
  const editing = !!group
  const toast = useToast()
  const { t } = useI18n()
  const qc = useQueryClient()
  const [f, setF] = useState({ name: group?.name ?? '', brand_name: group?.brand_name ?? '', region: group?.region ?? '', notes: group?.notes ?? '' })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/hotel-groups/${group!.id}`, f) : api.post('/hotel-groups', f)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hotel-groups'] }); toast.success(t('common.saved')); onClose() },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('groups.editTitle') : t('groups.addTitle')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={() => f.name.trim() ? save.mutate() : toast.error(t('groups.nameRequired'))} loading={save.isPending}>{t('common.save')}</Button></>}
    >
      <div className="space-y-3">
        <Field label={t('groups.name')} required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={t('groups.brand')}><Input value={f.brand_name} onChange={(e) => set('brand_name', e.target.value)} /></Field>
        <Field label={t('groups.region')}>
          <Select value={f.region} onChange={(e) => set('region', e.target.value)}>
            <option value="">{t('common.select')}</option>
            <option value="متعدد">{t('pkgForm.multi')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label={t('groups.notes')}><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
