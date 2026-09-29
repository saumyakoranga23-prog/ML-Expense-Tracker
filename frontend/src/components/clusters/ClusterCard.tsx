import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Metric } from '@/components/common/PageHeader';
import { clusterColor } from '@/components/charts/theme';
import type { ClusterStat } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';

const FREQUENCY_VARIANT = {
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
} as const;

/** Everything the API computed for one cluster, with no invented numbers. */
export function ClusterCard({
  cluster,
  maxSpendShare,
  className,
}: {
  cluster: ClusterStat;
  maxSpendShare: number;
  className?: string;
}) {
  const color = clusterColor(cluster.cluster);
  const incomeHeavy = cluster.income_share >= 60;

  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <CardHeader className="pb-2">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            <span className="font-mono text-[11px] text-muted-foreground">cluster {cluster.cluster}</span>
          </div>
          <h3 className="text-sm font-semibold leading-snug">{cluster.label}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={FREQUENCY_VARIANT[cluster.frequency]}>{cluster.frequency} frequency</Badge>
            <Badge variant="outline">{incomeHeavy ? 'Income stream' : 'Spending'}</Badge>
            <Badge variant="neutral">{cluster.dominant_category}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Records" value={formatNumber(cluster.size)} hint={`${formatPercent(cluster.percentage)} of transactions`} />
          <Metric label="Average transaction" value={formatCurrency(cluster.avg_transaction)} hint={`Median ${formatCurrency(cluster.median_transaction)}`} />
          <Metric
            label={incomeHeavy ? 'Total income' : 'Total spending'}
            value={formatCurrency(incomeHeavy ? cluster.total_income : cluster.total_spending)}
            hint={incomeHeavy ? 'Income in this cluster' : `${formatPercent(cluster.spend_share)} of all spending`}
          />
          <Metric
            label="Dominant category"
            value={cluster.dominant_category}
            hint={`${formatPercent(cluster.dominant_category_share)} of cluster value`}
          />
          <Metric
            label="Frequency"
            value={`${cluster.transactions_per_month.toFixed(1)} / month`}
            hint={`${cluster.active_months} active months`}
          />
          <Metric label="Income share" value={formatPercent(cluster.income_share)} hint={`Weekend share ${formatPercent(cluster.weekend_share)}`} />
        </div>

        <div>
          <p className="label-caps mb-1.5">Share of total spending</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`${formatPercent(cluster.spend_share)} of total spending`}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(cluster.spend_share, 0))}%`,
                backgroundColor: color,
                opacity: 0.85,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatPercent(cluster.spend_share)} of spending · largest cluster holds {formatPercent(maxSpendShare)}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="label-caps">Behavioural characteristics</p>
          <ul className="space-y-1">
            {cluster.characteristics.map((characteristic) => (
              <li key={characteristic} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                <span>{characteristic}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-border/70 pt-3">
          <p className="label-caps">Top categories in this cluster</p>
          <ul className="space-y-1.5">
            {cluster.top_categories.map((category) => (
              <li key={category.category}>
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="min-w-0 truncate text-foreground">{category.category}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(category.total)} · {formatPercent(category.share)}
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, category.share)}%`, backgroundColor: color, opacity: 0.55 }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
