import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { Icon } from "../icons/Icon";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
  unit?: string;
  clearButtonLabel?: string;
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, helperText, error, unit, clearButtonLabel, onClear, id, "aria-describedby": describedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const description = [describedBy, helperText || error ? messageId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="mb-2 block text-[13px] font-semibold tracking-[0.02em] text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={description || undefined}
          className={cn(
            "min-h-12 w-full min-w-0 rounded-xs border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted hover:border-line-strong focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-11",
            unit && "pr-14 tabular-nums",
            onClear && "pr-12",
            error && "border-error",
            className,
          )}
          {...props}
        />
        {onClear ? (
          <button
            type="button"
            aria-label={clearButtonLabel ?? `ล้างค่า${label}`}
            className="absolute inset-y-1 right-1 flex h-10 w-10 items-center justify-center rounded-xs text-ink-muted hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            onClick={onClear}
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        ) : null}
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
            {unit}
          </span>
        ) : null}
      </div>
      {error || helperText ? (
        <p id={messageId} className={cn("mt-2 text-sm", error ? "text-error" : "text-ink-muted")}>
          {error ?? helperText}
        </p>
      ) : null}
    </div>
  );
});
