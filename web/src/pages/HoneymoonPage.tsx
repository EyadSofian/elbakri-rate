import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Copy, FileDown, Gift, HeartHandshake, ImageDown, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useHoneymoonOffers } from '@/lib/hooks'
import { api, ApiError } from '@/lib/api'
import { formatDateRange, formatPrice } from '@/lib/utils'
import { useI18n, type Lang } from '@/lib/i18n'
import { useToast } from '@/components/ui/toast'
import { PageHeader, PageLoader, EmptyState } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Badge, RateStatusBadge } from '@/components/ui/badge'
import { Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { ConfirmDialog, Modal } from '@/components/ui/modal'
import { exportHoneymoonPdf, exportHoneymoonPng, honeymoonWhatsAppText } from '@/components/export/HoneymoonStandaloneExport'
import type { Currency, HoneymoonOffer, HoneymoonPeriod, RateStatus } from '@/types'

const CURRENCIES: Currency[] = ['EGP', 'USD', 'EUR', 'SAR']
const STATUSES: RateStatus[] = ['Draft', 'Ready', 'Archived']

const COPY = {
  ar: {
    title: 'الهاني مون',
    subtitle: 'إضافات وعروض شهر العسل منفصلة عن أسعار الفنادق والباقات',
    add: 'إضافة هاني مون',
    empty: 'لا توجد عروض هاني مون',
    emptyDesc: 'أضف عرض هاني مون باسم الفندق، الفترات، الأسعار، والمميزات.',
    search: 'ابحث باسم الفندق أو العرض...',
    allStatuses: 'كل الحالات',
    periods: 'فترة',
    features: 'المميزات',
    noFeatures: 'لا توجد مميزات مكتوبة',
    export: 'تصدير',
    edit: 'تعديل',
    deleteQ: 'هل تريد حذف عرض الهاني مون {name}؟',
    deleted: 'تم حذف عرض الهاني مون',
    saved: 'تم حفظ عرض الهاني مون',
    copied: 'تم نسخ رسالة واتساب',
    addTitle: 'إضافة عرض هاني مون',
    editTitle: 'تعديل عرض هاني مون',
    hotelName: 'اسم الفندق',
    offerName: 'اسم العرض',
    region: 'المنطقة',
    status: 'الحالة',
    details: 'المميزات / التفاصيل',
    detailsHint: 'مثال: عشاء رومانسي، كيكة، تزيين الغرفة، فطار في الغرفة...',
    internalNotes: 'ملاحظات داخلية',
    periodsTitle: 'الفترات والأسعار',
    addPeriod: 'إضافة فترة',
    from: 'من تاريخ',
    to: 'إلى تاريخ',
    priceLabel: 'نوع السعر',
    priceLabelPlaceholder: 'مثال: سعر الباكدج / جناح هاني مون',
    price: 'السعر',
    currency: 'العملة',
    notes: 'ملاحظات الفترة',
    required: 'اسم الفندق واسم العرض مطلوبين',
    pngDone: 'تم تنزيل PNG',
    pdfDone: 'تم تنزيل PDF',
    exportFail: 'تعذر التصدير',
  },
  en: {
    title: 'Honeymoon',
    subtitle: 'Standalone honeymoon add-ons and offers, separate from hotel/package rates',
    add: 'Add honeymoon',
    empty: 'No honeymoon offers',
    emptyDesc: 'Add hotel name, periods, prices, and features for honeymoon offers.',
    search: 'Search hotel or offer...',
    allStatuses: 'All statuses',
    periods: 'periods',
    features: 'Features',
    noFeatures: 'No features written',
    export: 'Export',
    edit: 'Edit',
    deleteQ: 'Delete honeymoon offer {name}?',
    deleted: 'Honeymoon offer deleted',
    saved: 'Honeymoon offer saved',
    copied: 'WhatsApp message copied',
    addTitle: 'Add honeymoon offer',
    editTitle: 'Edit honeymoon offer',
    hotelName: 'Hotel name',
    offerName: 'Offer name',
    region: 'Region',
    status: 'Status',
    details: 'Features / details',
    detailsHint: 'Example: romantic dinner, cake, room decoration, breakfast in room...',
    internalNotes: 'Internal notes',
    periodsTitle: 'Periods and prices',
    addPeriod: 'Add period',
    from: 'Date from',
    to: 'Date to',
    priceLabel: 'Price type',
    priceLabelPlaceholder: 'Example: package price / honeymoon suite',
    price: 'Price',
    currency: 'Currency',
    notes: 'Period notes',
    required: 'Hotel name and offer name are required',
    pngDone: 'PNG downloaded',
    pdfDone: 'PDF downloaded',
    exportFail: 'Export failed',
  },
} as const

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'honeymoon'
}

function defaultPeriod(lang: Lang): HoneymoonPeriod {
  return {
    date_from: '',
    date_to: '',
    price_label: lang === 'ar' ? 'سعر الباكدج' : 'Package price',
    price: '',
    currency: 'EGP',
    notes: '',
  }
}

