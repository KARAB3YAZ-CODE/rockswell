"use client"

import { useState, use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard } from "@/components/effects/glass-card"
import { useProduct, useProducts, useDiscountRate } from "@/hooks/use-data"
import { useCartStore, useCompareStore } from "@/lib/store"
import { dealerPriceDisplay, TAX_RATE } from "@/lib/pricing"
import { formatPrice } from "@/lib/utils"
import {
  Package, ChevronLeft, Share2, ShoppingCart,
  Truck, Shield, Clock, FileText, Download,
  CheckCircle, AlertTriangle, Minus, Plus, Star,
  Building2, GitCompare,
} from "lucide-react"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { product, loading } = useProduct(id)
  const { products } = useProducts()
  const { discountRate: companyRate } = useDiscountRate()
  const addItem = useCartStore((s) => s.addItem)
  const compareItems = useCompareStore((s) => s.items)
  const addCompare = useCompareStore((s) => s.addItem)
  const removeCompare = useCompareStore((s) => s.removeItem)
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState<"info" | "specs" | "vehicles" | "docs">("info")
  const [orderNote, setOrderNote] = useState("")

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6">
          <Skeleton variant="text" className="w-32" />
          <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton variant="rectangular" height={500} />
            <div className="space-y-4">
              <Skeleton variant="text" className="w-3/4 h-8" />
              <Skeleton variant="text" className="w-full h-20" />
              <Skeleton variant="rectangular" height={200} />
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  if (!product) notFound()

  const totalStock = product.stock.reduce((acc, s) => acc + s.available, 0)
  const isInStock = totalStock > 0
  const { listPrice, dealerPrice, discountRate } = dealerPriceDisplay(
    product.basePrice,
    companyRate,
    product.customerPriceApplied
  )
  const kdvAmount = dealerPrice * TAX_RATE

  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4)

  const tabs = [
    { key: "info" as const, label: "Ürün Bilgisi" },
    { key: "specs" as const, label: "Teknik Özellikler" },
    { key: "vehicles" as const, label: "Uyumlu Araçlar" },
    { key: "docs" as const, label: "Dökümanlar" },
  ]

  return (
    <Shell>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/products" className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
            <ChevronLeft size={14} />
            Ürünler
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/60">{product.category}</span>
          <span className="text-white/20">/</span>
          <span className="text-white/80">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-2xl bg-card border border-border overflow-hidden group">
              <div className="w-full h-full bg-contain bg-center bg-no-repeat p-8" style={{ backgroundImage: `url(${product.images[selectedImage]})` }} />
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge variant="premium">{product.brand}</Badge>
                {product.isFeatured && <Badge variant="premium"><Star size={10} /> Öne Çıkan</Badge>}
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => {
                    if (compareItems.includes(product.id)) {
                      removeCompare(product.id)
                      toast.success("Karşılaştırmadan çıkarıldı")
                    } else if (compareItems.length >= 4) {
                      toast.error("En fazla 4 ürün karşılaştırabilirsiniz")
                    } else {
                      addCompare(product.id)
                      toast.success("Karşılaştırmaya eklendi")
                    }
                  }}
                  className={`w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors ${
                    compareItems.includes(product.id) ? "text-accent" : "text-white/50 hover:text-white"
                  }`}
                  title="Karşılaştır"
                >
                  <GitCompare size={16} />
                </button>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link kopyalandı") }} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/50 hover:text-white transition-colors">
                  <Share2 size={16} />
                </button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {product.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === selectedImage ? "bg-accent w-6" : "bg-white/20 hover:bg-white/40"}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-16 h-16 rounded-xl border overflow-hidden shrink-0 transition-all bg-cover bg-center ${
                    i === selectedImage ? "border-accent/50 bg-accent/5 ring-1 ring-accent/30" : "border-white/10 bg-card hover:border-white/20"
                  }`}
                  style={{ backgroundImage: `url(${url})` }}
                />
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-white/30 font-mono">{product.sku}</span>
                {product.oemNumbers.map((oem) => (
                  <Badge key={oem} size="sm" variant="default">OEM: {oem}</Badge>
                ))}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">{product.name}</h1>
              <p className="mt-3 text-sm text-white/50 leading-relaxed">{product.description}</p>
            </div>

            {/* Pricing Breakdown */}
            <GlassCard intensity="light" className="p-5">
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Bayi Fiyatı (KDV Hariç)</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold text-white">{formatPrice(dealerPrice)}</span>
                      <span className="text-sm text-white/30 line-through">{formatPrice(listPrice)}</span>
                      <Badge variant="success" size="sm">%{discountRate} İskonto</Badge>
                    </div>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">Liste Fiyatı</span>
                    <span className="text-white/60 line-through">{formatPrice(listPrice)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">Bayi Fiyatı</span>
                    <span className="text-white font-medium">{formatPrice(dealerPrice)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">Firma İskontosu</span>
                    <span className="text-success font-medium">%{discountRate}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">KDV (%{TAX_RATE * 100})</span>
                    <span className="text-white/70">{formatPrice(kdvAmount)}</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Quantity & Add to Cart */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(product.minOrderQuantity, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-14 text-center text-sm font-medium text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.maxOrderQuantity, quantity + 1))}
                    className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <Button
                  size="lg"
                  icon={<ShoppingCart size={18} />}
                  onClick={() => {
                    addItem({
                      productId: product.id,
                      productName: product.name,
                      sku: product.sku,
                      brand: product.brand,
                      image: product.images[0] || "",
                      quantity,
                      unitPrice: product.basePrice,
                      totalPrice: product.basePrice * quantity,
                      warehouseId: product.stock[0]?.warehouseId || "",
                      minOrderQuantity: product.minOrderQuantity,
                      priceLocked: product.customerPriceApplied,
                      category: product.category,
                      vehicleBrands: product.compatibleVehicles.map((v) => v.brand),
                    })
                    toast.success(`${product.name} sepete eklendi`)
                  }}
                  className="flex-1"
                >
                  Sepete Ekle
                </Button>
              </div>
              <p className="text-xs text-white/40">
                {product.customerPriceApplied
                  ? "Özel müşteri fiyatınız uygulanmıştır."
                  : `Sepette firma iskontonuz (%${discountRate}) uygulanır. Bayi birim: ${formatPrice(dealerPrice)}`}
              </p>
            </div>

            {/* Sipariş Notu */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Sipariş Notu</label>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Siparişinizle ilgili not ekleyin..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 resize-none"
              />
            </div>

            {/* Stock & Delivery Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: isInStock ? CheckCircle : AlertTriangle, label: "Stok Durumu", value: isInStock ? `${totalStock} adet` : "Stokta Yok", color: isInStock ? "text-success" : "text-danger" },
                { icon: Truck, label: "Tahmini Teslimat", value: "Aynı Gün Kargo", color: "text-info" },
                { icon: Shield, label: "Garanti", value: "2 Yıl", color: "text-accent" },
                { icon: Clock, label: "İade", value: "30 Gün", color: "text-warning" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                  <item.icon size={16} className={`mx-auto mb-1 ${item.color}`} />
                  <p className="text-[10px] text-white/30">{item.label}</p>
                  <p className="text-xs font-medium text-white mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Warehouse Stock */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white/70">Depo Stok Durumu</h4>
              {product.stock.map((s) => (
                <div key={s.warehouseId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-white/30" />
                    <span className="text-sm text-white/70">{s.warehouseName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/30">Raf: {s.location}</span>
                    <span className="text-sm font-medium text-white">{s.available} adet</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
                  activeTab === tab.key
                    ? "text-accent border-accent"
                    : "text-white/40 hover:text-white/70 border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent>
            {activeTab === "info" && (
              <div className="space-y-4">
                <p className="text-sm text-white/60 leading-relaxed">{product.description}</p>
                <div className="grid sm:grid-cols-2 gap-4 mt-6">
                  {[
                    { label: "Marka", value: product.brand },
                    { label: "Kategori", value: product.category },
                    { label: "Alt Kategori", value: product.subcategory },
                    { label: "Birim", value: product.unit },
                    { label: "Min. Sipariş", value: `${product.minOrderQuantity} adet` },
                    { label: "Maks. Sipariş", value: `${product.maxOrderQuantity} adet` },
                    ...product.oemNumbers.map((oem, i) => ({
                      label: i === 0 ? "OEM Numaraları" : "",
                      value: oem,
                    })),
                  ].map((item, i) =>
                    item.label ? (
                      <div key={i} className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-sm text-white/40">{item.label}</span>
                        <span className="text-sm text-white">{item.value}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}
            {activeTab === "specs" && (
              <div className="space-y-3">
                {product.specifications.map((spec) => (
                  <div key={spec.name} className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-white/40">{spec.name}</span>
                    <span className="text-sm text-white">{spec.value}{spec.unit && ` ${spec.unit}`}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "vehicles" && (
              <div className="space-y-3">
                {product.compatibleVehicles.length > 0 ? product.compatibleVehicles.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{v.brand} {v.model}</span>
                      {v.engine && <span className="text-xs text-white/30">{v.engine}</span>}
                    </div>
                    {(v.yearStart || v.yearEnd) && (
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        {v.yearStart ? <span>{v.yearStart}{v.yearEnd ? `-${v.yearEnd}` : "+"}</span> : v.yearEnd ? <span>≤{v.yearEnd}</span> : null}
                        {v.fuel && <span>{v.fuel}</span>}
                        {v.transmission && <span>{v.transmission}</span>}
                      </div>
                    )}
                  </div>
                )) : (
                  <p className="text-sm text-white/30 py-4 text-center">Bu ürün için uyumlu araç bilgisi bulunmamaktadır.</p>
                )}
              </div>
            )}
            {activeTab === "docs" && (
              <div className="space-y-3">
                {product.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-accent" />
                      <span className="text-sm text-white/70">{doc.name}</span>
                      <span className="text-xs text-white/30">{(doc.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => {
                      if (!doc.url) {
                        toast.error("Dosya bağlantısı yok")
                        return
                      }
                      window.open(doc.url, "_blank", "noopener,noreferrer")
                    }} />
                  </div>
                ))}
                {product.documents.length === 0 && (
                  <p className="text-sm text-white/30 py-4 text-center">Bu ürün için döküman bulunmuyor.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Related Products */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Alternatif Ürünler</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`}>
                <Card hover className="group">
                  <div
                    className="aspect-square mb-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center bg-contain bg-center bg-no-repeat p-4"
                    style={p.images[0] ? { backgroundImage: `url(${p.images[0]})` } : undefined}
                  >
                    {!p.images[0] && <Package size={32} className="text-white/10 group-hover:text-white/20 transition-colors" />}
                  </div>
                  <Badge variant="premium" size="sm">{p.brand}</Badge>
                  <h3 className="text-sm font-medium text-white mt-1 line-clamp-2">{p.name}</h3>
                  <p className="text-sm font-bold text-white mt-2">{formatPrice(p.basePrice)}</p>
                  {p.oemNumbers.length > 0 && (
                    <p className="text-[10px] text-white/20 font-mono mt-1 truncate">OEM: {p.oemNumbers[0]}</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  )
}
