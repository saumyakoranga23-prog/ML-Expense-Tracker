import * as React from 'react';

import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface/60 px-6 py-12 text-center', className)}>
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function ErrorBanner({
  title,
  message,
  details = [],
  onDismiss,
  className,
}: {
  title?: string;
  message: string;
  details?: string[];
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('rounded-lg border border-negative/40 bg-negative/10 px-4 py-3 text-sm', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-medium text-negative">{title ?? 'Something needs attention'}</p>
          <p className="text-xs leading-relaxed text-foreground/80">{message}</p>
          {details.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {details.slice(0, 4).map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Rotating progress message shown while a long request is in flight. */
export function StageProgress({ stages, className }: { stages: string[]; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3', className)} role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{stages[0] ?? 'Working…'}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {stages.slice(1).map((stage) => (
            <span key={stage} className="opacity-60">
              {stage}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
