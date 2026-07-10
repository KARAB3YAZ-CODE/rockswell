"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { getOrderById } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatPrice } from "@/lib/utils"
import type { Order } from "@/lib/types"
import { CreditCard, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const orderId = String(params.id)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [iframeToken, setIframeToken] = useState<string | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initPayment = useCallback(async () => {
    try {
      const o = await getOrderById(orderId)
      setOrder(o)

      if (o.status === "confirmed" || o.payment.status === "paid") {
        router.replace(`/orders/${orderId}?paid=1`)
        return
      }

      const res = await fetch("/api/payment/paytr/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email: user?.email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Ödeme başlatılamadı")
      } else if (data.testMode) {
        setTestMode(true)
      } else if (data.token) {
        setIframeToken(data.token)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ödeme başlatılamadı")
    } finally {
      setLoading(false)
    }
  }, [orderId, user?.email, router])

  useEffect(() => {
    initPayment()
  }, [initPayment])

  useEffect(() => {
    if (searchParams.get("failed") === "1") {
      toast.error("Ödeme başarısız oldu, tekrar deneyin")
    }
  }, [searchParams])

  // Poll for confirmation while the PayTR iframe is open.
  useEffect(() => {
    if (!iframeToken) return
    const interval = setInterval(async () => {
      try {
        const o = await getOrderById(orderId)
        if (o.status === "confirmed" || o.payment.status === "paid") {
          clearInterval(interval)
          router.replace(`/orders/${orderId}?paid=1`)
        }
      } catch {
        /* ignore polling errors */
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [iframeToken, orderId, router])

  const handleTestConfirm = async () => {
    setProcessing(true)
    try {
      const res = await fetch("/api/payment/paytr/confirm-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Onay başarısız")
      toast.success("Ödeme onaylandı")
      router.replace(`/orders/${orderId}?paid=1`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onay başarısız")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Shell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <CreditCard size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Güvenli Ödeme</h1>
            <p className="text-sm text-white/40">{order ? order.orderNumber : "Yükleniyor..."}</p>
          </div>
        </div>

        {loading ? (
          <GlassCard intensity="light" className="p-6 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-64 w-full" />
          </GlassCard>
        ) : error ? (
          <GlassCard intensity="light" className="p-8 text-center space-y-4">
            <AlertTriangle size={40} className="mx-auto text-danger" />
            <p className="text-white/70">{error}</p>
            <Button variant="outline" onClick={() => router.push(`/orders/${orderId}`)}>
              Siparişe Dön
            </Button>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {order && (
              <GlassCard intensity="medium" className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Ödenecek Tutar</span>
                  <span className="text-2xl font-bold text-accent">
                    {formatPrice(order.pricing.grandTotal)}
                  </span>
                </div>
              </GlassCard>
            )}

            {iframeToken && (
              <GlassCard intensity="light" className="p-2 overflow-hidden">
                <iframe
                  src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
                  className="w-full min-h-[600px] rounded-lg border-0"
                  title="PayTR Ödeme"
                />
              </GlassCard>
            )}

            {testMode && (
              <GlassCard intensity="light" className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
                  <ShieldCheck size={28} className="text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">PayTR test modu</p>
                  <p className="text-xs text-white/40 mt-1 max-w-md mx-auto">
                    PayTR canlı bilgileri (merchant_id / key / salt) eklendiğinde gerçek kart ödeme
                    ekranı burada açılır. Şimdilik akışı test etmek için ödemeyi onaylayabilirsiniz.
                  </p>
                </div>
                <Button
                  size="lg"
                  icon={<CheckCircle2 size={16} />}
                  onClick={handleTestConfirm}
                  disabled={processing}
                >
                  {processing ? "Onaylanıyor..." : "Ödemeyi Onayla (Test)"}
                </Button>
              </GlassCard>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-white/30">
              <ShieldCheck size={12} />
              256-bit SSL ile korunan güvenli ödeme altyapısı
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
