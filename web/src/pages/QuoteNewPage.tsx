import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Trash2, Save, FileText, ShoppingCart } from 'lucide-react'
import { useQuoteCart } from '@/context/QuoteCartContext'
import { PageHeader, EmptyState, PageLoader } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/inputs'
import { RateStatusBadge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { api, ApiError } from '@/lib/api'
import { formatPrice, formatDateRange } from '@/lib/utils'
import { mealLabel, roomLabel } from '@/lib/labels'

export default function QuoteNewPage() {
  const { draft, loading, removeItem, refresh } = useQuoteCart()
  const navigate = useNavigate()
  const toast = useToast()
  const [client, setClient] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (draft) {
      setClient(draft.client_name ?? '')
      setPhone(draft.client_phone ?? '')
      setNotes(draft.client_notes ?? '')
    }
  }, [draft?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (status: 'draft' | 'ready') =>
      api.put(`/quotes/${draft!.id}`, { client_name: client, client_phone: phone, client_notes: notes, status }),
    onSuccess: async (_d, status) => {
      await refresh()
      toast.success(status === 'ready' ? 'تم حفظ العرض كجاهز' : 'تم حفظ المسودة')
      navigate(`/quotes/${draft!.id}`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'تعذّر الحفظ'),
  })

  if (loading) return <PageLoader />

  const items = draft?.items ?? []

  return (
    <div>
      <PageHeader title="عرض سعر جديد" subtitle={draft?.quote_number} />

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="لا توجد عناصر في العرض"
          description="اذهب لصفحة عروض المبيعات وأضف أسعارًا إلى العرض"
          action={<Button onClick={() => navigate('/sales')}>تصفح العروض</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Items */}
          <div className="space-y-2 lg:col-span-2">
            {items.map((it) => (
              <div key={it.item_id} className="flex items-center gap-3 rounded-card border border-navy-100 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-navy-900">{it.hotel_name}</span>
                    <RateStatusBadge status={it.status} />
                  </div>
                  <div className="nums mt-0.5 text-xs text-ink-muted">
                    {roomLabel(it.room_type)} · {mealLabel(it.meal_plan)} · {formatDateRange(it.date_from, it.date_to)}
                  </div>
                </div>
                <div className="nums font-extrabold text-navy-900">{formatPrice(it.adult_price, it.currency)}</div>
                <button onClick={() => removeItem(it.item_id)} className="grid h-9 w-9 place-items-center rounded-btn text-red-500 hover:bg-red-50" aria-label="حذف">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Client form */}
          <div className="card h-fit space-y-3 p-4">
            <h3 className="flex items-center gap-2 font-bold text-navy-900"><FileText className="h-5 w-5 text-navy-500" />بيانات العميل</h3>
            <Field label="اسم العميل"><Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="مثال: أحمد محمد" /></Field>
            <Field label="رقم الهاتف"><Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20100..." /></Field>
            <Field label="ملاحظات"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={() => save.mutate('ready')} loading={save.isPending}><Save className="h-4 w-4" />حفظ كجاهز</Button>
              <Button variant="outline" onClick={() => save.mutate('draft')} loading={save.isPending}>حفظ كمسودة</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
