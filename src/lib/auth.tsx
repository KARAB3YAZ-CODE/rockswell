"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/lib/store"
import * as api from "@/lib/api"
import type { User, Company } from "@/lib/types"

interface AuthContextType {
  user: User | null
  company: Company | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
}

export interface RegisterData {
  email: string
  password: string
  name: string
  surname: string
  companyName: string
  taxNumber: string
  phone: string
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_KEY = "rockswell_auth"

function saveSession(user: User, company: Company) {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user, company }))
}

function clearSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_KEY)
}

function loadSession(): { user: User; company: Company } | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.user && data.company) return data
    return null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const { currentUser, setCurrentUser, currentCompany, setCurrentCompany } = useUIStore()
  const router = useRouter()

  useEffect(() => {
    const session = loadSession()
    if (session) {
      api.restoreSession(session.user, session.company)
      setCurrentUser(session.user)
      setCurrentCompany(session.company)
    }
    setLoading(false)
  }, [setCurrentUser, setCurrentCompany])

  const login = useCallback(async (email: string, password: string) => {
    const user = await api.login(email, password)
    const company = await api.getCurrentCompany()
    saveSession(user, company)
    setCurrentUser(user)
    setCurrentCompany(company)
  }, [setCurrentUser, setCurrentCompany])

  const register = useCallback(async (data: RegisterData) => {
    await api.register(data)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    clearSession()
    setCurrentUser(null)
    setCurrentCompany(null)
  }, [setCurrentUser, setCurrentCompany])

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        company: currentCompany,
        loading,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.role === "admin",
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
