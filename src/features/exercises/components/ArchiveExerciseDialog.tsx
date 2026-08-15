import { Icon } from "../../../components/icons/Icon";
import { Button } from "../../../components/ui/Button";
import { ModalDialog } from "../../../components/ui/ModalDialog";

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
  return (
    <ModalDialog open={open} onClose={() => { if (!loading) onCancel(); }} title={`Archive ${exerciseName}?`} description="ท่านี้จะหายจากรายการใช้งานและตัวเลือกในแผนใหม่ แต่ข้อมูลใน Workout History เดิมยังคงอยู่" role="alertdialog" closeOnBackdrop={!loading} className="border-t-2 border-error p-5 tablet:p-6">
        <p className="text-xs font-semibold tracking-[0.08em] text-error">ARCHIVE EXERCISE</p>
        {error ? <p role="alert" className="mt-4 border-l-2 border-error pl-3 text-sm text-error">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 tablet:flex-row tablet:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}><Icon name="close" className="h-4 w-4" />ยกเลิก</Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            <Icon name="archive" className="h-4 w-4" />
            {loading ? "กำลัง Archive…" : "ยืนยัน Archive"}
          </Button>
        </div>
    </ModalDialog>
  );
}
