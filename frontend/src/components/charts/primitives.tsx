import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ChartTooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipEntry[];
}

/** Shared shell for every custom Recharts tooltip. */
export function TooltipShell({
  title,
  subtitle,
  rows,
  footer,
  tone,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rows: Array<{ label: string; value: React.ReactNode; color?: string }>;
  footer?: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <div className="pointer-events-none min-w-[190px] rounded-lg border border-border bg-surface-elevated/95 px-3 py-2.5 text-xs shadow-panel backdrop-blur">
      <p className="font-medium text-foreground">{title}</p>
      {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
      <dl className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {row.color ? (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
              ) : null}
              {row.label}
            </dt>
            <dd
              className={cn(
                'font-medium tabular-nums text-foreground',
                tone === 'positive' && 'text-positive',
                tone === 'negative' && 'text-negative',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer ? <p className="mt-2 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">{footer}</p> : null}
    </div>
  );
}

export function ChartFrame({
  title,
  description,
  actions,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('panel flex min-w-0 flex-col p-5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? <footer className="mt-3 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">{footer}</footer> : null}
    </section>
  );
}

export function ChartEmpty({ message, height = 280 }: { message: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}
