import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useQueryClient } from '@tanstack/react-query'
import { UploadCloud, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Select, Checkbox } from '@/components/ui/inputs'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { api, ApiError } from '@/lib/api'

const PRICING_MAP: Record<string, string> = {
  'per person per night': 'per_person_per_night',
  'per room per night': 'per_room_per_night',
  'room per night': 'per_room_per_night',
  'package per person': 'per_person_package',
  'package per room': 'per_room_package',
}
const KNOWN_KEYS = ['hotel_name', 'record_id', 'room_type', 'adult_price']

function normalizeKey(k: string) {
  return String(k).trim().toLowerCase().replace(/\s+/g, '_')
}

function excelDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

interface Row { [k: string]: unknown }

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'Draft' | 'Ready'>('Draft')
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ rows_success: number; rows_failed: number } | null>(null)

  const reset = () => { setRows([]); setFileName(''); setResult(null) }

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setResult(null)
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })

    // Find the header row (contains a known key)
    let headerIdx = matrix.findIndex((r) => (r as unknown[]).some((c) => KNOWN_KEYS.includes(normalizeKey(String(c ?? '')))))
    if (headerIdx < 0) headerIdx = 0
    const headers = (matrix[headerIdx] as unknown[]).map((c) => normalizeKey(String(c ?? '')))

    const parsed: Row[] = []
    for (let i = headerIdx + 1; i < matrix.length; i++) {
      const arr = matrix[i] as unknown[]
      if (!arr || arr.every((c) => c == null || c === '')) continue
      const obj: Row = {}
      headers.forEach((h, idx) => { if (h) obj[h] = arr[idx] })

      const hotel = obj.hotel_name ?? obj.hotelname
      const priceRaw = obj.adult_price ?? obj.package_price ?? obj.price
      if (!hotel || priceRaw == null || priceRaw === '') continue

      const basis = obj.pricing_basis ? PRICING_MAP[String(obj.pricing_basis).toLowerCase()] ?? obj.pricing_basis : undefined
      parsed.push({
        hotel_name: String(hotel).trim(),
        hotel_group: obj.hotel_group ?? null,
        region: obj.region ?? null,
        sub_region: obj.sub_region ?? null,
        category: obj.category ?? null,
        offer_name: obj.offer_name ?? null,
        season_name: obj.season_name ?? null,
        date_from: excelDate(obj.date_from),
        date_to: excelDate(obj.date_to),
        room_type: obj.room_type ?? 'Double',
        meal_plan: obj.meal_plan ?? 'BB',
        pricing_basis: basis,
        currency: obj.currency ?? 'EGP',
        adult_price: priceRaw,
        child_price: obj.child_price ?? null,
        child_policy_code: obj.child_policy_code ?? null,
        nights: obj.nights ?? null,
        days: obj.days ?? null,
      })
    }
    setRows(parsed)
    if (parsed.length === 0) toast.error(t('import.noRows'))
  }

  const submit = async () => {
    if (rows.length === 0) return
    setBusy(true)
    try {
      const payload: Record<string, unknown> = { rows, default_status: status, overwrite, type: 'xlsx' }
      const res = await api.post<{ rows_success: number; rows_failed: number }>('/import', payload)
      setResult(res)
      qc.invalidateQueries()
      toast.success(t('import.importedN', { n: res.rows_success }))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('import.failToast'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      size="lg"
      title={<span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-navy-600" />{t('import.title')}</span>}
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose() }}>{t('common.close')}</Button>
          <Button onClick={submit} loading={busy} disabled={rows.length === 0}>{t('import.btn')} {rows.length > 0 ? `(${rows.length})` : ''}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-navy-200 bg-surface/60 px-4 py-8 text-center transition hover:border-navy-300 hover:bg-navy-50"
        >
          <UploadCloud className="h-8 w-8 text-navy-400" />
          <span className="text-sm font-semibold text-navy-800">{fileName || t('import.pick')}</span>
          <span className="text-xs text-ink-muted">{t('import.expectedCols')}</span>
        </button>

        {rows.length > 0 && !result && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('import.statusLabel')}>
                <Select value={status} onChange={(e) => setStatus(e.target.value as 'Draft' | 'Ready')}>
                  <option value="Draft">{t('status.Draft')}</option>
                  <option value="Ready">{t('status.Ready')}</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <Checkbox checked={overwrite} onChange={setOverwrite} label={t('import.overwrite')} />
              </div>
            </div>
            <div className="rounded-card border border-navy-100">
              <div className="border-b border-navy-100 bg-navy-50 px-3 py-2 text-xs font-bold text-navy-700">
                {t('import.previewTitle', { n: rows.length })}
              </div>
              <div className="divide-y divide-navy-50 text-xs">
                {rows.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="truncate font-semibold text-navy-800">{String(r.hotel_name)}</span>
                    <span className="text-ink-muted">{String(r.room_type)} · <span className="nums">{String(r.adult_price)}</span> {String(r.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {result && (
          <div className="flex items-center gap-3 rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-6 w-6" />
            <div>
              <div className="font-bold">{t('import.done')}</div>
              <div className="nums text-xs">{t('import.succeeded')}: {result.rows_success} · {t('import.failed')}: {result.rows_failed}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
