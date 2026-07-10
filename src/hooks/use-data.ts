import { useState, useEffect, useCallback, useRef } from "react"

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

  // Always call the latest fetcher without making it a dependency.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Dedupe identical requests (e.g. React StrictMode double-invoke in dev,
  // or repeated mounts with the same deps) so data is fetched only once.
  const inFlightRef = useRef<{ key: string; promise: Promise<T> } | null>(null)

  const run = useCallback(
    (force = false) => {
      const key = JSON.stringify(deps)
      if (!force && inFlightRef.current?.key === key) {
        return inFlightRef.current.promise
      }

      setLoading(true)
      setError(null)

      const promise = fetcherRef.current()
        .then((result) => {
          if (mountedRef.current) setData(result)
          return result
        })
        .catch((e: unknown) => {
          if (mountedRef.current) setError(e instanceof Error ? e.message : "Bir hata oluştu")
          throw e
        })
        .finally(() => {
          if (mountedRef.current) setLoading(false)
        })

      inFlightRef.current = { key, promise }
      return promise
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    deps
  )

  useEffect(() => {
    run().catch(() => {})
  }, [run])

  return { data, loading, error, refetch: () => run(true) }
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
