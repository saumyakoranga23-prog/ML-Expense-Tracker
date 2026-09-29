import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, chartColors, countTickFormatter, gridProps } from '@/components/charts/theme';
import type { VolumePoint } from '@/types/api';
import { formatNumber } from '@/utils/format';

function VolumeTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as unknown as VolumePoint | undefined;
  if (!point) return null;
  return (
    <TooltipShell
      title={String(label ?? point.label)}
      rows={[
        { label: 'Transactions', value: formatNumber(point.transactions) },
        { label: 'Expenses', value: formatNumber(point.expenses), color: chartColors.expense },
        { label: 'Income', value: formatNumber(point.incomes), color: chartColors.income },
      ]}
    />
  );
}

export function VolumeChart({ data }: { data: VolumePoint[] }) {
  if (!data.length) return <ChartEmpty message="No transaction volume to plot." />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
        <YAxis {...axisProps} width={44} tickFormatter={countTickFormatter} allowDecimals={false} />
        <Tooltip content={<VolumeTooltip />} cursor={{ fill: chartColors.grid, fillOpacity: 0.15 }} />
        <Bar dataKey="expenses" name="Expense transactions" stackId="volume" fill={chartColors.expense} maxBarSize={22} />
        <Bar
          dataKey="incomes"
          name="Income transactions"
          stackId="volume"
          fill={chartColors.income}
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
