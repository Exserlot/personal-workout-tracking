import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <header className="grid min-w-0 gap-4 border-t border-line pt-4 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-end">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-accent">{eyebrow}</p>
        ) : null}
        <h2 className="text-h2 text-balance text-ink">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">{description}</p> : null}
      </div>
      {action ? <div className="justify-self-start tablet:justify-self-end">{action}</div> : null}
    </header>
  );
}
