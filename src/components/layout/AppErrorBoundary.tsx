import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useRouteError } from "react-router-dom";
import { telemetry } from "../../lib/telemetry/telemetry";
import { Button } from "../ui/Button";

interface AppErrorBoundaryState {
  failed: boolean;
}

function ApplicationErrorView() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 text-ink">
      <section className="w-full max-w-xl border-y border-line py-8" role="alert">
        <p className="text-xs font-semibold tracking-[0.08em] text-accent">APPLICATION ERROR</p>
        <h1 className="mt-3 text-h1 font-bold">แอปเกิดข้อผิดพลาดที่ไม่คาดคิด</h1>
        <p className="mt-3 text-ink-secondary">ข้อมูล Workout ที่บันทึกในเครื่องจะไม่ถูกลบ ลองโหลดแอปใหม่เพื่อทำงานต่อ</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>โหลดแอปใหม่</Button>
      </section>
    </main>
  );
}

export function RouterErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    telemetry.captureException(error, { boundary: "router" });
  }, [error]);

  return <ApplicationErrorView />;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    telemetry.captureException(error, { boundary: "root", componentStack: Boolean(info.componentStack) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ApplicationErrorView />;
  }
}
