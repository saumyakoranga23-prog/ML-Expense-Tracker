import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Insight, InsightMetric } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';

const GROUP_LABEL: Record<Insight['group'], string> = {
  spending: 'Spending',
  income: 'Income',
  trend: 'Trend',
  category: 'Category',
  cluster: 'Cluster',
  behaviour: 'Behaviour',
};

function formatMetric(metric: InsightMetric): string {
  switch (metric.kind) {
    case 'currency':
      return formatCurrency(metric.value);
    case 'percent':
      return formatPercent(metric.value);
    case 'count':
      return formatNumber(metric.value);
    case 'ratio':
      return `${metric.value.toFixed(2)}×`;
    default:
      return String(metric.value);
  }
}

export function InsightCard({ insight, className }: { insight: Insight; className?: string }) {
  return (
    <Card
      className={cn(
        'min-w-0 border-l-2',
        insight.tone === 'positive' && 'border-l-positive',
        insight.tone === 'negative' && 'border-l-negative',
        insight.tone === 'warning' && 'border-l-warning',
        insight.tone === 'neutral' && 'border-l-primary/60',
        className,
      )}
    >
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{GROUP_LABEL[insight.group]}</Badge>
          {insight.tone !== 'neutral' ? (
            <Badge variant={insight.tone === 'positive' ? 'positive' : insight.tone === 'negative' ? 'negative' : 'warning'}>
              {insight.tone === 'positive' ? 'Positive' : insight.tone === 'negative' ? 'Needs attention' : 'Watch'}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3 sm:grid-cols-3">
          {insight.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <dt className="label-caps truncate" title={metric.label}>
                {metric.label}
              </dt>
              <dd className="metric-value mt-1 text-sm">{formatMetric(metric)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
