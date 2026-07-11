"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { useCartStore } from "@/lib/store"
import { formatPrice } from "@/lib/utils"
import { computeCartPricing, DEFAULT_DISCOUNT_RATE, HAVALE_EXTRA_DISCOUNT_RATE, TAX_RATE } from "@/lib/pricing"
import { createOrder, getCustomerDiscountRate, type PaymentMethod } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useData } from "@/hooks/use-data"
import {
  ShoppingCart, Trash2, Plus, Minus, Package,
  CreditCard, Truck, Building2, CheckCircle2,
  FileText, AlertTriangle, ShoppingBag, AlertCircle,
} from "lucide-react"

export default function CartPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { items, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore()
  const [orderNote, setOrderNote] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("havale")
  const [submitting, setSubmitting] = useState(false)

  const { data: fetchedRate } = useData(
    () => (isAuthenticated ? getCustomerDiscountRate() : Promise.resolve(DEFAULT_DISCOUNT_RATE)),
    [isAuthenticated]
  )
  const discountRate = fetchedRate ?? DEFAULT_DISCOUNT_RATE
  const subtotal = getSubtotal()
  const { discount, paymentDiscount, shipping, tax, total, paymentDiscountRate } = computeCartPricing(
    subtotal,
    discountRate,
    paymentMethod
  )

  const checkoutItems = () =>
    items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      brand: i.brand,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      warehouseId: i.warehouseId,
    }))

  const handleSubmitOrder = async () => {
    if (!isAuthenticated) {
      toast.error("Sipariş vermek için giriş yapın")
      router.push("/login")
      return
    }
    if (items.length === 0) return

    setSubmitting(true)
    try {
      const order = await createOrder({
        items: checkoutItems(),
        paymentMethod,
        notes: orderNote,
      })

      if (paymentMethod === "online") {
        clearCart()
        router.push(`/payment/${order.id}`)
      } else {
        clearCart()
        toast.success("Siparişiniz onaya gönderildi!")
        router.push(`/orders/${order.id}?created=1`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sipariş oluşturulamadı")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateRfq = async () => {
    if (!isAuthenticated) {
      toast.error("Teklif almak için giriş yapın")
      router.push("/login")
      return
    }
    if (items.length === 0) return

    setSubmitting(true)
    try {
      const order = await createOrder({
        items: checkoutItems(),
        paymentMethod: "havale",
        notes: orderNote,
        asQuotation: true,
      })
      clearCart()
      toast.success("Teklif talebiniz oluşturuldu")
      router.push(`/orders/${order.id}?created=1`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Teklif oluşturulamadı")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Sipariş Sepeti</h1>
              <p className="text-sm text-white/40">{items.length} ürün</p>
            </div>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart} icon={<Trash2 size={14} />}>
              Temizle
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={40} className="text-white/20" />
            </div>
            <p className="text-white/50">Sipariş sepetiniz boş</p>
            <Link href="/products">
              <Button variant="primary" size="md" className="mt-4">Kataloğa Göz At</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <p className="text-sm text-white/60 px-1">Tüm fiyatlar KDV hariç bayi fiyatıdır.</p>

              <div className="flex items-center gap-2 text-xs text-accent bg-accent/5 px-3 py-2 rounded-lg">
                <AlertCircle size={14} />
                %{discountRate} Bayi İndirimi
                {paymentMethod === "havale" ? ` + %${HAVALE_EXTRA_DISCOUNT_RATE} Havale/EFT İndirimi` : ""} uygulanmaktadır
              </div>

              {items.map((item) => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <GlassCard intensity="light" className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={28} className="text-white/20" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="premium" size="sm">{item.brand}</Badge>
                          <span className="text-[10px] text-white/30 font-mono">{item.sku}</span>
                        </div>
                        <Link href={`/products/${item.productId}`}>
                          <h3 className="text-sm font-medium text-white mt-0.5 hover:text-accent transition-colors">{item.productName}</h3>
                        </Link>
                        <p className="text-xs text-white/40 mt-0.5">{formatPrice(item.unitPrice)} / adet</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-10 text-center text-xs font-medium text-white">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-white mt-2">{formatPrice(item.unitPrice * item.quantity)}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-danger hover:bg-danger/5 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}

              {/* Ödeme Yöntemi */}
              <GlassCard intensity="light" className="p-4 space-y-3">
                <label className="text-sm font-medium text-white block">Ödeme Yöntemi</label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("havale")}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      paymentMethod === "havale"
                        ? "border-accent/50 bg-accent/5"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className={paymentMethod === "havale" ? "text-accent" : "text-white/40"} />
                      <span className="text-sm font-medium text-white">Havale / EFT</span>
                      {paymentMethod === "havale" && <CheckCircle2 size={14} className="text-accent ml-auto" />}
                    </div>
                    <p className="text-xs text-white/40 mt-1">+%{HAVALE_EXTRA_DISCOUNT_RATE} ekstra indirim · yönetici onayı</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      paymentMethod === "online"
                        ? "border-accent/50 bg-accent/5"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className={paymentMethod === "online" ? "text-accent" : "text-white/40"} />
                      <span className="text-sm font-medium text-white">Online Ödeme</span>
                      {paymentMethod === "online" && <CheckCircle2 size={14} className="text-accent ml-auto" />}
                    </div>
                    <p className="text-xs text-white/40 mt-1">Kredi kartı ile anında onay (PayTR)</p>
                  </button>
                </div>
              </GlassCard>

              {/* Sipariş Notu */}
              <GlassCard intensity="light" className="p-4">
                <label className="text-sm font-medium text-white mb-2 block">Sipariş Notu</label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Siparişinizle ilgili notlar..."
                  className="w-full min-h-[80px] bg-white/[0.03] border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-white/30 resize-none outline-none focus:border-accent/50 transition-colors"
                />
              </GlassCard>
            </div>

            {/* Cart Summary */}
            <div className="lg:col-span-1">
              <GlassCard intensity="medium" className="p-5 space-y-4 sticky top-24">
                <h3 className="text-sm font-semibold text-white">Sipariş Özeti</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Ara Toplam</span>
                    <span className="text-white">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Bayi İndirimi (%{discountRate})</span>
                    <span className="text-success">-{formatPrice(discount)}</span>
                  </div>
                  {paymentDiscountRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Havale / EFT İndirimi (%{paymentDiscountRate})</span>
                      <span className="text-success">-{formatPrice(paymentDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Kargo</span>
                    <span className="text-white">{shipping === 0 ? "Ücretsiz" : formatPrice(shipping)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">KDV (%{TAX_RATE * 100})</span>
                    <span className="text-white">{formatPrice(tax)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between">
                    <span className="text-sm font-semibold text-white">Toplam</span>
                    <span className="text-lg font-bold text-accent">{formatPrice(total)}</span>
                  </div>
                </div>

                {shipping === 0 && subtotal > 0 && (
                  <div className="flex items-center gap-2 text-xs text-success bg-success/5 px-3 py-2 rounded-lg">
                    <Truck size={12} />
                    Ücretsiz kargo hakkınız bulunuyor
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="w-full"
                    icon={<CreditCard size={16} />}
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                  >
                    {submitting
                      ? "İşleniyor..."
                      : paymentMethod === "online"
                        ? "Ödemeye Geç"
                        : "Siparişi Onaya Gönder"}
                  </Button>
                  <p className="text-xs text-center text-white/30">
                    {paymentMethod === "online"
                      ? "Güvenli ödeme sayfasına yönlendirileceksiniz"
                      : "Siparişiniz yöneticinizin onayına gönderilecektir"}
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full"
                    icon={<FileText size={14} />}
                    onClick={handleCreateRfq}
                    disabled={submitting}
                  >
                    Teklif Talebi Oluştur
                  </Button>
                  <Link href="/products">
                    <Button variant="outline" size="md" className="w-full">Ürünlere Dön</Button>
                  </Link>
                </div>

                <div className="flex items-center gap-2 text-xs text-white/30">
                  <AlertTriangle size={12} />
                  Fiyatlar sipariş anındaki bayi fiyatıdır
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
