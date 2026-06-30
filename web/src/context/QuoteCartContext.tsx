import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useAuth } from './AuthContext'
import type { Quote } from '@/types'

interface CartCtx {
  draft: Quote | null
  count: number
  rateIds: Set<number>
  loading: boolean
  addRate: (rateId: number) => Promise<void>
  removeItem: (itemId: number) => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
}

const Ctx = createContext<CartCtx | null>(null)

export function QuoteCartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const canQuote = !!user && ['admin', 'operations', 'sales'].includes(user.role)
  const [draft, setDraft] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!canQuote) {
      setDraft(null)
      return
    }
    setLoading(true)
    try {
      const q = await api.get<Quote>('/quotes/current')
      setDraft(q)
    } catch {
      setDraft(null)
    } finally {
      setLoading(false)
    }
  }, [canQuote])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addRate = useCallback(
    async (rateId: number) => {
      const res = await api.post<{ quote_id: number; items_count: number }>('/quote-items', { hotel_rate_id: rateId })
      // Re-fetch the draft to get fresh items (keeps rateIds + count accurate).
      await refresh()
      return void res
    },
    [refresh],
  )

  const removeItem = useCallback(
    async (itemId: number) => {
      await api.del(`/quote-items/${itemId}`)
      await refresh()
    },
    [refresh],
  )

  const rateIds = useMemo(() => new Set((draft?.items ?? []).map((i) => i.hotel_rate_id)), [draft])
  const count = draft?.items?.length ?? 0

  const value: CartCtx = {
    draft,
    count,
    rateIds,
    loading,
    addRate,
    removeItem,
    refresh,
    reset: () => setDraft(null),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useQuoteCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useQuoteCart must be used within QuoteCartProvider')
  return ctx
}
