import {
  Boxes,
  BrainCircuit,
  LayoutDashboard,
  Lightbulb,
  PieChart,
  ReceiptText,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDataset } from '@/hooks/useDataset';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/utils/format';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'KPIs and monthly trends' },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText, hint: 'Search and filter every row' },
  { to: '/analysis', label: 'Spending Analysis', icon: PieChart, hint: 'Category breakdowns' },
  { to: '/clusters', label: 'Clusters', icon: Boxes, hint: 'K-Means spending profiles' },
  { to: '/insights', label: 'Insights', icon: Lightbulb, hint: 'Deterministic findings' },
  { to: '/model', label: 'Model', icon: BrainCircuit, hint: 'Algorithm and diagnostics' },
] as const;

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 text-sm font-semibold text-primary">
        LL
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight tracking-tight">LedgerLens</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">Spending clusters</span>
        </span>
      ) : null}
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { dataset, clusters } = useDataset();

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const disabled = !dataset;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : undefined}
              className={({ isActive }) =>
                cn(
                  'group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  disabled && 'pointer-events-none opacity-40',
                  isActive
                    ? 'bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.28)]'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', isActive && 'text-primary')} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-medium leading-tight">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground/80">
                      {item.hint}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <p className="label-caps">Dataset</p>
        {dataset ? (
          <div className="space-y-2">
            <p className="truncate text-xs font-medium text-foreground" title={dataset.filename}>
              {dataset.filename}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatNumber(dataset.row_count)} transactions · {dataset.summary.kpis.months_covered} months
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="neutral">{dataset.source === 'demo' ? 'Demo data' : 'Uploaded'}</Badge>
              {clusters ? (
                <Badge variant="info">
                  K = {clusters.k} · silhouette {clusters.metrics.silhouette.toFixed(3)}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No dataset loaded yet. Upload a CSV or explore the demo dataset to unlock the analytics.
          </p>
        )}
      </div>
    </>
  );
}

export function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  return (
    <aside
      className={cn(
        'flex h-full w-[264px] shrink-0 flex-col border-r border-border bg-surface/80',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
        <Brand />
        {onClose ? (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <SidebarNav onNavigate={onClose} />
    </aside>
  );
}
