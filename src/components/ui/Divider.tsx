import { cn } from "../../lib/cn";

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("m-0 border-0 border-t border-line-subtle", className)} />;
}
