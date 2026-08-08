import { useEffect, useRef } from "react";
import { Button } from "../../../components/ui/Button";

interface ArchiveExerciseDialogProps {
  exerciseName: string;
  open: boolean;
  loading: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchiveExerciseDialog({
  exerciseName,
  open,
  loading,
  error,
  onCancel,
  onConfirm,
}: ArchiveExerciseDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="archive-dialog-title"
      aria-describedby="archive-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!loading) onCancel();
      }}
      className="m-auto w-[calc(100%_-_32px)] max-w-lg rounded-md border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-recessed/90"
    >
      <div className="border-t-2 border-error p-5 tablet:p-6">
        <p className="text-xs font-semibold tracking-[0.08em] text-error">ARCHIVE EXERCISE</p>
        <h2 id="archive-dialog-title" className="mt-3 text-h3">Archive {exerciseName}?</h2>
        <p id="archive-dialog-description" className="mt-3 leading-7 text-ink-secondary">
          ท่านี้จะหายจากรายการใช้งานและตัวเลือกในแผนใหม่ แต่ข้อมูลใน Workout History เดิมยังคงอยู่
        </p>
        {error ? <p role="alert" className="mt-4 border-l-2 border-error pl-3 text-sm text-error">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 tablet:flex-row tablet:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}>ยกเลิก</Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading ? "กำลัง Archive…" : "ยืนยัน Archive"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
