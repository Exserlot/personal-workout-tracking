import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, helperText, error, id, "aria-describedby": describedBy, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  const description = [describedBy, helperText || error ? messageId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-w-0">
      <label htmlFor={textareaId} className="mb-2 block text-[13px] font-semibold tracking-[0.02em] text-ink-secondary">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={description || undefined}
        className={cn(
          "min-h-32 w-full min-w-0 resize-y rounded-xs border border-line bg-surface px-3 py-3 text-base leading-6 text-ink placeholder:text-ink-muted hover:border-line-strong focus-visible:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
          error && "border-error",
          className,
        )}
        {...props}
      />
      {error || helperText ? (
        <p id={messageId} className={cn("mt-2 text-sm", error ? "text-error" : "text-ink-muted")}>
          {error ?? helperText}
        </p>
      ) : null}
    </div>
  );
});
