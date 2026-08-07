import { NavLink } from "react-router-dom";
import { primaryNavigation, utilityNavigation } from "../../app/navigation";
import { cn } from "../../lib/cn";

function RailLink({ index, label, to }: { index: string; label: string; to: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group relative grid min-h-12 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 border-l-2 px-3 text-sm transition-colors wide:px-5",
          isActive
            ? "border-accent bg-interactive text-ink"
            : "border-transparent text-ink-muted hover:bg-surface hover:text-ink",
        )
      }
    >
      <span className="text-[11px] tabular-nums text-ink-muted">{index}</span>
      <span className="hidden truncate font-semibold wide:block">{label}</span>
    </NavLink>
  );
}

export function DesktopNavigation() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-line bg-recessed desktop:flex wide:w-[216px]">
      <div className="flex h-24 items-center border-b border-line px-4 wide:px-6">
        <div>
          <p className="text-xl font-bold tracking-[-0.03em]">FORM</p>
          <p className="mt-1 hidden text-[10px] font-semibold tracking-[0.08em] text-ink-muted wide:block">
            TRAINING SYSTEM
          </p>
        </div>
      </div>
      <nav aria-label="เมนูหลัก" className="flex-1 py-6">
        {primaryNavigation.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
      </nav>
      <div className="border-t border-line py-4">
        {utilityNavigation.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
        <div className="mx-4 mt-4 hidden border-t border-line-subtle pt-4 wide:block">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            STATIC PREVIEW
          </p>
        </div>
      </div>
    </aside>
  );
}
