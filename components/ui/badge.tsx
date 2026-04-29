import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "border-transparent bg-text text-bg shadow-token-sm",
    secondary: "border-transparent bg-surface-2 text-text",
    destructive: "border-transparent bg-danger text-white shadow-token-sm",
    outline: "text-text border-border",
    success: "border-transparent bg-positive-soft text-positive",
    warning: "border-transparent bg-warning-soft text-warning",
    info: "border-transparent bg-accent-soft text-accent",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-text focus:ring-offset-2 focus:ring-offset-bg",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
