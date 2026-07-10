"use client"

import { cn } from "@/lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "success" | "warning" | "danger" | "info" | "premium"
  size?: "sm" | "md" | "lg"
  className?: string
  pulsing?: boolean
}

const variantStyles = {
  default: "bg-white/5 text-white/70 border-white/10",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-info/10 text-info border-info/20",
  premium: "bg-accent/10 text-accent border-accent/20",
}

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
}

export function Badge({ children, variant = "default", size = "md", className, pulsing }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border",
        variantStyles[variant],
        sizes[size],
        pulsing && "relative",
        className
      )}
    >
      {pulsing && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            variant === "success" ? "bg-success" : variant === "danger" ? "bg-danger" : variant === "warning" ? "bg-warning" : "bg-accent"
          )} />
          <span className={cn(
            "relative inline-flex rounded-full h-1.5 w-1.5",
            variant === "success" ? "bg-success" : variant === "danger" ? "bg-danger" : variant === "warning" ? "bg-warning" : "bg-accent"
          )} />
        </span>
      )}
      {children}
    </span>
  )
}
