import { useState, useEffect, useCallback } from "react"

interface UseDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function useProduct(id: string) {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getProductById(id)),
    [id]
  )
  return { product: data, loading, error, refetch }
}

export function useProducts() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getProducts()),
    []
  )
  return { products: data || [], loading, error, refetch }
}

export function useSearch(query: string) {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.searchProducts(query)),
    [query]
  )
  return { results: data || [], loading, error, refetch, total: data?.length || 0 }
}

export function useOrders() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getOrders()),
    []
  )
  return { orders: data || [], loading, error, refetch }
}

export function useDashboardStats() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getDashboardStats()),
    []
  )
  return { stats: data, loading, error, refetch }
}

export function useCampaigns() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getCampaigns()),
    []
  )
  return { campaigns: data || [], loading, error, refetch }
}

export function useCurrentUser() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getCurrentUser()),
    []
  )
  return { user: data, loading, error, refetch }
}

export function useCurrentCompany() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getCurrentCompany()),
    []
  )
  return { company: data, loading, error, refetch }
}

export function useNotifications() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getNotifications()),
    []
  )
  return { notifications: data || [], loading, error, refetch }
}

export function useWarehouses() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getWarehouses()),
    []
  )
  return { warehouses: data || [], loading, error, refetch }
}

export function useVehicleBrands() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getVehicleBrands()),
    []
  )
  return { brands: data || [], loading, error, refetch }
}

export function useProductBrands() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getProductBrands()),
    []
  )
  return { brands: data || [], loading, error, refetch }
}

export function useCategories() {
  const { data, loading, error, refetch } = useData(
    () => import("@/lib/api").then((m) => m.getCategories()),
    []
  )
  return { categories: data || [], loading, error, refetch }
}
