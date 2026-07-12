import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { HoneymoonOffer, Hotel, HotelGroup, Lists, Package } from '@/types'

export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: () => api.get<Lists>('/lists'),
    staleTime: Infinity,
  })
}

export function useHotelGroups() {
  return useQuery({ queryKey: ['hotel-groups'], queryFn: () => api.get<HotelGroup[]>('/hotel-groups') })
}

export function useHotels(params?: Record<string, unknown>) {
  return useQuery({ queryKey: ['hotels', params], queryFn: () => api.get<Hotel[]>('/hotels', params) })
}

export function usePackages() {
  return useQuery({ queryKey: ['packages'], queryFn: () => api.get<Package[]>('/packages') })
}

export function useHoneymoonOffers(params?: Record<string, unknown>) {
  return useQuery({ queryKey: ['honeymoon', params], queryFn: () => api.get<HoneymoonOffer[]>('/honeymoon', params) })
}
