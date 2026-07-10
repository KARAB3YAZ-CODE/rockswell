"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, rightIcon, wrapperClassName, ...props }, ref) => {
    return (
      <div className={cn("space-y-1.5", wrapperClassName)}>
        {label && (
          <label className="block text-sm font-medium text-white/70">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">{icon}</div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white",
              "placeholder:text-white/30 text-sm",
              "focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10",
              "transition-all duration-200",
              icon && "pl-10",
              rightIcon && "pr-10",
              error && "border-danger/50 focus:border-danger/50 focus:ring-danger/10",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40">{rightIcon}</div>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"
