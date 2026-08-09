import type { ReactNode } from "react";

interface SectionHeaderProps {
    eyebrow?: string;
    title: string;
    description?: string;
    action?: ReactNode;
    showTopRule?: boolean;
    isTitleDescriptionInline?: boolean;
}

export function SectionHeader({
    eyebrow,
    title,
    description,
    action,
    showTopRule = true,
    isTitleDescriptionInline = false,
}: SectionHeaderProps) {
    return (
        <header
            className={`grid min-w-0 gap-4 pt-4 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-end ${showTopRule ? "border-t border-line" : ""}`}
        >
            <div className="min-w-0">
                {eyebrow ? (
                    <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-accent">
                        {eyebrow}
                    </p>
                ) : null}
                <div
                    className={`flex ${isTitleDescriptionInline ? "flex-row gap-2" : "flex-col"}`}
                >
                    <h2 className="text-h2 text-balance text-ink">{title}</h2>
                    {description ? (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
                            {description}
                        </p>
                    ) : null}
                </div>
            </div>
            {action ? (
                <div className="justify-self-start tablet:justify-self-end">
                    {action}
                </div>
            ) : null}
        </header>
    );
}
