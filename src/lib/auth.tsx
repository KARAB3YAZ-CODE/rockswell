"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react"
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
  completeMfaLogin: (code: string) => Promise<void>
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

  // Tracks which user id has already been loaded so redundant auth events
  // (e.g. TOKEN_REFRESHED ~1s after INITIAL_SESSION) don't re-fetch and
  // re-set the session, which would cause an app-wide re-render/reload.
  const loadedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadSession(userId: string) {
      if (loadedUserIdRef.current === userId) return
      loadedUserIdRef.current = userId
      const restored = await api.initSessionFromSupabase()
      if (mounted && restored) {
        setCurrentUser(restored.user)
        setCurrentCompany(restored.company)
      }
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return
        if (data.session?.user) {
          await loadSession(data.session.user.id)
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === "SIGNED_OUT" || !session?.user) {
        loadedUserIdRef.current = null
        setCurrentUser(null)
        setCurrentCompany(null)
        setLoading(false)
        return
      }

      // Only (re)load when the signed-in user actually changes.
      await loadSession(session.user.id)
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setCurrentUser, setCurrentCompany])

  const login = useCallback(async (email: string, password: string) => {
    const user = await api.login(email, password)
    const company = await api.getCurrentCompany()
    loadedUserIdRef.current = user.id
    setCurrentUser(user)
    setCurrentCompany(company)
  }, [setCurrentUser, setCurrentCompany])

  const completeMfaLogin = useCallback(async (code: string) => {
    const user = await api.verifyMfaLogin(code)
    const company = await api.getCurrentCompany()
    loadedUserIdRef.current = user.id
    setCurrentUser(user)
    setCurrentCompany(company)
  }, [setCurrentUser, setCurrentCompany])

  const register = useCallback(async (data: RegisterData) => {
    await api.register(data)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    loadedUserIdRef.current = null
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
        completeMfaLogin,
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
