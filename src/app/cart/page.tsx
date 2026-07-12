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
import { formatPrice, formatIban } from "@/lib/utils"
import {
  computeCartPricingFromLines,
  DEFAULT_DISCOUNT_RATE,
  HAVALE_EXTRA_DISCOUNT_RATE,
  TAX_RATE,
  dealerUnitPrice,
} from "@/lib/pricing"
import { createOrder, getCampaigns, getCustomerDiscountRate, getMyCreditSnapshot, getProducts, getSiteSettings, type PaymentMethod } from "@/lib/api"
import { allocateWarehouses } from "@/lib/warehouse-alloc"
import type { StockInfo } from "@/lib/types"
import { cartLineKey } from "@/lib/cart-item"
import { useAuth } from "@/lib/auth"
import { canPlaceOrder } from "@/lib/permissions"
import { useData } from "@/hooks/use-data"
import {
  ShoppingCart, Trash2, Plus, Minus, Package,
  CreditCard, Truck, Building2, CheckCircle2,
  FileText, ShoppingBag, AlertCircle, Tag, Lock, Unlock, Wallet,
} from "lucide-react"

export default function CartPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const { items, updateQuantity, removeItem, clearCart, orderNote, setOrderNote, setItemWarehouse } = useCartStore()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online")
  const [submitting, setSubmitting] = useState(false)
  const canOrder = canPlaceOrder(user)

  const { data: fetchedRate } = useData(
    () => (isAuthenticated ? getCustomerDiscountRate() : Promise.resolve(DEFAULT_DISCOUNT_RATE)),
    [isAuthenticated]
  )
  const { data: campaigns } = useData(
    () => (isAuthenticated ? getCampaigns().catch(() => []) : Promise.resolve([])),
    [isAuthenticated]
  )
  const { data: credit } = useData(
    () => (isAuthenticated ? getMyCreditSnapshot() : Promise.resolve(null)),
    [isAuthenticated]
  )
  const { data: siteSettings } = useData(
    () => (isAuthenticated ? getSiteSettings().catch(() => null) : Promise.resolve(null)),
    [isAuthenticated]
  )

  const discountRate = fetchedRate ?? DEFAULT_DISCOUNT_RATE
  const volumeTiers = siteSettings?.volumeDiscountTiers
  const pricingLines = items.map((i) => ({
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    priceLocked: i.priceLocked,
    category: i.category,
    brand: i.brand,
    vehicleBrands: i.vehicleBrands,
  }))
  const {
    subtotal,
    discount,
    volumeDiscount,
    volumeBonusPercent,
    effectiveDiscountRate,
    volumeTier,
    campaignDiscount,
    campaignName,
    paymentDiscount,
    shipping,
    tax,
    total,
    paymentDiscountRate,
  } = computeCartPricingFromLines(
    pricingLines,
    discountRate,
    paymentMethod,
    campaigns ?? [],
    volumeTiers
  )

  const openAccountLimitBlocked =
    paymentMethod === "acik_hesap" &&
    !!credit &&
    (credit.creditLimit <= 0 || credit.creditUsed + total > credit.creditLimit + 0.009)

  const openAccountPeriodBlocked =
    paymentMethod === "acik_hesap" && !!credit?.openAccountBlocked

  const openAccountBlocked = openAccountLimitBlocked || openAccountPeriodBlocked

  const checkoutItems = async () => {
    const base = items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      brand: i.brand,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      warehouseId: i.warehouseId,
      priceLocked: i.priceLocked,
    }))
    try {
      const catalog = await getProducts()
      const stockByProduct = new Map<string, StockInfo[]>()
      for (const p of catalog) stockByProduct.set(p.id, p.stock)
      return allocateWarehouses(base, stockByProduct)
    } catch {
      return base
    }
  }

  const handleSubmitOrder = async () => {
    if (!isAuthenticated) {
      toast.error("Sipariş vermek için giriş yapın")
      router.push("/login")
      return
    }
    if (items.length === 0) return
    if (!canOrder) {
      toast.error("Sipariş oluşturma yetkiniz yok")
      return
    }
    if (openAccountPeriodBlocked) {
      toast.error(credit?.openAccountBlockReason || "Vadesi geçmiş açık hesap borcunuz var")
      return
    }
    if (openAccountLimitBlocked) {
      toast.error("Açık hesap limitiniz bu sipariş için yetersiz")
      return
    }

    setSubmitting(true)
    try {
      const allocated = await checkoutItems()
      const order = await createOrder({
        items: allocated,
        paymentMethod,
        notes: orderNote,
      })

      if (paymentMethod === "online") {
        clearCart()
        router.push(`/payment/${order.id}`)
      } else {
        clearCart()
        toast.success(
          paymentMethod === "acik_hesap"
            ? "Açık hesap siparişiniz onaya gönderildi"
            : "Havale siparişiniz onaya gönderildi"
        )
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
      const allocated = await checkoutItems()
      const order = await createOrder({
        items: allocated,
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
                {volumeBonusPercent > 0 ? ` + %${volumeBonusPercent} Hacim` : ""}
                {paymentMethod === "havale" ? ` + %${HAVALE_EXTRA_DISCOUNT_RATE} Havale/EFT İndirimi` : ""}
                {campaignDiscount > 0 && campaignName ? ` + kampanya` : ""}
                {" "}· efektif %{effectiveDiscountRate}
              </div>

              {/* Volume unlock ladder */}
              {volumeTier.tiers.length > 0 && (
                <GlassCard intensity="light" className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">Hacim İskonto Kilitleri</p>
                    <span className="text-[11px] text-white/40">
                      {volumeBonusPercent > 0
                        ? `Açık: +%${volumeBonusPercent}`
                        : "Henüz kilit açılmadı"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {volumeTier.tiers.map((tier) => {
                      const unlocked = subtotal >= tier.threshold
                      return (
                        <div
                          key={tier.threshold}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                            unlocked
                              ? "border-accent/30 bg-accent/5"
                              : "border-white/10 bg-white/[0.02]"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              unlocked ? "bg-accent/15 text-accent" : "bg-white/5 text-white/30"
                            }`}
                          >
                            {unlocked ? <Unlock size={14} /> : <Lock size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${unlocked ? "text-white" : "text-white/50"}`}>
                              +%{tier.bonusPercent} ekstra iskonto
                            </p>
                            <p className="text-[11px] text-white/35">
                              {formatPrice(tier.threshold)} ve üzeri siparişte
                            </p>
                          </div>
                          <span className={`text-[11px] font-medium ${unlocked ? "text-accent" : "text-white/30"}`}>
                            {unlocked ? "Açık" : "Kilitli"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {volumeTier.nextThreshold != null && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] text-white/40">
                        <span>
                          Sonraki kilit: +%{volumeTier.nextBonusPercent} ({formatPrice(volumeTier.nextThreshold)})
                        </span>
                        <span>{formatPrice(volumeTier.amountToNext)} kaldı</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${Math.round(volumeTier.progress * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </GlassCard>
              )}

              {items.map((item) => (
                <motion.div
                  key={cartLineKey(item.productId, item.warehouseId)}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <GlassCard intensity="light" className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={28} className="text-white/20" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="premium" size="sm">{item.brand}</Badge>
                          <span className="text-[10px] text-white/30 font-mono">{item.sku}</span>
                          {item.priceLocked && (
                            <Badge variant="success" size="sm">Özel fiyat</Badge>
                          )}
                        </div>
                        <Link href={`/products/${item.productId}`}>
                          <h3 className="text-sm font-medium text-white mt-0.5 hover:text-accent transition-colors line-clamp-2">{item.productName}</h3>
                        </Link>
                        <p className="text-xs text-white/40 mt-0.5">
                          {item.priceLocked || discountRate <= 0 ? (
                            <>{formatPrice(item.unitPrice)} / adet</>
                          ) : (
                            <>
                              <span className="text-white/70">
                                {formatPrice(dealerUnitPrice(item.unitPrice, discountRate, false))} / adet
                              </span>
                              <span className="ml-1.5 line-through opacity-50">{formatPrice(item.unitPrice)}</span>
                            </>
                          )}
                        </p>
                        {(item.warehouseOptions?.length ?? 0) > 0 ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Truck size={12} className="text-white/30 shrink-0" />
                            <select
                              value={item.warehouseId}
                              onChange={(e) => setItemWarehouse(item.productId, item.warehouseId, e.target.value)}
                              className="text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 max-w-full sm:max-w-[200px]"
                            >
                              {item.warehouseOptions!.map((w) => (
                                <option key={w.warehouseId} value={w.warehouseId} className="bg-card">
                                  {w.warehouseName} ({w.available})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : item.warehouseName ? (
                          <p className="text-[11px] text-white/35 mt-1 flex items-center gap-1">
                            <Truck size={11} /> {item.warehouseName}
                          </p>
                        ) : null}
                      </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-0 sm:pl-0">
                      <div className="text-left sm:text-right">
                        <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity - 1, item.warehouseId)}
                            className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 text-center text-xs font-medium text-white">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1, item.warehouseId)}
                            className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-white mt-2">
                          {formatPrice(
                            (item.priceLocked
                              ? item.unitPrice
                              : dealerUnitPrice(item.unitPrice, discountRate, false)) * item.quantity
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.warehouseId)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white/20 hover:text-danger hover:bg-danger/5 transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}

              <GlassCard intensity="light" className="p-4 space-y-3">
                <label className="text-sm font-medium text-white block">Ödeme Yöntemi</label>
                <div className="grid sm:grid-cols-3 gap-3">
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
                    <p className="text-xs text-white/40 mt-1">Kredi kartı · peşin (PayTR)</p>
                  </button>
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
                    <p className="text-xs text-white/40 mt-1">+%{HAVALE_EXTRA_DISCOUNT_RATE} ekstra indirim · kredi kullanmaz</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("acik_hesap")}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      paymentMethod === "acik_hesap"
                        ? "border-accent/50 bg-accent/5"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className={paymentMethod === "acik_hesap" ? "text-accent" : "text-white/40"} />
                      <span className="text-sm font-medium text-white">Açık Hesap</span>
                      {paymentMethod === "acik_hesap" && <CheckCircle2 size={14} className="text-accent ml-auto" />}
                    </div>
                    <p className="text-xs text-white/40 mt-1">Krediden düşer · vade ayın 15’i</p>
                  </button>
                </div>
              </GlassCard>

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

            <div className="lg:col-span-1">
              <GlassCard intensity="medium" className="p-5 space-y-4 sticky top-24">
                <h3 className="text-sm font-semibold text-white">Sipariş Özeti</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Ara Toplam</span>
                    <span className="text-white">{formatPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">Bayi İndirimi (%{discountRate})</span>
                      <span className="text-success">-{formatPrice(discount)}</span>
                    </div>
                  )}
                  {volumeDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40 flex items-center gap-1">
                        <Unlock size={12} />
                        Hacim İskontosu (+%{volumeBonusPercent})
                      </span>
                      <span className="text-success">-{formatPrice(volumeDiscount)}</span>
                    </div>
                  )}
                  {campaignDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40 flex items-center gap-1">
                        <Tag size={12} />
                        {campaignName ?? "Kampanya"}
                      </span>
                      <span className="text-success">-{formatPrice(campaignDiscount)}</span>
                    </div>
                  )}
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

                {isAuthenticated && credit && paymentMethod === "acik_hesap" && (
                  <div
                    className={`text-xs px-3 py-2.5 rounded-lg space-y-1 ${
                      openAccountBlocked
                        ? "bg-danger/10 text-danger border border-danger/20"
                        : "bg-white/[0.03] text-white/50 border border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Wallet size={12} />
                      Açık hesap
                    </div>
                    <p>
                      Limit {formatPrice(credit.creditLimit)} · kullanılan {formatPrice(credit.creditUsed)} · kalan{" "}
                      {formatPrice(credit.creditRemaining)}
                    </p>
                    <p className="text-white/40">Ödemeler her ayın 15’ine kadar yapılmalıdır.</p>
                    {openAccountPeriodBlocked && (
                      <p>{credit.openAccountBlockReason}</p>
                    )}
                    {openAccountLimitBlocked && !openAccountPeriodBlocked && (
                      <p>
                        {credit.creditLimit <= 0
                          ? "Açık hesap tanımlı değil — havale veya online ödeme seçin."
                          : `Bu sipariş (${formatPrice(total)}) kalan limiti aşıyor. Havale/online seçin veya limit artırımı isteyin.`}
                      </p>
                    )}
                  </div>
                )}

                {isAuthenticated && paymentMethod === "havale" && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 text-[11px] text-white/50">
                    <p className="text-white/70 font-medium">Havale / EFT bilgisi</p>
                    {siteSettings?.bankIban ? (
                      <>
                        {siteSettings.bankName && <p>Banka: {siteSettings.bankName}</p>}
                        {siteSettings.bankAccountName && <p>Hesap: {siteSettings.bankAccountName}</p>}
                        <p className="font-mono text-white/80 break-all">{formatIban(siteSettings.bankIban)}</p>
                        <p className="text-white/35">
                          Sipariş sonrası açıklamaya sipariş numaranızı yazın; dekontu sipariş sayfasından yükleyin.
                          +%{HAVALE_EXTRA_DISCOUNT_RATE} indirim uygulanır · kredi limiti kullanılmaz.
                        </p>
                      </>
                    ) : (
                      <p className="text-warning">
                        Havale hesabı henüz tanımlı değil. Online veya açık hesap seçin, ya da yöneticiye bildirin.
                      </p>
                    )}
                  </div>
                )}

                {isAuthenticated && paymentMethod === "online" && (
                  <p className="text-[11px] text-white/35 px-1">
                    Online ödeme kredi limitinizi kullanmaz; peşin tahsil edilir.
                  </p>
                )}

                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="w-full"
                    icon={<CreditCard size={16} />}
                    onClick={handleSubmitOrder}
                    disabled={
                      submitting ||
                      openAccountBlocked ||
                      !canOrder ||
                      (paymentMethod === "havale" && !siteSettings?.bankIban)
                    }
                  >
                    {submitting
                      ? "İşleniyor..."
                      : paymentMethod === "online"
                        ? "Ödemeye Geç"
                        : paymentMethod === "acik_hesap"
                          ? "Açık Hesap Siparişi Gönder"
                          : "Havale Siparişi Gönder"}
                  </Button>
                  <p className="text-xs text-center text-white/30">
                    {paymentMethod === "online"
                      ? "Güvenli ödeme sayfasına yönlendirileceksiniz"
                      : paymentMethod === "acik_hesap"
                        ? "Limitten düşülür · vade ayın 15’i · yönetici onayı"
                        : "Dekont ile ödeme · yönetici onayı"}
                  </p>
                  <Button
                    size="md"
                    variant="secondary"
                    className="w-full"
                    icon={<FileText size={14} />}
                    onClick={handleCreateRfq}
                    disabled={submitting}
                  >
                    Teklif İste
                  </Button>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
