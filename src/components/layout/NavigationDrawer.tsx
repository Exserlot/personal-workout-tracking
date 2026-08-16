import { NavLink } from "react-router-dom";
import { primaryNavigation, utilityNavigation } from "../../app/navigation";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { Icon } from "../icons/Icon";
import { ModalDialog } from "../ui/ModalDialog";

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function NavigationDrawer({ open, onClose, triggerRef }: NavigationDrawerProps) {
  const items = [...primaryNavigation, ...utilityNavigation];
  return (
    <ModalDialog open={open} onClose={onClose} triggerRef={triggerRef} title="เมนูทั้งหมด" titleClassName="sr-only" variant="drawer" className="overflow-y-auto border-r border-line bg-recessed p-0 shadow-none desktop:hidden">
        <div className="flex h-16 items-center justify-between border-b border-line px-4 tablet:px-6">
          <div>
            <p className="font-bold tracking-[-0.02em]">FORM</p>
            <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted">TRAINING SYSTEM</p>
          </div>
          <Button variant="quiet" className="h-12 w-12 !p-0" onClick={onClose} aria-label="ปิดเมนู">
            <Icon name="close" className="h-6 w-6 shrink-0" />
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
    </ModalDialog>
  );
}
