import { useState } from 'react'
import { ImageDown, FileDown, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import type { HotelInfo, OfferExportData } from './ClientOfferExport'
import { exportOfferPng, exportOfferPdf, exportHoneymoonPng, exportHoneymoonPdf } from '@/lib/exporter'
import { api, ApiError } from '@/lib/api'
import type { Rate } from '@/types'

export function ExportActions({
  items,
  client,
  title,
  subtitle,
  notes,
  features,
  reference,
  issuedDate,
  quoteId,
  hotelInfo,
  mode,
  detailsMode,
  honeymoon = false,
  fileBase = 'elbakri-offer',
  size = 'md',
}: {
  items: Rate[]
  client?: string | null
  title?: string | null
  subtitle?: string | null
  notes?: string | null
  /** Selling points for the honeymoon brochure (only used when honeymoon). */
  features?: string | null
  reference?: string | null
  issuedDate?: string | null
  quoteId?: number
  hotelInfo?: Record<number, HotelInfo>
  mode?: 'auto' | 'hotel'
  detailsMode?: OfferExportData['detailsMode']
  /** Render the premium honeymoon brochure instead of the standard grid. */
  honeymoon?: boolean
  fileBase?: string
  size?: 'sm' | 'md'
}) {
  const toast = useToast()
  const { t, lang } = useI18n()
  const [pngBusy, setPngBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [waBusy, setWaBusy] = useState(false)

  const guard = () => {
    if (items.length === 0) {
      toast.error(t('export.noItems'))
      return false
    }
    return true
  }

  const data = (): OfferExportData => ({ items, client, title, subtitle, notes, features, reference, issuedDate, lang, hotelInfo, mode, detailsMode })
  const safeName = (fileBase || 'elbakri-offer').replace(/[\\/:*?"<>|]+/g, '-')
  const pngExporter = honeymoon ? exportHoneymoonPng : exportOfferPng
  const pdfExporter = honeymoon ? exportHoneymoonPdf : exportOfferPdf

  const png = async () => {
    if (!guard()) return
    setPngBusy(true)
    try {
      const n = await pngExporter(data(), `${safeName}.png`)
      toast.success(n > 1 ? t('export.pngDoneMulti', { n }) : t('export.pngDone'))
    } catch {
      toast.error(t('export.pngFail'))
    } finally {
      setPngBusy(false)
    }
  }

  const pdf = async () => {
    if (!guard()) return
    setPdfBusy(true)
    try {
      await pdfExporter(data(), `${safeName}.pdf`)
      toast.success(t('export.pdfDone'))
    } catch {
      toast.error(t('export.pdfFail'))
    } finally {
      setPdfBusy(false)
    }
  }

  const whatsapp = async () => {
    if (!guard()) return
    setWaBusy(true)
    try {
      const payload = quoteId
        ? { quote_id: quoteId, lang }
        : { rate_ids: items.map((i) => i.id), title, notes, lang }
      const res = await api.post<{ text: string }>('/whatsapp/copy-template', payload)
      await navigator.clipboard.writeText(res.text)
      toast.success(t('export.waDone'))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('export.waFail'))
    } finally {
      setWaBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} variant="gold" onClick={png} loading={pngBusy}><ImageDown className="h-4 w-4" />{t('export.png')}</Button>
      <Button size={size} variant="primary" onClick={pdf} loading={pdfBusy}><FileDown className="h-4 w-4" />{t('export.pdf')}</Button>
      <Button size={size} variant="outline" onClick={whatsapp} loading={waBusy}><MessageCircle className="h-4 w-4" />{t('export.whatsapp')}</Button>
    </div>
  )
}
