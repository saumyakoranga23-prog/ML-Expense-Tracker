import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, clusterColor, currencyTickFormatter, gridProps } from '@/components/charts/theme';
import type { CategoryStat } from '@/types/api';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';

interface Row {
  category: string;
  total_spending: number;
  share: number;
  transactions: number;
  average_transaction: number;
}

function BarTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as unknown as Row | undefined;
  if (!row) return null;
  return (
    <TooltipShell
      title={row.category}
      rows={[
        { label: 'Spending', value: formatCurrency(row.total_spending) },
        { label: 'Share of spending', value: formatPercent(row.share) },
        { label: 'Transactions', value: formatNumber(row.transactions) },
        { label: 'Average', value: formatCurrency(row.average_transaction) },
      ]}
    />
  );
}

export function CategoryBarChart({ categories, limit = 10, height }: { categories: CategoryStat[]; limit?: number; height?: number }) {
  const rows: Row[] = categories.slice(0, limit).map((category) => ({
    category: category.category,
    total_spending: category.total_spending,
    share: category.share,
    transactions: category.transactions,
    average_transaction: category.average_transaction,
  }));

  if (!rows.length) return <ChartEmpty message="No categories to compare." />;

  const chartHeight = height ?? Math.max(240, rows.length * 32 + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid {...gridProps} horizontal={false} vertical />
        <XAxis type="number" {...axisProps} tickFormatter={currencyTickFormatter} />
        <YAxis type="category" dataKey="category" {...axisProps} width={140} interval={0} />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'hsl(var(--border))', fillOpacity: 0.2 }} />
        <Bar dataKey="total_spending" name="Spending" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {rows.map((row, index) => (
            <Cell key={row.category} fill={clusterColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
