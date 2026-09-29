import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { clusterColor } from '@/components/charts/theme';
import type { CategoryStat } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';

interface Slice {
  category: string;
  value: number;
  share: number;
  transactions: number;
  color: string;
}

function DonutTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const slice = payload[0]?.payload as unknown as Slice | undefined;
  if (!slice) return null;
  return (
    <TooltipShell
      title={slice.category}
      rows={[
        { label: 'Spending', value: formatCurrency(slice.value), color: slice.color },
        { label: 'Share', value: formatPercent(slice.share) },
        { label: 'Transactions', value: formatNumber(slice.transactions) },
      ]}
    />
  );
}

/**
 * Spending by category with a slimmable slice list. Clicking a legend row (or a
 * slice) notifies the parent so the category can be inspected elsewhere.
 */
export function CategoryDonut({
  categories,
  limit = 8,
  onSelect,
  className,
}: {
  categories: CategoryStat[];
  limit?: number;
  onSelect?: (category: string) => void;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const slices = useMemo<Slice[]>(
    () =>
      categories.slice(0, limit).map((category, index) => ({
        category: category.category,
        value: category.total_spending,
        share: category.share,
        transactions: category.transactions,
        color: clusterColor(index),
      })),
    [categories, limit],
  );

  const remainder = useMemo(() => {
    if (categories.length <= limit) return null;
    const rest = categories.slice(limit);
    return {
      category: `${rest.length} more categories`,
      value: rest.reduce((total, item) => total + item.total_spending, 0),
      share: rest.reduce((total, item) => total + item.share, 0),
      transactions: rest.reduce((total, item) => total + item.transactions, 0),
      color: 'hsl(var(--muted))',
    };
  }, [categories, limit]);

  if (!slices.length) return <ChartEmpty message="No spending categories were detected." />;

  const allSlices = remainder ? [...slices, remainder] : slices;

  return (
    <div className={cn('grid gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-center', className)}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={allSlices}
              dataKey="value"
              nameKey="category"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="hsl(var(--surface))"
              strokeWidth={2}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(entry) => onSelect?.((entry as unknown as Slice).category)}
              isAnimationActive={false}
            >
              {allSlices.map((slice, index) => (
                <Cell
                  key={slice.category}
                  fill={slice.color}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="label-caps">Total</span>
          <span className="metric-value text-base">
            {formatCurrency(allSlices.reduce((total, slice) => total + slice.value, 0))}
          </span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {allSlices.map((slice, index) => (
          <li key={slice.category}>
            <button
              type="button"
              onClick={() => onSelect?.(slice.category)}
              disabled={!onSelect || slice.category.endsWith('more categories')}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                onSelect && !slice.category.endsWith('more categories')
                  ? 'hover:bg-surface-muted'
                  : 'cursor-default',
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-foreground">{slice.category}</span>
              <span className="tabular-nums text-muted-foreground">{formatPercent(slice.share)}</span>
              <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatCurrency(slice.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
