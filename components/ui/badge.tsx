import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses = {
    default: "border-transparent bg-neutral-900 text-neutral-50 shadow dark:bg-neutral-50 dark:text-neutral-900",
    secondary: "border-transparent bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50",
    destructive: "border-transparent bg-red-600 text-neutral-50 shadow dark:bg-red-900 dark:text-neutral-50",
    outline: "text-neutral-950 dark:text-neutral-50 border-neutral-200 dark:border-neutral-800",
    success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 dark:focus:ring-neutral-300 dark:focus:ring-offset-neutral-950",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
