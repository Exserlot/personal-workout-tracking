import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PageFrameProps {
  pageId: string;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageFrame({ pageId, eyebrow, title, description, action, children, className }: PageFrameProps) {
  return (
    <div className={cn("mx-auto w-full max-w-content px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-8 desktop:py-10 large:px-12", className)}>
      <header className="page-grid items-end border-b border-line pb-6 tablet:pb-8">
        <div className="col-span-4 min-w-0 tablet:col-span-6 desktop:col-span-8">
          <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-accent">
            {eyebrow ?? `STATIC PREVIEW · ${pageId}`}
          </p>
          <h1 className="text-[30px] font-bold leading-9 tracking-[-0.025em] text-balance tablet:text-h1 desktop:text-display-lg">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">{description}</p>
        </div>
        {action ? (
          <div className="col-span-4 mt-5 flex flex-wrap gap-3 tablet:col-span-2 tablet:mt-0 tablet:justify-end desktop:col-span-4">
            {action}
          </div>
        ) : null}
      </header>
      <div className="mt-8 tablet:mt-10">{children}</div>
    </div>
  );
}
