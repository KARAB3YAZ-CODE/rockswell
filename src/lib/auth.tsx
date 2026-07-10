"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const { currentUser, setCurrentUser, currentCompany, setCurrentCompany } = useUIStore()
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const session = await api.initSessionFromSupabase()
        if (mounted && session) {
          setCurrentUser(session.user)
          setCurrentCompany(session.company)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === "SIGNED_OUT") {
        setCurrentUser(null)
        setCurrentCompany(null)
        return
      }

      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const restored = await api.initSessionFromSupabase()
        if (restored) {
          setCurrentUser(restored.user)
          setCurrentCompany(restored.company)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setCurrentUser, setCurrentCompany])

  const login = useCallback(async (email: string, password: string) => {
    const user = await api.login(email, password)
    const company = await api.getCurrentCompany()
    setCurrentUser(user)
    setCurrentCompany(company)
  }, [setCurrentUser, setCurrentCompany])

  const register = useCallback(async (data: RegisterData) => {
    await api.register(data)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setCurrentUser(null)
    setCurrentCompany(null)
    router.push("/login")
  }, [setCurrentUser, setCurrentCompany, router])

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
