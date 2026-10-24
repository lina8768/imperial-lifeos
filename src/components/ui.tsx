import { type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============ Button ============ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-teal text-white hover:bg-teal-deep border-transparent",
  secondary: "bg-white text-ink border-line hover:border-ink-faint",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-paper hover:text-ink",
  danger: "bg-white text-vermilion border-vermilion/40 hover:bg-vermilion hover:text-white",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermilion/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

/* ============ Badge ============ */

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "vermilion" | "jade" | "gold" | "danger" | "gray" | "teal"; className?: string }) {
  const tones = {
    neutral: "bg-paper text-ink-soft border-line",
    teal: "bg-teal-soft text-teal-deep border-teal/20",
    vermilion: "bg-vermilion-soft text-vermilion-deep border-vermilion/20",
    jade: "bg-jade-soft text-jade-deep border-jade/30",
    gold: "bg-gold-soft text-gold-deep border-gold/40",
    danger: "bg-vermilion-soft text-danger border-danger/25",
    gray: "bg-paper text-ink-faint border-line",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4", tones[tone], className)}>
      {children}
    </span>
  );
}

/* ============ 表单基础 ============ */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("field", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("field min-h-24 resize-y", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn("field cursor-pointer", className)} {...props} />
  )
);
Select.displayName = "Select";

/* ============ 页面头 ============ */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-wide">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ============ 空状态 ============ */

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper font-serif text-ink-faint">
        空
      </div>
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-faint">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ============ 进度条 ============ */

export function ProgressBar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div className="h-full rounded-full bg-jade transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
