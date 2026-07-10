"use client"

import { motion } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "rgba(23, 23, 23, 0.95)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    fontSize: "13px",
    color: "#fff",
  },
  labelStyle: { color: "#B5B5B5", fontSize: "11px" },
}

export function SalesChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Aylık Satışlar</CardTitle>
        <div className="flex items-center gap-2 text-xs text-success">
          <TrendingUp size={14} />
          <span>%12.5 artış</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#39FF14" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#39FF14" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#39FF14" strokeWidth={2} fill="url(#salesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function OrdersChart({ data }: { data: { name: string; orders: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Siparişler</CardTitle>
        <div className="flex items-center gap-2 text-xs text-danger">
          <TrendingDown size={14} />
          <span>%3.2 düşüş</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="orders" fill="#39FF14" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

const COLORS = ["#39FF14", "#00E5FF", "#FFC107", "#FF5252", "#B5B5B5"]

export function CategoryChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategori Dağılımı</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs text-white/50">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />
              {item.name}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function CreditGauge({ used, limit }: { used: number; limit: number }) {
  const percentage = (used / limit) * 100
  const isWarning = percentage > 80

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kredi Limiti</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-white">₺{used.toLocaleString("tr-TR")}</p>
              <p className="text-xs text-white/40">/ ₺{limit.toLocaleString("tr-TR")} limit</p>
            </div>
            <div className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              isWarning ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
            )}>
              %{percentage.toFixed(0)} kullanıldı
            </div>
          </div>
          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "absolute left-0 top-0 h-full rounded-full",
                isWarning ? "bg-warning" : "bg-accent"
              )}
              initial={{ width: 0 }}
              whileInView={{ width: `${percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/30">
            <span>Kalan: ₺{(limit - used).toLocaleString("tr-TR")}</span>
            <span>Toplam {limit.toLocaleString("tr-TR")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TopProductsTable({ products }: { products: { id: string; name: string; quantity: number; revenue: number }[] }) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>En Çok Satan Ürünler</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/30 pb-3">Ürün</th>
                <th className="text-right text-xs font-medium text-white/30 pb-3">Adet</th>
                <th className="text-right text-xs font-medium text-white/30 pb-3">Gelir</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, i) => (
                <motion.tr
                  key={product.id}
                  className="border-b border-white/[0.02]"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/20 w-5">{i + 1}</span>
                      <span className="text-sm text-white/80">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm text-white/60">{product.quantity.toLocaleString("tr-TR")}</td>
                  <td className="py-3 text-right text-sm text-white font-medium">
                    ₺{product.revenue.toLocaleString("tr-TR")}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
