import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { telemetry } from "../../lib/telemetry/telemetry";
import { Button } from "../ui/Button";
import { resolvePwaPromptState } from "./pwaUpdateState";

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      telemetry.captureException(error, { category: "pwa", operation: "register" });
    },
  });

  const promptState = resolvePwaPromptState(offlineReady, needRefresh);

  useEffect(() => {
    if (promptState !== "offline-ready") return undefined;

    const timeoutId = window.setTimeout(() => setOfflineReady(false), 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [promptState, setOfflineReady]);

  if (promptState === "hidden") return null;

  if (promptState === "offline-ready") {
    return (
      <aside
        className="pointer-events-none fixed inset-x-4 top-4 z-50 border border-line-strong bg-recessed p-3 tablet:inset-x-auto tablet:left-1/2 tablet:w-[360px] tablet:-translate-x-1/2"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold">FORM พร้อมใช้งานแบบ Offline</p>
      </aside>
    );
  }

  return (
    <aside
      className="fixed inset-x-4 bottom-[calc(var(--shell-mobile-nav)+16px+env(safe-area-inset-bottom))] z-50 border border-line-strong bg-recessed p-4 tablet:inset-x-auto tablet:bottom-6 tablet:right-6 tablet:w-[360px] desktop:bottom-8"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">มี FORM เวอร์ชันใหม่</p>
      <p className="mt-1 text-sm leading-6 text-ink-secondary">
        ระบบจะไม่โหลดหน้าใหม่เอง อัปเดตเมื่อคุณพร้อมและข้อมูลในเครื่องบันทึกเรียบร้อยแล้ว
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void updateServiceWorker(true)}>อัปเดตและโหลดใหม่</Button>
        <Button
          variant="quiet"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          ไว้ภายหลัง
        </Button>
      </div>
    </aside>
  );
}
