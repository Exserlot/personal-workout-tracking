import type { ReactNode } from "react";

interface EmptyStateProps {
  marker?: string;
  title: string;
  description: string;
  action?: ReactNode;
  showTopRule?: boolean;
}

export function EmptyState({ marker = "00", title, description, action, showTopRule = true }: EmptyStateProps) {
  return (
    <section className={`${showTopRule ? "border-t border-line" : ""} py-8 tablet:py-12`}>
      <p className="text-xs font-semibold tracking-[0.08em] text-accent">{marker}</p>
      <h2 className="mt-4 max-w-xl text-h2 text-balance">{title}</h2>
      <p className="mt-3 max-w-xl text-base leading-7 text-ink-secondary">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
