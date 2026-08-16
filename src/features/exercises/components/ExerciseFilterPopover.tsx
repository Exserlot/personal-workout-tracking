import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../../components/icons/Icon";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { ModalDialog } from "../../../components/ui/ModalDialog";
import {
  equipmentOptions,
  muscleOptions,
  type EquipmentCode,
  type MuscleCode,
} from "../domain/exercise";
import type { ExerciseStatusFilter } from "../domain/exercise";

interface FilterOption {
  code: string;
  label: string;
}

function useTabletViewport() {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 600px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 600px)");
    const update = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
}

function FilterCombobox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const listboxId = useId();
  const selected = options.find((option) => option.code === value) ?? options[0];
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        lastTriggerRef.current?.focus();
      }
      return undefined;
    }
    wasOpenRef.current = true;
    function handleDismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDismiss);
    document.addEventListener("keydown", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleDismiss);
      document.removeEventListener("keydown", handleDismiss);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <span className="mb-2 block text-[13px] font-semibold tracking-[0.02em] text-ink-secondary">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xs border border-line bg-surface px-3 text-left text-sm text-ink hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${value !== "all" ? "pr-24" : "pr-12"}`}
          onClick={(event) => {
            lastTriggerRef.current = event.currentTarget;
            setOpen((current) => !current);
          }}
        >
          <span className="truncate">{selected?.label ?? "เลือกค่า"}</span>
        </button>
        <div className="absolute inset-y-0 right-0 flex items-center">
          {value !== "all" ? (
            <button
              type="button"
              aria-label={`ล้างค่า${label}`}
              title={`ล้างค่า${label}`}
              className="flex h-11 w-11 items-center justify-center rounded-xs text-ink-muted hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              onClick={(event) => {
                event.stopPropagation();
                setSearch("");
                onChange("all");
              }}
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-label={open ? `ปิดตัวเลือก${label}` : `เปิดตัวเลือก${label}`}
            className="flex h-11 w-11 items-center justify-center rounded-xs text-ink-muted hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            onClick={(event) => {
              lastTriggerRef.current = event.currentTarget;
              setOpen((current) => !current);
            }}
          >
            <Icon name="chevron-down" className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open ? (
        <div data-escape-boundary="true" className="relative z-30 mt-2 w-full min-w-56 border border-line bg-canvas p-3 tablet:absolute tablet:left-0 tablet:top-full">
          <Input
            label={`ค้นหา${label}`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="mt-3 max-h-56 overflow-y-auto border-t border-line-subtle pt-1"
          >
            {visibleOptions.length === 0 ? (
              <p className="py-3 text-sm text-ink-muted">ไม่พบตัวเลือก</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={option.code === value}
                  className="flex min-h-11 w-full items-center border-b border-line-subtle px-2 text-left text-sm text-ink hover:bg-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
                  onClick={() => {
                    onChange(option.code);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface ExerciseFilterPopoverProps {
  muscleFilter: MuscleCode | "all";
  equipmentFilter: EquipmentCode | "all";
  onMuscleChange: (value: MuscleCode | "all") => void;
  onEquipmentChange: (value: EquipmentCode | "all") => void;
  statusFilter?: ExerciseStatusFilter;
  onStatusChange?: (value: ExerciseStatusFilter) => void;
  label?: string;
}

export function ExerciseFilterPopover({
  muscleFilter,
  equipmentFilter,
  onMuscleChange,
  onEquipmentChange,
  statusFilter,
  onStatusChange,
  label = "ตัวกรอง Exercise",
}: ExerciseFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const wasOpenRef = useRef(false);
  const isTabletViewport = useTabletViewport();
  const activeCount =
    Number(muscleFilter !== "all") +
    Number(equipmentFilter !== "all") +
    Number(statusFilter !== undefined && statusFilter !== "active");

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        triggerRef.current?.focus();
      }
      return undefined;
    }
    wasOpenRef.current = true;
    if (!isTabletViewport) return undefined;
    function handleDismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        if (event.target instanceof Element && event.target.closest("[data-escape-boundary='true']")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDismiss);
    window.addEventListener("keydown", handleDismiss, true);
    return () => {
      document.removeEventListener("mousedown", handleDismiss);
      window.removeEventListener("keydown", handleDismiss, true);
    };
  }, [isTabletViewport, open]);

  const panelContent = (
    <>
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-line bg-canvas px-4 py-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 items-center justify-center text-ink-muted hover:bg-interactive hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          aria-label="ปิดตัวกรอง"
          onClick={() => setOpen(false)}
        >
          <Icon name="close" className="!h-6 !w-6 shrink-0" strokeWidth={2.2} />
        </button>
      </div>
      <div className="space-y-4">
        <FilterCombobox
          label="หมวดหมู่กล้ามเนื้อ"
          value={muscleFilter}
          options={[{ code: "all", label: "ทุกกลุ่มกล้ามเนื้อ" }, ...muscleOptions]}
          onChange={(value) => onMuscleChange(value as MuscleCode | "all")}
        />
        <FilterCombobox
          label="อุปกรณ์"
          value={equipmentFilter}
          options={[{ code: "all", label: "ทุกอุปกรณ์" }, ...equipmentOptions]}
          onChange={(value) => onEquipmentChange(value as EquipmentCode | "all")}
        />
        {statusFilter !== undefined && onStatusChange ? (
          <FilterCombobox
            label="สถานะ"
            value={statusFilter}
            options={[
              { code: "active", label: "ใช้งานอยู่" },
              { code: "archived", label: "Archived" },
              { code: "all", label: "ทั้งหมด" },
            ]}
            onChange={(value) => onStatusChange(value as ExerciseStatusFilter)}
          />
        ) : null}
      </div>
      {activeCount > 0 ? (
        <Button
          variant="quiet"
          size="compact"
          type="button"
          className="mt-4"
          onClick={() => {
            onMuscleChange("all");
            onEquipmentChange("all");
            onStatusChange?.("active");
          }}
        >
          <Icon name="close" className="h-4 w-4" />
          ล้างตัวกรอง
        </Button>
      ) : null}
    </>
  );

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        ref={triggerRef}
        variant="secondary"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          activeCount > 0
            ? `ตัวกรอง Exercise มี ${activeCount} รายการที่ใช้`
            : "เปิดตัวกรอง Exercise"
        }
        title={label}
        className={`relative h-12 w-12 shrink-0 px-0 tablet:h-11 tablet:w-11 ${activeCount > 0 ? "border-accent-action text-accent" : ""}`}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="filter" className="h-5 w-5 shrink-0" />
        {activeCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-action px-1 text-[10px] font-bold text-white"
          >
            {activeCount}
          </span>
        ) : null}
      </Button>
      {open && isTabletViewport ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto border border-line bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] tablet:absolute tablet:left-auto tablet:right-0 tablet:top-full tablet:bottom-auto tablet:mt-2 tablet:max-h-[min(36rem,calc(100vh-6rem))] tablet:w-[min(20rem,calc(100vw-2rem))] tablet:overflow-visible tablet:pb-4"
        >
          {panelContent}
        </div>
      ) : null}
      <ModalDialog
        open={open && !isTabletViewport}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        title={label}
        variant="sheet"
        titleClassName="sr-only"
        className="max-w-none overflow-y-auto bg-canvas p-4 tablet:hidden"
      >
        <div id={panelId}>{panelContent}</div>
      </ModalDialog>
    </div>
  );
}
