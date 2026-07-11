"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Notification, User, Company } from "./types"

interface CartItem {
  productId: string
  productName: string
  sku: string
  brand: string
  image: string
  quantity: number
  unitPrice: number
  totalPrice: number
  warehouseId: string
  minOrderQuantity: number
  maxOrderQuantity?: number
  /** customer_prices net — skip company discount at checkout */
  priceLocked?: boolean
  category?: string
  vehicleBrands?: string[]
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  orderNote: string
  setIsOpen: (open: boolean) => void
  setOrderNote: (note: string) => void
  appendOrderNote: (note: string) => void
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getSubtotal: () => number
}

function clampQty(qty: number, item: { minOrderQuantity: number; maxOrderQuantity?: number }): number {
  const min = item.minOrderQuantity || 1
  const max = item.maxOrderQuantity && item.maxOrderQuantity > 0 ? item.maxOrderQuantity : 9999
  return Math.min(Math.max(qty, min), max)
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      orderNote: "",
      setIsOpen: (open) => set({ isOpen: open }),
      setOrderNote: (note) => set({ orderNote: note }),
      appendOrderNote: (note) =>
        set((state) => {
          const t = note.trim()
          if (!t) return state
          if (!state.orderNote.trim()) return { orderNote: t }
          if (state.orderNote.includes(t)) return state
          return { orderNote: `${state.orderNote.trim()}\n${t}` }
        }),
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              items: state.items.map((i) => {
                if (i.productId !== item.productId) return i
                const quantity = clampQty(i.quantity + item.quantity, i)
                return { ...i, quantity, totalPrice: i.unitPrice * quantity }
              }),
            }
          }
          const quantity = clampQty(item.quantity, item)
          return { items: [...state.items, { ...item, quantity, totalPrice: item.unitPrice * quantity }] }
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => {
            if (i.productId !== productId) return i
            const q = clampQty(quantity, i)
            return { ...i, quantity: q, totalPrice: i.unitPrice * q }
          }),
        })),
      clearCart: () => set({ items: [], orderNote: "" }),
      getTotalItems: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
      getSubtotal: () => get().items.reduce((acc, i) => acc + i.totalPrice, 0),
    }),
    {
      name: "rockswell_cart",
      partialize: (state) => ({ items: state.items, orderNote: state.orderNote }),
    }
  )
)

interface UIStore {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  markAsRead: (id: string) => void
  clearNotifications: () => void
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  currentCompany: Company | null
  setCurrentCompany: (company: Company | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  notifications: [],
  addNotification: (notification) =>
    set((state) =>
      state.notifications.some((n) => n.id === notification.id)
        ? state
        : { notifications: [notification, ...state.notifications] }
    ),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  clearNotifications: () => set({ notifications: [] }),
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  currentCompany: null,
  setCurrentCompany: (company) => set({ currentCompany: company }),
}))

interface SearchStore {
  recentSearches: string[]
  addRecentSearch: (query: string) => void
  clearRecentSearches: () => void
  searchHistory: string[]
  addToHistory: (query: string) => void
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      recentSearches: [],
      addRecentSearch: (query) =>
        set((state) => {
          const q = query.trim()
          if (!q) return state
          return {
            recentSearches: [q, ...state.recentSearches.filter((s) => s !== q)].slice(0, 10),
            searchHistory: [q, ...state.searchHistory.filter((s) => s !== q)].slice(0, 20),
          }
        }),
      clearRecentSearches: () => set({ recentSearches: [], searchHistory: [] }),
      searchHistory: [],
      addToHistory: (query) =>
        set((state) => {
          const q = query.trim()
          if (!q) return state
          return {
            searchHistory: [q, ...state.searchHistory.filter((s) => s !== q)].slice(0, 20),
          }
        }),
    }),
    { name: "rockswell-search" }
  )
)

interface FilterStore {
  filters: Record<string, string[]>
  setFilter: (key: string, values: string[]) => void
  clearFilter: (key: string) => void
  clearAllFilters: () => void
}

export const useFilterStore = create<FilterStore>((set) => ({
  filters: {},
  setFilter: (key, values) =>
    set((state) => ({
      filters: { ...state.filters, [key]: values },
    })),
  clearFilter: (key) =>
    set((state) => {
      const rest = Object.fromEntries(Object.entries(state.filters).filter(([k]) => k !== key))
      return { filters: rest }
    }),
  clearAllFilters: () => set({ filters: {} }),
}))

interface CompareStore {
  items: string[]
  addItem: (productId: string) => void
  removeItem: (productId: string) => void
  clearAll: () => void
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (productId) =>
        set((state) => {
          if (state.items.includes(productId)) return state
          if (state.items.length >= 4) return state
          return { items: [...state.items, productId] }
        }),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i !== productId) })),
      clearAll: () => set({ items: [] }),
    }),
    { name: "rockswell-compare" }
  )
)

interface RecentlyViewedStore {
  items: string[]
  addItem: (productId: string) => void
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId) =>
        set((state) => ({
          items: [productId, ...state.items.filter((i) => i !== productId)].slice(0, 12),
        })),
    }),
    { name: "rockswell-recently-viewed" }
  )
)
