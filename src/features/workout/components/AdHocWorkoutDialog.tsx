import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../../components/icons/Icon";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import type { WorkoutTemplateSummary } from "../../planning/domain/planning";
import { filterAdHocTemplates } from "../domain/todayRules";

interface AdHocWorkoutDialogProps {
  templates: WorkoutTemplateSummary[];
  loading: boolean;
  error: string;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
  onStart: (template: WorkoutTemplateSummary | null) => void;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AdHocWorkoutDialog({
  templates,
  loading,
  error,
  busy,
  onClose,
  onRetry,
  onStart,
}: AdHocWorkoutDialogProps) {
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const filteredTemplates = useMemo(
    () => filterAdHocTemplates(templates, search),
    [search, templates],
  );

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-canvas/90 tablet:items-center tablet:justify-center tablet:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        data-testid="ad-hoc-dialog"
        className="safe-bottom flex max-h-[92dvh] w-full flex-col border border-line bg-surface tablet:max-h-[82dvh] tablet:max-w-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-hoc-title"
      >
        <header className="shrink-0 border-b border-line bg-surface px-4 py-4 tablet:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.08em] text-accent">
                AD-HOC WORKOUT
              </p>
              <h2 id="ad-hoc-title" className="mt-2 text-h3 text-balance">
                เลือกการฝึกแบบอิสระ
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                การฝึกนี้จะไม่เลื่อนลำดับ Routine
              </p>
            </div>
            <Button
              ref={closeRef}
              variant="secondary"
              className="h-11 w-11 shrink-0 px-0"
              onClick={onClose}
              disabled={busy}
              aria-label="ปิดตัวเลือก Ad-hoc Workout"
            >
              <Icon name="close" className="h-5 w-5" />
            </Button>
          </div>
          <div className="mt-4">
            <Input
              label="ค้นหา Template"
              value={search}
              placeholder="เช่น Push Day"
              onChange={(event) => setSearch(event.target.value)}
              onClear={search ? () => setSearch("") : undefined}
              clearButtonLabel="ล้างคำค้นหา Template"
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 tablet:px-6">
          {error ? (
            <div role="alert" className="mb-4 border-l-2 border-error pl-4 text-sm text-error">
              <p>{error}</p>
              <Button variant="quiet" size="compact" className="mt-2" onClick={onRetry}>
                ลองโหลดอีกครั้ง
              </Button>
            </div>
          ) : null}

          <Button
            variant="accent"
            size="large"
            fullWidth
            disabled={busy}
            onClick={() => onStart(null)}
          >
            {busy ? "กำลังเริ่ม…" : "เริ่ม Blank Workout"}
          </Button>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink-secondary">
              หรือเริ่มจาก Template
            </p>
            {loading ? (
              <div className="mt-3 space-y-2" role="status">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-16 bg-interactive motion-safe:animate-pulse" />
                ))}
                <span className="sr-only">กำลังโหลด Templates</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                {search ? "ไม่พบ Template ที่ตรงกับคำค้นหา" : "ยังไม่มี Template ที่พร้อมใช้งาน"}
              </p>
            ) : (
              <div className="mt-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={busy}
                    className="grid min-h-[4.5rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line-subtle py-3 text-left text-ink hover:bg-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:text-ink-disabled"
                    onClick={() => onStart(template)}
                    aria-label={`เริ่ม ${template.name}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{template.name}</span>
                      <span className="mt-1 block text-xs text-ink-muted">
                        {template.exerciseCount} ท่า · {template.setCount} เซ็ต
                      </span>
                    </span>
                    <Icon name="arrow" className="h-5 w-5 text-ink-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
