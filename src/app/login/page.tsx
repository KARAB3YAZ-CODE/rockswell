"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Glow } from "@/components/effects/glow"
import { useAuth } from "@/lib/auth"
import { requestPasswordReset } from "@/lib/api"
import { adminAbsoluteUrl } from "@/lib/admin-host"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, login, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<"login" | "forgot">("login")
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("registered=true")) {
      toast.success("Kaydınız başarıyla oluşturuldu. Lütfen giriş yapın.")
    }
  }, [])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (isAdmin) {
        window.location.href = adminAbsoluteUrl("/")
        return
      }
      router.replace("/home")
    }
  }, [isAuthenticated, isAdmin, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error("E-posta ve şifre gerekli")
      return
    }
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success("Giriş başarılı")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("E-posta gerekli")
      return
    }
    setResetting(true)
    try {
      await requestPasswordReset(email)
      toast.success("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi")
      setMode("login")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gönderilemedi")
    } finally {
      setResetting(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Glow color="rgba(57, 255, 20," size={400} opacity={0.05} blur={100} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-black font-bold text-lg">R</span>
            </div>
            <span className="text-lg font-bold text-white">ROCKSWELL</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {mode === "forgot" ? "Şifre Sıfırlama" : "Bayi Girişi"}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {mode === "forgot"
              ? "E-posta adresinize sıfırlama bağlantısı göndereceğiz"
              : "B2B otomotiv yedek parça platformuna hoş geldiniz"}
          </p>
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleForgot} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@firma.com"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={resetting}>
              {resetting ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Girişe dön
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@firma.com"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-white/50">
                <input type="checkbox" defaultChecked className="rounded border-white/20 bg-white/5" />
                Beni Hatırla
              </label>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-accent hover:text-accent/80 transition-colors"
              >
                Şifremi Unuttum
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>

            <p className="text-center text-sm text-white/40">
              Hesabınız yok mu?{" "}
              <Link href="/register" className="text-accent hover:text-accent/80 transition-colors font-medium">
                Kayıt Ol
              </Link>
            </p>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-white/30 hover:text-white/50 transition-colors">
            Ana Sayfaya Dön
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
