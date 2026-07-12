import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Baby, CheckCircle2, Copy, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { Modal, ConfirmDialog } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { ChildPolicy, ChildPolicyBedType, ChildPolicyPricingType, ChildPolicyRule, Hotel } from '@/types'

type DraftRule = Omit<ChildPolicyRule, 'id' | 'child_policy_id'>
type DraftPolicy = {
  id?: number
  hotel_id: number
  policy_code: string
  policy_name: string
  description: string
  min_adults: number
  max_children: number
  status: 'Active' | 'Inactive'
  rules: DraftRule[]
}

function newRule(sort = 0): DraftRule {
  return {
    child_number_from: 1,
    child_number_to: 1,
    age_from: 0,
    age_to: 11.99,
    pricing_type: 'manual',
    value: null,
    bed_type: 'any',
    notes: '',
    sort_order: sort,
  }
}

function policyToDraft(hotelId: number, p?: ChildPolicy): DraftPolicy {
  if (p) {
    return {
      id: p.id,
      hotel_id: p.hotel_id,
      policy_code: p.policy_code,
      policy_name: p.policy_name,
      description: p.description ?? '',
      min_adults: Number(p.min_adults ?? 1),
      max_children: Number(p.max_children ?? 0),
      status: p.status,
      rules: (p.rules ?? []).map((r, idx) => ({
        child_number_from: Number(r.child_number_from),
        child_number_to: Number(r.child_number_to),
        age_from: r.age_from,
        age_to: r.age_to,
        pricing_type: r.pricing_type,
        value: r.value,
        bed_type: r.bed_type,
        notes: r.notes ?? '',
        sort_order: Number(r.sort_order ?? idx),
      })),
    }
  }
  return {
    hotel_id: hotelId,
    policy_code: '',
    policy_name: '',
    description: '',
    min_adults: 1,
    max_children: 2,
    status: 'Active',
    rules: [newRule()],
  }
}

const ar = {
  title: 'سياسات الأطفال',
  hint: 'قواعد منظمة لكل فندق: مجاني، نسبة من البالغ، سعر ثابت أو تأكيد يدوي.',
  add: 'إضافة سياسة',
  edit: 'تعديل السياسة',
  clone: 'نسخ',
  setDefault: 'افتراضي للفندق',
  default: 'افتراضي',
  inactive: 'غير نشط',
  empty: 'لا توجد سياسات أطفال لهذا الفندق.',
  code: 'كود السياسة',
  name: 'اسم السياسة',
  description: 'وصف داخلي',
  minAdults: 'أقل عدد بالغين',
  maxChildren: 'أقصى عدد أطفال',
  status: 'الحالة',
  rules: 'القواعد',
  childFrom: 'من الطفل رقم',
  childTo: 'إلى الطفل رقم',
  ageFrom: 'العمر من',
  ageTo: 'العمر إلى',
  pricing: 'نوع التسعير',
  value: 'القيمة',
  bed: 'السرير',
  notes: 'ملاحظات',
  addRule: 'إضافة قاعدة',
  deleteQ: 'تعطيل هذه السياسة؟ الأسعار المرتبطة ستحتفظ بالبيانات القديمة ولن يتم حذفها.',
  saved: 'تم حفظ سياسة الأطفال',
  deactivated: 'تم تعطيل السياسة',
  cloned: 'تم نسخ السياسة',
}

const en: typeof ar = {
  title: 'Child policies',
  hint: 'Structured rules per hotel: free, adult percentage, fixed price, or manual confirmation.',
  add: 'Add policy',
  edit: 'Edit policy',
  clone: 'Clone',
  setDefault: 'Set hotel default',
  default: 'Default',
  inactive: 'Inactive',
  empty: 'No child policies for this hotel yet.',
  code: 'Policy code',
  name: 'Policy name',
  description: 'Internal description',
  minAdults: 'Minimum adults',
  maxChildren: 'Maximum children',
  status: 'Status',
  rules: 'Rules',
  childFrom: 'Child from',
  childTo: 'Child to',
  ageFrom: 'Age from',
  ageTo: 'Age to',
  pricing: 'Pricing type',
  value: 'Value',
  bed: 'Bed',
  notes: 'Notes',
  addRule: 'Add rule',
  deleteQ: 'Deactivate this policy? Linked rates keep their old data and nothing is deleted.',
  saved: 'Child policy saved',
  deactivated: 'Policy deactivated',
  cloned: 'Policy cloned',
}

