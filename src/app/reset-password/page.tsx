"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Glow } from "@/components/effects/glow"
import { supabase } from "@/lib/supabase"
import { MIN_PASSWORD_LENGTH } from "@/lib/password"
import { CheckCircle2, KeyRound } from "lucide-react"

type Phase = "checking" | "ready" | "invalid" | "done"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true

    // The recovery link establishes a temporary session (parsed from the URL).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPhase("ready")
    })

    // Fallback: a session may already be present by the time we subscribe.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setPhase((p) => (p === "checking" ? (data.session ? "ready" : "invalid") : p))
    }, 1500)

    return () => {
      mounted = false
      clearTimeout(t)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
      return
    }
    if (password !== confirm) {
      toast.error("Şifreler eşleşmiyor")
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPhase("done")
      toast.success("Şifreniz güncellendi")
      await supabase.auth.signOut()
      setTimeout(() => router.replace("/login"), 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre güncellenemedi")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    "w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Glow color="rgba(57, 255, 20," size={400} opacity={0.05} blur={100} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-black font-bold text-lg">R</span>
            </div>
            <span className="text-lg font-bold text-white">ROCKSWELL</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Şifre Belirle</h1>
          <p className="text-sm text-white/40 mt-1">Hesabınız için yeni bir şifre oluşturun</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          {phase === "checking" && (
            <div className="py-10 text-center text-sm text-white/50">Bağlantı doğrulanıyor...</div>
          )}

          {phase === "invalid" && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
                <KeyRound size={22} />
              </div>
              <p className="text-sm text-white/70">Bağlantı geçersiz veya süresi dolmuş.</p>
              <p className="text-xs text-white/40">Lütfen yöneticinizden yeni bir şifre sıfırlama bağlantısı isteyin.</p>
              <Link href="/login" className="inline-block text-sm text-accent hover:text-accent/80 pt-2">Girişe dön</Link>
            </div>
          )}

          {phase === "done" && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-sm text-white/70">Şifreniz başarıyla güncellendi.</p>
              <p className="text-xs text-white/40">Giriş sayfasına yönlendiriliyorsunuz...</p>
            </div>
          )}

          {phase === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Yeni Şifre</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Yeni Şifre (Tekrar)</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className={inputCls} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Kaydediliyor..." : "Şifreyi Güncelle"}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
