import {
  Archive,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Dumbbell,
  History,
  List,
  Menu,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SVGProps } from "react";

export type IconName =
  | "today"
  | "plans"
  | "exercises"
  | "history"
  | "progress"
  | "settings"
  | "start"
  | "menu"
  | "more"
  | "close"
  | "arrow"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "archive"
  | "copy"
  | "edit"
  | "filter"
  | "plus"
  | "refresh"
  | "search"
  | "trash";

const icons: Record<IconName, LucideIcon> = {
  today: CalendarDays,
  plans: List,
  exercises: Dumbbell,
  history: History,
  progress: TrendingUp,
  settings: Settings,
  start: Play,
  menu: Menu,
  more: MoreHorizontal,
  close: X,
  arrow: ArrowRight,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  archive: Archive,
  copy: Copy,
  edit: Pencil,
  filter: SlidersHorizontal,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  trash: Trash2,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, className = "h-5 w-5", ...props }: IconProps) {
  const LucideIcon = icons[name];
  return <LucideIcon className={className} aria-hidden="true" strokeWidth={1.7} {...props} />;
}
