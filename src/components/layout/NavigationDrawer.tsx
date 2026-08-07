import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { primaryNavigation, utilityNavigation } from "../../app/navigation";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { Icon } from "../icons/Icon";

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function NavigationDrawer({ open, onClose, triggerRef }: NavigationDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  const items = [...primaryNavigation, ...utilityNavigation];

  function closeAndRestoreFocus() {
    onClose();
    triggerRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 desktop:hidden">
      <button
        type="button"
        aria-label="ปิดเมนู"
        className="absolute inset-0 bg-black/70"
        onClick={closeAndRestoreFocus}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="เมนูทั้งหมด"
        className="absolute inset-y-0 left-0 w-[min(88vw,360px)] border-r border-line bg-recessed shadow-overlay"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4 tablet:px-6">
          <div>
            <p className="font-bold tracking-[-0.02em]">FORM</p>
            <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted">TRAINING SYSTEM</p>
          </div>
          <Button ref={closeRef} variant="quiet" className="h-11 w-11 px-0" onClick={closeAndRestoreFocus} aria-label="ปิดเมนู">
            <Icon name="close" />
          </Button>
        </div>
        <nav aria-label="เมนูทั้งหมด" className="py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "grid min-h-12 grid-cols-[2rem_1.5rem_minmax(0,1fr)] items-center gap-3 border-l-2 px-5 text-sm font-semibold",
                  isActive
                    ? "border-accent bg-interactive text-ink"
                    : "border-transparent text-ink-secondary hover:bg-surface hover:text-ink",
                )
              }
            >
              <span className="text-[11px] tabular-nums text-ink-muted">{item.index}</span>
              <Icon name={item.icon} className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  );
}
