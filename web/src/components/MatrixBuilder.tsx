import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Save, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/inputs'
import { SectionTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { PeriodsEditor, newPeriod, periodsToApi, countRecords, type Period } from '@/components/PeriodsEditor'
import { useHotels, useLists } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export function MatrixBuilder({ presetHotelIds, onDone }: { presetHotelIds?: number[]; onDone?: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const { t } = useI18n()
  const { data: hotels } = useHotels()
  const { data: lists } = useLists()

  const [hotelIds, setHotelIds] = useState<number[]>(presetHotelIds ?? [])
  const [periods, setPeriods] = useState<Period[]>([newPeriod()])
  const [overwrite, setOverwrite] = useState(false)
  const hotelOptions = useMemo(() => hotels ?? [], [hotels])

  const toggle = (id: number) => setHotelIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const expected = hotelIds.length * countRecords(periods)

  const save = useMutation({
    mutationFn: () =>
      api.post<{ rates_created: number }>('/rates/matrix', {
        hotel_ids: hotelIds,
        periods: periodsToApi(periods),
        overwrite,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries()
      toast.success(t('matrix.created', { n: res.rates_created }))
      setPeriods([newPeriod()])
      onDone?.()
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : t('err.save')),
  })

  const submit = () => {
    if (hotelIds.length === 0) return toast.error(t('matrix.selectHotel'))
    if (countRecords(periods) === 0) return toast.error(t('matrix.atLeastOne'))
    save.mutate()
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="card p-4">
        <SectionTitle>
          <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-navy-500" />{t('matrix.hotels')} <span className="nums text-ink-muted">({hotelIds.length})</span></span>
        </SectionTitle>
        <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
          {hotelOptions.map((h) => (
            <div key={h.id} className={cn('rounded-btn px-2', hotelIds.includes(h.id) && 'bg-navy-50')}>
              <Checkbox checked={hotelIds.includes(h.id)} onChange={() => toggle(h.id)} label={<span>{h.hotel_name} <span className="text-xs text-ink-muted">· {h.region ?? ''}</span></span>} />
            </div>
          ))}
          {hotelOptions.length === 0 && <p className="p-3 text-sm text-ink-muted">{t('matrix.noHotels')}</p>}
        </div>
      </div>

      <div className="card p-4">
        <SectionTitle><span className="flex items-center gap-2"><Layers className="h-4 w-4 text-navy-500" />{t('matrix.periodsRooms')}</span></SectionTitle>
        <PeriodsEditor value={periods} onChange={setPeriods} lists={lists} />
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-16 z-20 px-3 lg:bottom-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-card border border-navy-200 bg-white p-2.5 shadow-pop">
          <div className="flex items-center gap-3">
            <Checkbox checked={overwrite} onChange={setOverwrite} label={t('matrix.overwrite')} />
            <span className="text-sm text-ink-muted">{t('matrix.expected')}: <span className="nums font-extrabold text-navy-900">{expected}</span></span>
          </div>
          <Button onClick={submit} loading={save.isPending} disabled={expected === 0}><Save className="h-4 w-4" />{t('matrix.save')}</Button>
        </div>
      </div>
    </div>
  )
}
