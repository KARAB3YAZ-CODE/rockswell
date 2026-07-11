"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Glow } from "@/components/effects/glow"
import { useAuth } from "@/lib/auth"
import { ADMIN_PATH_PREFIX } from "@/lib/admin-host"
import { siteAbsoluteUrl } from "@/lib/admin-host"

export default function AdminLoginPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, login, logout, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated && isAdmin) {
      router.replace(ADMIN_PATH_PREFIX)
    }
  }, [loading, isAuthenticated, isAdmin, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error("E-posta ve şifre gerekli")
      return
    }
    setSubmitting(true)
    try {
      await login(email, password)
      // login sets user; check role after brief tick via getCurrentUser path
      const { getCurrentUser } = await import("@/lib/api")
      const user = await getCurrentUser()
      if (user.role !== "admin") {
        await logout()
        toast.error("Bu panele yalnızca yöneticiler girebilir")
        return
      }
      toast.success("Yönetici girişi başarılı")
      router.replace(ADMIN_PATH_PREFIX)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Glow color="rgba(57, 255, 20," size={400} opacity={0.05} blur={100} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-black font-bold text-lg">R</span>
            </div>
            <span className="text-lg font-bold text-white">ROCKSWELL Admin</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Yönetici Girişi</h1>
          <p className="text-sm text-white/40 mt-1">admin.rockswell.store</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/40"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-accent/40"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>

        <p className="text-center text-xs text-white/30 mt-4">
          Bayi girişi için{" "}
          <a href={siteAbsoluteUrl("/login")} className="text-accent hover:underline">
            rockswell.store/login
          </a>
        </p>
      </motion.div>
    </div>
  )
}
