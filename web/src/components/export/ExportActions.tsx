import { useRef, useState } from 'react'
import { ImageDown, FileDown, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useI18n } from '@/lib/i18n'
import { ClientOfferExport } from './ClientOfferExport'
import { exportPng, exportPdf } from '@/lib/exporter'
import { api, ApiError } from '@/lib/api'
import type { Rate } from '@/types'

export function ExportActions({
  items,
  client,
  title,
  subtitle,
  notes,
  quoteId,
  fileBase = 'elbakri-offer',
  size = 'md',
}: {
  items: Rate[]
  client?: string | null
  title?: string | null
  subtitle?: string | null
  notes?: string | null
  quoteId?: number
  fileBase?: string
  size?: 'sm' | 'md'
}) {
  const toast = useToast()
  const { t, lang } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
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

  const png = async () => {
    if (!guard() || !ref.current) return
    setPngBusy(true)
    try {
      await exportPng(ref.current, `${fileBase}.png`)
      toast.success(t('export.pngDone'))
    } catch {
      toast.error(t('export.pngFail'))
    } finally {
      setPngBusy(false)
    }
  }

  const pdf = async () => {
    if (!guard() || !ref.current) return
    setPdfBusy(true)
    try {
      await exportPdf(ref.current, `${fileBase}.pdf`)
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
      const payload = quoteId ? { quote_id: quoteId } : { rate_ids: items.map((i) => i.id), title, notes }
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
    <>
      <div className="flex flex-wrap gap-2">
        <Button size={size} variant="gold" onClick={png} loading={pngBusy}><ImageDown className="h-4 w-4" />{t('export.png')}</Button>
        <Button size={size} variant="primary" onClick={pdf} loading={pdfBusy}><FileDown className="h-4 w-4" />{t('export.pdf')}</Button>
        <Button size={size} variant="outline" onClick={whatsapp} loading={waBusy}><MessageCircle className="h-4 w-4" />{t('export.whatsapp')}</Button>
      </div>

      {/* Off-screen capture stage */}
      <div className="export-stage" aria-hidden>
        <ClientOfferExport ref={ref} items={items} client={client} title={title} subtitle={subtitle} notes={notes} lang={lang} />
      </div>
    </>
  )
}
