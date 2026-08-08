import { Button } from "../../../components/ui/Button";
import type { RestTimerState } from "../domain/setLogging";

interface RestTimerProps {
  timer: RestTimerState;
  remainingSeconds: number;
  onSkip: () => void;
  onReset: () => void;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function RestTimer({ timer, remainingSeconds, onSkip, onReset }: RestTimerProps) {
  const running = timer.status === "running" && remainingSeconds > 0;
  return (
    <section aria-labelledby="rest-timer-heading" className="border-t border-line pt-4">
      <p id="rest-timer-heading" className="text-xs font-semibold tracking-[0.06em] text-ink-muted">REST TIMER</p>
      <p
        data-testid="rest-timer"
        aria-live="polite"
        className="mt-3 text-data-xl tabular-nums"
      >
        {running ? formatTime(remainingSeconds) : "พร้อม"}
      </p>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">
        {running ? "พักระหว่างเซ็ต · timer จะคงอยู่หลัง refresh" : "Complete Set เพื่อเริ่มพัก"}
      </p>
      {running ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onReset}>เริ่มใหม่</Button>
          <Button variant="quiet" onClick={onSkip}>ข้าม</Button>
        </div>
      ) : null}
    </section>
  );
}
