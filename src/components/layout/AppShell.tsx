import { useCallback, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DesktopNavigation } from "./DesktopNavigation";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { NavigationDrawer } from "./NavigationDrawer";
import { Button } from "../ui/Button";
import { Icon } from "../icons/Icon";
import { cn } from "../../lib/cn";

function CompactHeader({ onMenu, menuRef }: { onMenu: () => void; menuRef: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-recessed px-4 tablet:px-6 desktop:hidden">
      <div>
        <p className="text-sm font-bold tracking-[-0.02em]">FORM</p>
        <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted">PERSONAL TRAINING</p>
      </div>
      <Button ref={menuRef} variant="quiet" className="h-11 w-11 px-0" onClick={onMenu} aria-label="เปิดเมนู">
        <Icon name="menu" />
      </Button>
    </header>
  );
}

export function AppShell() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const isMobileFocusMode = location.pathname === "/workout/active";

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <DesktopNavigation />
      <div className={cn(isMobileFocusMode && "hidden tablet:block")}>
        <CompactHeader onMenu={() => setDrawerOpen(true)} menuRef={menuRef} />
      </div>
      <NavigationDrawer open={drawerOpen} onClose={closeDrawer} triggerRef={menuRef} />

      <main
        id="main-content"
        className={cn(
          "min-h-dvh min-w-0 desktop:pl-[var(--shell-desktop-rail)]",
          isMobileFocusMode
            ? "pb-0 pt-0 tablet:pt-16 desktop:pt-0"
            : "pb-[calc(var(--shell-mobile-nav)+24px+env(safe-area-inset-bottom))] pt-16 tablet:pb-10 desktop:pb-12 desktop:pt-0",
        )}
      >
        <Outlet />
      </main>

      {!isMobileFocusMode ? <MobileBottomNavigation /> : null}
    </div>
  );
}
