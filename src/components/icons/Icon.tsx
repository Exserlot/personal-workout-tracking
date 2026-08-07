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
  | "close"
  | "arrow"
  | "check";

const paths: Record<IconName, React.ReactNode> = {
  today: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z" />,
  plans: <path d="M5 5h14M5 12h14M5 19h14M8 3v4M16 10v4M10 17v4" />,
  exercises: <path d="M3 10v4m3-7v10m12-10v10m3-7v4M6 12h12" />,
  history: <path d="M4 5v5h5M5.2 9A8 8 0 1 1 6 17m6-9v5l3 2" />,
  progress: <path d="m4 18 5-6 4 3 7-9M17 6h3v3" />,
  settings: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-5v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6-1.5 1.5m-9 9L6 18m12 0-1.5-1.5m-9-9L6 6" />,
  start: <path d="m9 6 9 6-9 6V6Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, className = "h-5 w-5", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
