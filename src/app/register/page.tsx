"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Glow } from "@/components/effects/glow"
import { useAuth } from "@/lib/auth"
import type { RegisterData } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH } from "@/lib/password"

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    surname: "",
    companyName: "",
    taxNumber: "",
    phone: "",
  })

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.password.trim() || !form.name.trim() || !form.surname.trim() || !form.companyName.trim()) {
      toast.error("Lütfen gerekli alanları doldurun")
      return
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Şifreler eşleşmiyor")
      return
    }
    setSubmitting(true)
    try {
      const data: RegisterData = {
        email: form.email,
        password: form.password,
        name: form.name,
        surname: form.surname,
        companyName: form.companyName,
        taxNumber: form.taxNumber,
        phone: form.phone,
      }
      await register(data)
      toast.success("Başvurunuz alındı. Firma onayından sonra giriş yapabilirsiniz.")
      router.push("/login?registered=pending")
    } catch (err: any) {
      toast.error(err.message || "Kayıt başarısız")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Glow color="rgba(57, 255, 20," size={400} opacity={0.05} blur={100} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-black font-bold text-lg">R</span>
            </div>
            <span className="text-lg font-bold text-white">ROCKSWELL</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Bayi Kaydı</h1>
          <p className="text-sm text-white/40 mt-1">İşletmeniz için B2B platformuna katılın</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Ad *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Soyad *</label>
              <input
                type="text"
                value={form.surname}
                onChange={(e) => update("surname", e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Firma Adı *</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="Otoparç Otomotiv A.Ş."
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Vergi No</label>
              <input
                type="text"
                value={form.taxNumber}
                onChange={(e) => update("taxNumber", e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Telefon</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+90 5XX XXX XX XX"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">E-posta *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="ornek@firma.com"
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
              autoComplete="email"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Şifre *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder={`En az ${MIN_PASSWORD_LENGTH} karakter`}
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Şifre Tekrar *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
                autoComplete="new-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Kayıt Ol"}
          </Button>

          <p className="text-center text-sm text-white/40">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-accent hover:text-accent/80 transition-colors font-medium">
              Giriş Yap
            </Link>
          </p>
        </form>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-white/30 hover:text-white/50 transition-colors">
            Ana Sayfaya Dön
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
