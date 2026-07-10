"use client"

import { useRef, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  format?: boolean
  className?: string
}

export function AnimatedCounter({ value, duration = 2, prefix, suffix, format = true, className }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          const startTime = Date.now()
          const startValue = 0

          const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000
            const progress = Math.min(elapsed / duration, 1)
            const easeOut = 1 - Math.pow(1 - progress, 3)
            const current = Math.floor(startValue + (value - startValue) * easeOut)
            setDisplayValue(current)
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, duration, hasAnimated])

  const formattedValue = format
    ? new Intl.NumberFormat("tr-TR").format(displayValue)
    : displayValue.toString()

  return (
    <motion.div
      ref={ref}
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {prefix}{formattedValue}{suffix}
    </motion.div>
  )
}

export function StatCard({
  label,
  value,
  change,
  icon,
  trend,
  formatValue,
  prefix,
  suffix,
}: {
  label: string
  value: number
  change?: number
  icon: React.ReactNode
  trend?: "up" | "down"
  formatValue?: boolean
  prefix?: string
  suffix?: string
}) {
  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div
        className="relative rounded-2xl p-5 overflow-hidden"
        style={{
          backgroundColor: "rgba(23, 23, 23, 0.8)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</span>
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">
            {prefix}
            <AnimatedCounter value={value} format={formatValue} />
            {suffix}
          </span>
          {change !== undefined && (
            <span className={cn(
              "text-xs font-medium mb-1",
              (trend === "up" || (!trend && change >= 0)) ? "text-success" : "text-danger"
            )}>
              {change >= 0 ? "+" : ""}{change}%
            </span>
          )}
        </div>
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(57, 255, 20, 0.03), transparent 40%)",
          }}
        />
      </div>
    </motion.div>
  )
}
