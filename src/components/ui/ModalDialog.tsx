import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { cn } from "../../lib/cn";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface ModalDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  triggerRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  labelledBy?: string;
  describedBy?: string;
  role?: "dialog" | "alertdialog";
  variant?: "center" | "sheet" | "drawer";
  closeOnBackdrop?: boolean;
  className?: string;
  titleClassName?: string;
}

/** Shared overlay behavior for dialogs, sheets and drawers. */
export function ModalDialog({
  open,
  title,
  description,
  onClose,
  children,
  triggerRef,
  initialFocusRef,
  labelledBy,
  describedBy,
  role = "dialog",
  variant = "center",
  closeOnBackdrop = true,
  className,
  titleClassName,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const generatedId = useId();
  const titleId = labelledBy ?? `${generatedId}-title`;
  const descriptionId = describedBy ?? (description ? `${generatedId}-description` : undefined);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreTarget = triggerRef?.current ?? previousFocus;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = initialFocusRef?.current ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    const focusTimer = window.setTimeout(() => focusTarget?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-dialog]"));
      if (openDialogs.at(-1) !== dialogRef.current) return;
      if (event.key === "Escape") {
        const nestedDialog = dialogRef.current?.querySelector<HTMLElement>(
          "[role='dialog'], [role='alertdialog']",
        );
        if (nestedDialog) return;
        if (event.target instanceof Element && event.target.closest("[data-escape-boundary='true']")) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => restoreTarget?.focus(), 0);
    };
  }, [initialFocusRef, open, triggerRef]);

  if (!open) return null;
  const overlayLayout = variant === "sheet"
    ? "items-end p-0 tablet:items-center tablet:justify-center tablet:p-6"
    : variant === "drawer"
      ? "items-stretch justify-start p-0"
      : "items-center justify-center p-4 tablet:p-6";
  const panelWidth = variant === "drawer" ? "w-[min(88vw,360px)]" : "w-full max-w-lg";
  const panelHeight = variant === "drawer"
    ? "h-full max-h-none"
    : variant === "sheet"
      ? "max-h-[100dvh] tablet:max-h-[92dvh]"
      : "max-h-[calc(100dvh-2rem)] tablet:max-h-[92dvh]";
  const panelLayout = variant === "center" ? "overflow-y-auto p-6" : undefined;
  return (
    <div
      className={cn("fixed inset-0 z-[60] flex bg-black/70", overlayLayout)}
      role="presentation"
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        data-modal-dialog
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn("safe-bottom border border-line bg-surface shadow-none", panelWidth, panelHeight, panelLayout, className)}
      >
        <h2 id={titleId} className={cn("text-h2 text-ink", titleClassName)}>{title}</h2>
        {description ? <p id={descriptionId} className="mt-3 text-sm leading-6 text-ink-secondary">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
