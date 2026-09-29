import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, chartColors, currencyTickFormatter, gridProps } from '@/components/charts/theme';
import type { MonthlyPoint } from '@/types/api';
import { formatCurrency, formatPercent } from '@/utils/format';

function BalanceTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as unknown as MonthlyPoint | undefined;
  if (!point) return null;
  const savingsRate = point.income > 0 ? (point.net / point.income) * 100 : null;
  return (
    <TooltipShell
      title={String(label ?? point.label)}
      rows={[
        { label: 'Income', value: formatCurrency(point.income), color: chartColors.income },
        { label: 'Spending', value: formatCurrency(point.expense), color: chartColors.expense },
        { label: 'Net cash flow', value: formatCurrency(point.net) },
      ]}
      footer={savingsRate === null ? 'No income recorded this month' : `Savings rate ${formatPercent(savingsRate)} of income`}
    />
  );
}

export function IncomeExpenseChart({ data }: { data: MonthlyPoint[] }) {
  if (!data.length) return <ChartEmpty message="No monthly income or spending to compare." />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
        <YAxis {...axisProps} width={68} tickFormatter={currencyTickFormatter} />
        <Tooltip content={<BalanceTooltip />} cursor={{ fill: chartColors.grid, fillOpacity: 0.15 }} />
        <Bar dataKey="income" name="Income" fill={chartColors.income} radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" name="Spending" fill={chartColors.expense} radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Line type="monotone" dataKey="net" name="Net" stroke={chartColors.primary} strokeWidth={2} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
