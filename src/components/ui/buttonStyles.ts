import { cn } from "../../lib/cn";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "quiet"
  | "destructive";

export type ButtonSize = "compact" | "default" | "large";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-action-primary bg-action-primary text-action-primary-ink hover:border-white hover:bg-white",
  accent:
    "border-accent-action bg-accent-action text-white hover:border-accent hover:bg-accent",
  secondary:
    "border-line bg-transparent text-ink hover:border-line-strong hover:bg-interactive",
  quiet:
    "border-transparent bg-transparent text-ink-secondary hover:bg-interactive hover:text-ink",
  destructive:
    "border-error bg-transparent text-error hover:bg-accent-pressed hover:text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  compact: "min-h-11 px-3 text-sm desktop:min-h-9",
  default: "min-h-11 px-4 text-sm",
  large: "min-h-12 px-5 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "default",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex min-w-0 items-center justify-center gap-2 rounded-xs border font-semibold leading-5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-line-subtle disabled:bg-transparent disabled:text-ink-disabled",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}
