import type { IconName } from "../components/icons/Icon";

export interface NavigationItem {
  index: string;
  label: string;
  shortLabel: string;
  to: string;
  icon: IconName;
}

export const primaryNavigation: NavigationItem[] = [
  { index: "01", label: "วันนี้", shortLabel: "วันนี้", to: "/today", icon: "today" },
  { index: "02", label: "แผนการฝึก", shortLabel: "แผน", to: "/plans", icon: "plans" },
  { index: "03", label: "คลังท่าฝึก", shortLabel: "ท่าฝึก", to: "/exercises", icon: "exercises" },
  { index: "04", label: "ประวัติ", shortLabel: "ประวัติ", to: "/history", icon: "history" },
  { index: "05", label: "ความก้าวหน้า", shortLabel: "สถิติ", to: "/progress", icon: "progress" },
];

export const utilityNavigation: NavigationItem[] = [
  { index: "06", label: "ตั้งค่าและการซิงก์", shortLabel: "ตั้งค่า", to: "/settings", icon: "settings" },
];
