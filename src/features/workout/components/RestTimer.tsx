import { Button } from "../../../components/ui/Button";
import type { WorkoutTimerCache } from "../data/activeSessionCache";
import { formatTimer } from "../domain/workoutRules";

interface RestTimerProps {
  timer: WorkoutTimerCache;
  remainingSeconds: number;
  readOnly?: boolean;
  onPause: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function RestTimer({ timer, remainingSeconds, readOnly = false, onPause, onSkip, onReset }: RestTimerProps) {
  const running = timer.status === "running" && remainingSeconds > 0;
  const paused = timer.status === "paused" && remainingSeconds > 0;
  return (
    <section aria-labelledby="rest-timer-heading" className="border-t border-line pt-4">
      <p id="rest-timer-heading" className="text-xs font-semibold tracking-[0.06em] text-ink-muted">REST TIMER</p>
      <p data-testid="rest-timer" aria-live="polite" className="mt-3 text-data-xl tabular-nums">
        {running || paused ? formatTimer(remainingSeconds) : "พร้อม"}
      </p>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">
        {running ? "กำลังพักระหว่างเซ็ต" : paused ? "Timer หยุดชั่วคราว" : "Complete Set เพื่อเริ่มพัก"}
      </p>
      {!readOnly && (running || paused) ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={paused ? onReset : onPause}>{paused ? "เริ่มต่อ" : "พัก"}</Button>
          <Button variant="quiet" onClick={onReset}>เริ่มใหม่</Button>
          <Button variant="quiet" onClick={onSkip}>ข้าม</Button>
        </div>
      ) : null}
    </section>
  );
}
