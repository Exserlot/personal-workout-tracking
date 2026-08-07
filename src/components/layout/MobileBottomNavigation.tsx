import { NavLink } from "react-router-dom";
import { Icon } from "../icons/Icon";
import { cn } from "../../lib/cn";

const items = [
  { label: "วันนี้", to: "/today", icon: "today" as const },
  { label: "แผน", to: "/plans", icon: "plans" as const },
  { label: "เริ่ม", to: "/workout/active", icon: "start" as const, start: true },
  { label: "ประวัติ", to: "/history", icon: "history" as const },
  { label: "สถิติ", to: "/progress", icon: "progress" as const },
];

export function MobileBottomNavigation() {
  return (
    <nav
      aria-label="เมนูมือถือ"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid min-h-[72px] grid-cols-5 border-t border-line bg-recessed px-1 tablet:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-semibold",
              isActive ? "text-ink" : "text-ink-muted",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-7 w-9 items-center justify-center rounded-xs border",
                  item.start
                    ? "h-11 w-11 border-accent-action bg-accent-action text-white"
                    : isActive
                      ? "border-line-strong bg-interactive text-ink"
                      : "border-transparent",
                )}
              >
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <span className={cn("truncate", item.start && "text-ink")}>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
