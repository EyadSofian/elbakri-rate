import { useRef, useState } from 'react'
import { ImageDown, FileDown, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
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
  const ref = useRef<HTMLDivElement>(null)
  const [pngBusy, setPngBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [waBusy, setWaBusy] = useState(false)

  const guard = () => {
    if (items.length === 0) {
      toast.error('لا توجد عناصر للتصدير')
      return false
    }
    return true
  }

  const png = async () => {
    if (!guard() || !ref.current) return
    setPngBusy(true)
    try {
      await exportPng(ref.current, `${fileBase}.png`)
      toast.success('تم تصدير صورة PNG')
    } catch {
      toast.error('تعذّر تصدير الصورة')
    } finally {
      setPngBusy(false)
    }
  }

  const pdf = async () => {
    if (!guard() || !ref.current) return
    setPdfBusy(true)
    try {
      await exportPdf(ref.current, `${fileBase}.pdf`)
      toast.success('تم تصدير PDF')
    } catch {
      toast.error('تعذّر تصدير PDF')
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
      toast.success('تم نسخ رسالة واتساب')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'تعذّر إنشاء الرسالة')
    } finally {
      setWaBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size={size} variant="gold" onClick={png} loading={pngBusy}><ImageDown className="h-4 w-4" />تصدير PNG</Button>
        <Button size={size} variant="primary" onClick={pdf} loading={pdfBusy}><FileDown className="h-4 w-4" />تصدير PDF</Button>
        <Button size={size} variant="outline" onClick={whatsapp} loading={waBusy}><MessageCircle className="h-4 w-4" />نسخ واتساب</Button>
      </div>

      {/* Off-screen capture stage */}
      <div className="export-stage" aria-hidden>
        <ClientOfferExport ref={ref} items={items} client={client} title={title} subtitle={subtitle} notes={notes} />
      </div>
    </>
  )
}
