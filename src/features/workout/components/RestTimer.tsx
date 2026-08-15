import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import type { WorkoutTimerCache } from "../data/activeSessionCache";
import { formatTimer } from "../domain/workoutRules";

interface RestTimerProps {
  timer: WorkoutTimerCache;
  remainingSeconds: number;
  readOnly?: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function RestTimer({ timer, remainingSeconds, readOnly = false, onPause, onResume, onSkip, onReset }: RestTimerProps) {
  const running = timer.status === "running" && remainingSeconds > 0;
  const paused = timer.status === "paused" && remainingSeconds > 0;
  const [announcement, setAnnouncement] = useState("");
  const previousTimer = useRef({ status: timer.status, remainingSeconds });
  useEffect(() => {
    const previous = previousTimer.current;
    if (previous.status === "idle" && timer.status === "running" && remainingSeconds > 0) {
      setAnnouncement("เริ่มจับเวลาพักแล้ว");
    } else if (previous.status === "paused" && timer.status === "running" && remainingSeconds > 0) {
      setAnnouncement("จับเวลาพักต่อแล้ว");
    } else if (previous.status === "running" && timer.status === "paused") {
      setAnnouncement("หยุดเวลาพักชั่วคราวแล้ว");
    } else if (previous.remainingSeconds > 0 && remainingSeconds === 0 && timer.status === "running") {
      setAnnouncement("หมดเวลาพักแล้ว");
    }
    previousTimer.current = { status: timer.status, remainingSeconds };
  }, [remainingSeconds, timer.status]);
  return (
    <section aria-labelledby="rest-timer-heading" className="border-t border-line pt-4">
      <p id="rest-timer-heading" className="text-xs font-semibold tracking-[0.06em] text-ink-muted">REST TIMER</p>
      <p data-testid="rest-timer" role="timer" aria-live="off" aria-label={`เวลาพัก ${running || paused ? formatTimer(remainingSeconds) : "พร้อม"}`} className="mt-3 text-data-xl tabular-nums">
        {running || paused ? formatTimer(remainingSeconds) : "พร้อม"}
      </p>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">
        {running ? "กำลังพักระหว่างเซ็ต" : paused ? "Timer หยุดชั่วคราว" : "Complete Set เพื่อเริ่มพัก"}
      </p>
      {!readOnly && (running || paused) ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={paused ? onResume : onPause}>{paused ? "เริ่มต่อ" : "พัก"}</Button>
          <Button variant="quiet" onClick={() => { setAnnouncement("เริ่มจับเวลาพักใหม่แล้ว"); onReset(); }}>เริ่มใหม่</Button>
          <Button variant="quiet" onClick={() => { setAnnouncement("ข้ามเวลาพักแล้ว"); onSkip(); }}>ข้าม</Button>
        </div>
      ) : null}
    </section>
  );
}
