"use client"

import { create } from "zustand"
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
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getSubtotal: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.minOrderQuantity * 10) }
              : i
          ),
        }
      }
      return { items: [...state.items, item] }
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    })),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(i.minOrderQuantity, quantity), totalPrice: i.unitPrice * Math.max(i.minOrderQuantity, quantity) } : i
      ),
    })),
  clearCart: () => set({ items: [] }),
  getTotalItems: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
  getSubtotal: () => get().items.reduce((acc, i) => acc + i.totalPrice, 0),
}))

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
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
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

export const useSearchStore = create<SearchStore>((set) => ({
  recentSearches: [],
  addRecentSearch: (query) =>
    set((state) => ({
      recentSearches: [query, ...state.recentSearches.filter((s) => s !== query)].slice(0, 10),
    })),
  clearRecentSearches: () => set({ recentSearches: [] }),
  searchHistory: [],
  addToHistory: (query) =>
    set((state) => ({
      searchHistory: [query, ...state.searchHistory.filter((s) => s !== query)].slice(0, 20),
    })),
}))

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

export const useCompareStore = create<CompareStore>((set, get) => ({
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
}))

interface RecentlyViewedStore {
  items: string[]
  addItem: (productId: string) => void
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>((set) => ({
  items: [],
  addItem: (productId) =>
    set((state) => ({
      items: [productId, ...state.items.filter((i) => i !== productId)].slice(0, 12),
    })),
}))