function pricingLabel(type: ChildPolicyPricingType, lang: 'ar' | 'en') {
  const map = {
    free: lang === 'ar' ? 'مجاني' : 'Free',
    fixed: lang === 'ar' ? 'سعر ثابت' : 'Fixed',
    percent_adult: lang === 'ar' ? 'نسبة من البالغ' : '% of adult',
    adult_rate: lang === 'ar' ? 'سعر بالغ' : 'Adult rate',
    manual: lang === 'ar' ? 'تأكيد يدوي' : 'Manual',
  }
  return map[type]
}

function bedLabel(type: ChildPolicyBedType, lang: 'ar' | 'en') {
  const map = {
    any: lang === 'ar' ? 'أي حالة' : 'Any',
    sharing: lang === 'ar' ? 'مشارك' : 'Sharing',
    extra_bed: lang === 'ar' ? 'سرير إضافي' : 'Extra bed',
  }
  return map[type]
}

export function ChildPolicyPanel({ hotel, canEdit }: { hotel: Hotel; canEdit: boolean }) {
  const { lang, t } = useI18n()
  const copy = lang === 'ar' ? ar : en
  const toast = useToast()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<DraftPolicy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChildPolicy | null>(null)
  const policies = hotel.child_policies ?? []
  const defaultId = hotel.default_child_policy_id ?? null

  const sorted = useMemo(() => [...policies].sort((a, b) => (a.status === b.status ? a.policy_name.localeCompare(b.policy_name) : a.status === 'Active' ? -1 : 1)), [policies])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hotel', String(hotel.id)] })
    qc.invalidateQueries({ queryKey: ['child-policies', hotel.id] })
    qc.invalidateQueries({ queryKey: ['hotels'] })
  }

  const save = useMutation({
    mutationFn: (payload: DraftPolicy) => {
      const body = {
        ...payload,
        rules: payload.rules.map((r, idx) => ({ ...r, sort_order: idx })),
      }
      return payload.id ? api.put<ChildPolicy>(`/child-policies/${payload.id}`, body) : api.post<ChildPolicy>('/child-policies', body)
    },
    onSuccess: () => {
      invalidate()
      toast.success(copy.saved)
      setDraft(null)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const deactivate = useMutation({
    mutationFn: (id: number) => api.del(`/child-policies/${id}`),
    onSuccess: () => {
      invalidate()
      toast.success(copy.deactivated)
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.delete')),
  })

  const setDefault = useMutation({
    mutationFn: (id: number) => api.post(`/child-policies/${id}/default`),
    onSuccess: () => {
      invalidate()
      toast.success(copy.saved)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const clone = useMutation({
    mutationFn: (p: ChildPolicy) => api.post<ChildPolicy>(`/child-policies/${p.id}/clone`, {
      policy_code: `${p.policy_code}_COPY`,
      policy_name: `${p.policy_name} Copy`,
    }),
    onSuccess: () => {
      invalidate()
      toast.success(copy.cloned)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.copy')),
  })

  const patchDraft = (patch: Partial<DraftPolicy>) => setDraft((p) => (p ? { ...p, ...patch } : p))
  const patchRule = (idx: number, patch: Partial<DraftRule>) => setDraft((p) => {
    if (!p) return p
    const rules = p.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    return { ...p, rules }
  })

  return (
    <div className="card mb-5 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-navy-900">
            <Baby className="h-5 w-5 text-navy-600" />
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{copy.hint}</p>
        </div>
        {canEdit && <Button size="sm" onClick={() => setDraft(policyToDraft(hotel.id))}><Plus className="h-4 w-4" />{copy.add}</Button>}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-card border border-dashed border-navy-200 bg-navy-50/50 p-4 text-sm text-ink-muted">{copy.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sorted.map((p) => (
            <div key={p.id} className="rounded-card border border-navy-100 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-navy-900">{p.policy_name}</h3>
                    <Badge tone="navy">{p.policy_code}</Badge>
                    {defaultId === p.id && <Badge tone="green">{copy.default}</Badge>}
                    {p.status !== 'Active' && <Badge tone="slate">{copy.inactive}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{p.summary || p.description || copy.rules}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button className="grid h-8 w-8 place-items-center rounded-btn text-navy-500 hover:bg-navy-50" onClick={() => setDraft(policyToDraft(hotel.id, p))} title={copy.edit}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="grid h-8 w-8 place-items-center rounded-btn text-navy-500 hover:bg-navy-50" onClick={() => clone.mutate(p)} title={copy.clone}>
                      <Copy className="h-4 w-4" />
                    </button>
                    {p.status === 'Active' && defaultId !== p.id && (
                      <button className="grid h-8 w-8 place-items-center rounded-btn text-green-600 hover:bg-green-50" onClick={() => setDefault.mutate(p.id)} title={copy.setDefault}>
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button className="grid h-8 w-8 place-items-center rounded-btn text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(p)} title={t('common.delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-muted">
                <span>{copy.minAdults}: <b className="text-navy-800">{p.min_adults}</b></span>
                <span>{copy.maxChildren}: <b className="text-navy-800">{p.max_children}</b></span>
                <span>{copy.rules}: <b className="text-navy-800">{p.rules?.length ?? 0}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        size="xl"
        title={draft?.id ? copy.edit : copy.add}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
            <Button loading={save.isPending} onClick={() => draft && save.mutate(draft)}>
              <CheckCircle2 className="h-4 w-4" />{t('common.save')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={copy.code} required><Input value={draft.policy_code} onChange={(e) => patchDraft({ policy_code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} /></Field>
              <Field label={copy.name} required><Input value={draft.policy_name} onChange={(e) => patchDraft({ policy_name: e.target.value })} /></Field>
              <Field label={copy.minAdults}><Input type="number" min={1} value={draft.min_adults} onChange={(e) => patchDraft({ min_adults: Number(e.target.value) })} /></Field>
              <Field label={copy.maxChildren}><Input type="number" min={0} value={draft.max_children} onChange={(e) => patchDraft({ max_children: Number(e.target.value) })} /></Field>
              <Field label={copy.status}>
                <Select value={draft.status} onChange={(e) => patchDraft({ status: e.target.value as 'Active' | 'Inactive' })}>
                  <option value="Active">{t('common.active')}</option>
                  <option value="Inactive">{t('common.inactive')}</option>
                </Select>
              </Field>
              <Field label={copy.description} className="sm:col-span-2">
                <Textarea value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-navy-900">{copy.rules}</h3>
                <Button size="sm" variant="outline" onClick={() => patchDraft({ rules: [...draft.rules, newRule(draft.rules.length)] })}><Plus className="h-4 w-4" />{copy.addRule}</Button>
              </div>
              {draft.rules.map((r, idx) => (
                <div key={idx} className="rounded-card border border-navy-100 bg-surface/60 p-3">
                  <div className="mb-2 flex justify-between">
                    <span className="text-sm font-bold text-navy-800">{copy.rules} #{idx + 1}</span>
                    {draft.rules.length > 1 && (
                      <button className="text-red-500" onClick={() => patchDraft({ rules: draft.rules.filter((_, i) => i !== idx) })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                    <Field label={copy.childFrom}><Input type="number" min={1} value={r.child_number_from} onChange={(e) => patchRule(idx, { child_number_from: Number(e.target.value) })} /></Field>
                    <Field label={copy.childTo}><Input type="number" min={1} value={r.child_number_to} onChange={(e) => patchRule(idx, { child_number_to: Number(e.target.value) })} /></Field>
                    <Field label={copy.ageFrom}><Input type="number" step="0.01" value={r.age_from} onChange={(e) => patchRule(idx, { age_from: e.target.value })} /></Field>
                    <Field label={copy.ageTo}><Input type="number" step="0.01" value={r.age_to} onChange={(e) => patchRule(idx, { age_to: e.target.value })} /></Field>
                    <Field label={copy.pricing}>
                      <Select value={r.pricing_type} onChange={(e) => patchRule(idx, { pricing_type: e.target.value as ChildPolicyPricingType })}>
                        {(['free', 'fixed', 'percent_adult', 'adult_rate', 'manual'] as ChildPolicyPricingType[]).map((x) => <option key={x} value={x}>{pricingLabel(x, lang)}</option>)}
                      </Select>
                    </Field>
                    <Field label={copy.value}><Input type="number" step="0.01" value={r.value ?? ''} onChange={(e) => patchRule(idx, { value: e.target.value === '' ? null : e.target.value })} /></Field>
                    <Field label={copy.bed} className="md:col-span-2">
                      <Select value={r.bed_type} onChange={(e) => patchRule(idx, { bed_type: e.target.value as ChildPolicyBedType })}>
                        {(['any', 'sharing', 'extra_bed'] as ChildPolicyBedType[]).map((x) => <option key={x} value={x}>{bedLabel(x, lang)}</option>)}
                      </Select>
                    </Field>
                    <Field label={copy.notes} className="md:col-span-4"><Input value={r.notes ?? ''} onChange={(e) => patchRule(idx, { notes: e.target.value })} /></Field>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deactivate.mutate(deleteTarget.id)}
        danger
        loading={deactivate.isPending}
        confirmText={t('common.delete')}
        message={copy.deleteQ}
      />
    </div>
  )
}