function normalizePeriod(p: HoneymoonPeriod): HoneymoonPeriod {
  return {
    ...p,
    date_from: p.date_from || null,
    date_to: p.date_to || null,
    price_label: p.price_label?.trim() || null,
    price: p.price === '' ? null : p.price,
    notes: p.notes?.trim() || null,
  }
}

export default function HoneymoonPage() {
  const { lang, t } = useI18n()
  const L = COPY[lang]
  const { canEdit, canExport } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | RateStatus>('all')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<HoneymoonOffer | null>(null)
  const [del, setDel] = useState<HoneymoonOffer | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const params = useMemo(() => ({
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(canEdit && status !== 'all' ? { status } : {}),
  }), [q, status, canEdit])
  const { data, isLoading } = useHoneymoonOffers(params)

  const loadFull = async (offer: HoneymoonOffer) => {
    if (offer.periods) return offer
    return api.get<HoneymoonOffer>(`/honeymoon/${offer.id}`)
  }

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/honeymoon/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['honeymoon'] })
      toast.success(L.deleted)
      setDel(null)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.delete')),
  })

  const openEdit = async (offer: HoneymoonOffer) => {
    setBusy(`edit-${offer.id}`)
    try {
      setEdit(await loadFull(offer))
      setOpen(true)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('err.notFound'))
    } finally {
      setBusy(null)
    }
  }

  const png = async (offer: HoneymoonOffer) => {
    setBusy(`png-${offer.id}`)
    try {
      const full = await loadFull(offer)
      await exportHoneymoonPng(full, lang, `elbakri-honeymoon-${safeName(full.offer_name)}.png`)
      toast.success(L.pngDone)
    } catch {
      toast.error(L.exportFail)
    } finally {
      setBusy(null)
    }
  }

  const pdf = async (offer: HoneymoonOffer) => {
    setBusy(`pdf-${offer.id}`)
    try {
      const full = await loadFull(offer)
      await exportHoneymoonPdf(full, lang, `elbakri-honeymoon-${safeName(full.offer_name)}.pdf`)
      toast.success(L.pdfDone)
    } catch {
      toast.error(L.exportFail)
    } finally {
      setBusy(null)
    }
  }

  const copy = async (offer: HoneymoonOffer) => {
    setBusy(`copy-${offer.id}`)
    try {
      const full = await loadFull(offer)
      await navigator.clipboard.writeText(honeymoonWhatsAppText(full, lang))
      toast.success(L.copied)
    } catch {
      toast.error(t('err.copy'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        actions={canEdit ? <Button size="sm" onClick={() => { setEdit(null); setOpen(true) }}><Plus className="h-4 w-4" />{L.add}</Button> : null}
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} className="pe-10" />
        </div>
        {canEdit && (
          <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | RateStatus)}>
            <option value="all">{L.allStatuses}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-7 w-7" />}
          title={L.empty}
          description={L.emptyDesc}
          action={canEdit ? <Button onClick={() => { setEdit(null); setOpen(true) }}><Plus className="h-4 w-4" />{L.add}</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data!.map((offer) => (
            <article key={offer.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <RateStatusBadge status={offer.status} />
                    <Badge tone="gold"><span className="inline-flex items-center gap-1"><Gift className="h-3.5 w-3.5" />{L.title}</span></Badge>
                  </div>
                  <h2 className="line-clamp-2 text-lg font-extrabold text-navy-900">{offer.offer_name}</h2>
                  <p className="mt-1 font-semibold text-navy-700">{offer.hotel_name}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => openEdit(offer)} className="grid h-9 w-9 place-items-center rounded-btn text-navy-600 hover:bg-navy-50" aria-label={L.edit}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDel(offer)} className="grid h-9 w-9 place-items-center rounded-btn text-red-600 hover:bg-red-50" aria-label={t('common.delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                {offer.region && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{offer.region}</span>}
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /><span className="nums">{offer.periods_count ?? 0}</span> {L.periods}</span>
                {(offer.first_date || offer.last_date) && <span className="nums">{formatDateRange(offer.first_date ?? null, offer.last_date ?? null)}</span>}
              </div>

              <p className="line-clamp-2 min-h-[40px] text-sm leading-relaxed text-ink-muted">
                {offer.features || L.noFeatures}
              </p>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-navy-100 pt-3">
                {canExport && (
                  <>
                    <Button size="sm" variant="gold" onClick={() => png(offer)} loading={busy === `png-${offer.id}`}><ImageDown className="h-4 w-4" />PNG</Button>
                    <Button size="sm" variant="primary" onClick={() => pdf(offer)} loading={busy === `pdf-${offer.id}`}><FileDown className="h-4 w-4" />PDF</Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => copy(offer)} loading={busy === `copy-${offer.id}`}><Copy className="h-4 w-4" />WhatsApp</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {canEdit && open && <HoneymoonModal offer={edit} onClose={() => setOpen(false)} lang={lang} labels={L} />}
      {canEdit && (
        <ConfirmDialog
          open={!!del}
          onClose={() => setDel(null)}
          onConfirm={() => del && remove.mutate(del.id)}
          danger
          confirmText={t('common.delete')}
          loading={remove.isPending}
          message={L.deleteQ.replace('{name}', del?.offer_name ?? '')}
        />
      )}
    </div>
  )
}

function HoneymoonModal({
  offer,
  onClose,
  lang,
  labels: L,
}: {
  offer: HoneymoonOffer | null
  onClose: () => void
  lang: Lang
  labels: (typeof COPY)[Lang]
}) {
  const editing = !!offer
  const { t } = useI18n()
  const toast = useToast()
  const qc = useQueryClient()
  const [f, setF] = useState({
    hotel_name: offer?.hotel_name ?? '',
    offer_name: offer?.offer_name ?? '',
    region: offer?.region ?? '',
    features: offer?.features ?? '',
    internal_notes: offer?.internal_notes ?? '',
    status: offer?.status ?? 'Draft',
  })
  const [periods, setPeriods] = useState<HoneymoonPeriod[]>(
    offer?.periods?.length ? offer.periods.map((p) => ({ ...p })) : [defaultPeriod(lang)],
  )
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const setPeriod = (idx: number, patch: Partial<HoneymoonPeriod>) => setPeriods((list) => list.map((p, i) => i === idx ? { ...p, ...patch } : p))
  const addPeriod = () => setPeriods((list) => [...list, defaultPeriod(lang)])
  const removePeriod = (idx: number) => setPeriods((list) => list.length === 1 ? [defaultPeriod(lang)] : list.filter((_, i) => i !== idx))

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...f,
        region: f.region.trim() || null,
        features: f.features.trim() || null,
        internal_notes: f.internal_notes.trim() || null,
        periods: periods.map(normalizePeriod),
      }
      return editing
        ? api.put<HoneymoonOffer>(`/honeymoon/${offer!.id}`, payload)
        : api.post<HoneymoonOffer>('/honeymoon', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['honeymoon'] })
      toast.success(L.saved)
      onClose()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const submit = () => {
    if (!f.hotel_name.trim() || !f.offer_name.trim()) return toast.error(L.required)
    save.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={<span className="flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-navy-600" />{editing ? L.editTitle : L.addTitle}</span>}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={save.isPending}>{t('common.save')}</Button></>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={L.hotelName} required><Input value={f.hotel_name} onChange={(e) => set('hotel_name', e.target.value)} /></Field>
        <Field label={L.offerName} required><Input value={f.offer_name} onChange={(e) => set('offer_name', e.target.value)} /></Field>
        <Field label={L.region}><Input value={f.region} onChange={(e) => set('region', e.target.value)} /></Field>
        <Field label={L.status}>
          <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </Select>
        </Field>
        <Field label={L.details} hint={L.detailsHint} className="sm:col-span-2">
          <Textarea value={f.features} onChange={(e) => set('features', e.target.value)} className="min-h-[110px]" />
        </Field>
        <Field label={L.internalNotes} className="sm:col-span-2">
          <Textarea value={f.internal_notes} onChange={(e) => set('internal_notes', e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-bold text-navy-900">{L.periodsTitle}</h3>
            <Button type="button" size="sm" variant="outline" onClick={addPeriod}><Plus className="h-4 w-4" />{L.addPeriod}</Button>
          </div>
          <div className="space-y-3">
            {periods.map((p, idx) => (
              <div key={idx} className="rounded-card border border-navy-100 bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="navy"><span className="nums">{idx + 1}</span></Badge>
                  <button type="button" onClick={() => removePeriod(idx)} className="grid h-9 w-9 place-items-center rounded-btn text-red-600 hover:bg-red-50" aria-label={t('common.delete')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <Field label={L.from}><Input type="date" value={p.date_from ?? ''} onChange={(e) => setPeriod(idx, { date_from: e.target.value })} /></Field>
                  <Field label={L.to}><Input type="date" value={p.date_to ?? ''} onChange={(e) => setPeriod(idx, { date_to: e.target.value })} /></Field>
                  <Field label={L.priceLabel} className="sm:col-span-2">
                    <Input value={p.price_label ?? ''} onChange={(e) => setPeriod(idx, { price_label: e.target.value })} placeholder={L.priceLabelPlaceholder} />
                  </Field>
                  <Field label={L.price}><Input type="number" min="0" value={p.price ?? ''} onChange={(e) => setPeriod(idx, { price: e.target.value })} /></Field>
                  <Field label={L.currency}>
                    <Select value={p.currency} onChange={(e) => setPeriod(idx, { currency: e.target.value as Currency })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label={L.notes} className="sm:col-span-2">
                    <Input value={p.notes ?? ''} onChange={(e) => setPeriod(idx, { notes: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
