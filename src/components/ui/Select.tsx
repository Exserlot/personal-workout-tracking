import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Icon } from "../icons/Icon";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, helperText, error, id, "aria-describedby": describedBy, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const description = [describedBy, helperText || error ? messageId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0">
      <label htmlFor={selectId} className="mb-2 block text-[13px] font-semibold tracking-[0.02em] text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={description || undefined}
          className={cn(
            "min-h-12 w-full min-w-0 appearance-none rounded-xs border border-line bg-surface px-3 pr-10 text-base text-ink hover:border-line-strong focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-11",
            error && "border-error",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted">
          <Icon name="chevron-down" className="h-4 w-4" />
        </span>
      </div>
      {error || helperText ? (
        <p id={messageId} className={cn("mt-2 text-sm", error ? "text-error" : "text-ink-muted")}>
          {error ?? helperText}
        </p>
      ) : null}
    </div>
  );
});
