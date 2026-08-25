import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { DesktopNavigation } from "./DesktopNavigation";
import { MobileBottomNavigation } from "./MobileBottomNavigation";
import { NavigationDrawer } from "./NavigationDrawer";
import { Button } from "../ui/Button";
import { Icon } from "../icons/Icon";
import { cn } from "../../lib/cn";
import { useRoutineTrackingRepository } from "../../features/routine-tracking/RoutineTrackingRepositoryContext";

function SkipLink() {
  return <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); const focusMain = () => { const main = document.getElementById("main-content"); main?.focus(); main?.scrollIntoView({ block: "start" }); }; focusMain(); window.setTimeout(focusMain, 0); }}>ข้ามไปยังเนื้อหาหลัก</a>;
}

function CompactHeader({ onMenu, menuRef, unreadCount }: { onMenu: () => void; menuRef: React.RefObject<HTMLButtonElement | null>; unreadCount: number }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-recessed px-4 tablet:px-6 desktop:hidden">
      <div>
        <p className="text-sm font-bold tracking-[-0.02em]">FORM</p>
        <p className="text-[10px] font-semibold tracking-[0.08em] text-ink-muted">PERSONAL TRAINING</p>
      </div>
      <div className="flex items-center gap-1">
        <Link to="/notifications" className="relative grid h-11 w-11 place-items-center" aria-label={`การแจ้งเตือน${unreadCount ? ` ยังไม่ได้อ่าน ${unreadCount} รายการ` : ""}`}><Icon name="notifications" />{unreadCount ? <span className="absolute right-0 top-0 min-w-5 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-5 text-canvas">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Link>
        <Button ref={menuRef} variant="quiet" className="h-11 w-11 px-0" onClick={onMenu} aria-label="เปิดเมนู"><Icon name="menu" /></Button>
      </div>
    </header>
  );
}

export function AppShell() {
  const location = useLocation();
  const routineTrackingRepository = useRoutineTrackingRepository();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const isMobileFocusMode = location.pathname === "/workout/active";
  useEffect(() => {
    let active = true;
    routineTrackingRepository.listNotifications().then((items) => { if (active) setUnreadCount(items.filter((item) => !item.readAt).length); }).catch(() => undefined);
    return () => { active = false; };
  }, [location.pathname, routineTrackingRepository]);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SkipLink />
      <DesktopNavigation unreadCount={unreadCount} />
      <div className={cn(isMobileFocusMode && "hidden tablet:block")}>
        <CompactHeader onMenu={() => setDrawerOpen(true)} menuRef={menuRef} unreadCount={unreadCount} />
      </div>
      <NavigationDrawer open={drawerOpen} onClose={closeDrawer} triggerRef={menuRef} />

      <main
        id="main-content"
        tabIndex={-1}
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
