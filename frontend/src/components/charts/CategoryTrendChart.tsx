import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, clusterColor, currencyTickFormatter, gridProps } from '@/components/charts/theme';
import type { CategoryStat, MonthlyPoint } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/format';

interface TrendRow {
  label: string;
  month: string;
  [key: string]: string | number;
}

function TrendTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as unknown as TrendRow | undefined;
  if (!row) return null;
  const entries = [...payload]
    .filter((entry) => typeof entry.value === 'number' && (entry.value as number) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));
  if (!entries.length) return null;
  return (
    <TooltipShell
      title={String(label ?? row.label)}
      rows={entries.map((entry) => ({
        label: String(entry.name ?? entry.dataKey ?? ''),
        value: formatCurrency(Number(entry.value)),
        color: entry.color,
      }))}
    />
  );
}

/**
 * Month-by-month spend for the largest categories. The category chips toggle
 * which series are drawn — all values come from the API's monthly series.
 */
export function CategoryTrendChart({ categories, maxSeries = 5 }: { categories: CategoryStat[]; maxSeries?: number }) {
  const ranked = useMemo(() => categories.slice(0, Math.max(maxSeries, 3)), [categories, maxSeries]);
  const [selected, setSelected] = useState<string[]>(() => ranked.slice(0, 3).map((category) => category.category));

  const rows = useMemo<TrendRow[]>(() => {
    if (!ranked.length || !ranked[0].monthly.length) return [];
    return ranked[0].monthly.map((point: MonthlyPoint, index) => {
      const row: TrendRow = { label: point.label, month: point.month };
      ranked.forEach((category) => {
        row[category.category] = category.monthly[index]?.expense ?? 0;
      });
      return row;
    });
  }, [ranked]);

  if (!rows.length) return <ChartEmpty message="No monthly category history to plot." />;

  const toggle = (category: string) => {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ranked.map((category, index) => {
          const active = selected.includes(category.category);
          return (
            <button
              key={category.category}
              type="button"
              onClick={() => toggle(category.category)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                active ? 'border-border bg-surface-muted text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: clusterColor(index), opacity: active ? 1 : 0.35 }}
                aria-hidden="true"
              />
              {category.category}
            </button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...axisProps} width={68} tickFormatter={currencyTickFormatter} />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
          {ranked.map((category, index) =>
            selected.includes(category.category) ? (
              <Line
                key={category.category}
                type="monotone"
                dataKey={category.category}
                name={category.category}
                stroke={clusterColor(index)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5 }}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
