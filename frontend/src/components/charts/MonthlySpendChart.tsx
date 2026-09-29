import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, chartColors, currencyTickFormatter, gridProps } from '@/components/charts/theme';
import { Segmented } from '@/components/ui/segmented';
import type { MonthlyPoint } from '@/types/api';
import { formatCurrency, formatNumber } from '@/utils/format';

type View = 'expense' | 'income' | 'both';

function SpendTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as unknown as MonthlyPoint | undefined;
  if (!point) return null;
  return (
    <TooltipShell
      title={String(label ?? point.label)}
      subtitle={`${formatNumber(point.transactions)} transactions`}
      rows={[
        { label: 'Spending', value: formatCurrency(point.expense), color: chartColors.expense },
        ...(point.income > 0
          ? [{ label: 'Income', value: formatCurrency(point.income), color: chartColors.income }]
          : []),
        { label: 'Net', value: formatCurrency(point.net) },
      ]}
      footer={point.transactions > 0 ? `Average spend per transaction ${formatCurrency(point.avg_transaction)}` : undefined}
    />
  );
}

export function MonthlySpendChart({ data }: { data: MonthlyPoint[] }) {
  const [view, setView] = useState<View>('expense');
  const hasIncome = useMemo(() => data.some((point) => point.income > 0), [data]);

  if (!data.length) return <ChartEmpty message="No monthly spending to plot yet." />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Segmented<View>
          size="sm"
          ariaLabel="Monthly trend view"
          value={view}
          onChange={setView}
          options={[
            { value: 'expense', label: 'Spending' },
            ...(hasIncome ? [{ value: 'income' as View, label: 'Income' }] : []),
            ...(hasIncome ? [{ value: 'both' as View, label: 'Both' }] : []),
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.expense} stopOpacity={0.32} />
              <stop offset="100%" stopColor={chartColors.expense} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.income} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColors.income} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...axisProps} width={68} tickFormatter={currencyTickFormatter} />
          <Tooltip content={<SpendTooltip />} cursor={{ stroke: chartColors.grid }} />
          {view !== 'income' ? (
            <Area
              type="monotone"
              dataKey="expense"
              name="Spending"
              stroke={chartColors.expense}
              strokeWidth={2}
              fill="url(#expenseFill)"
              activeDot={{ r: 4 }}
            />
          ) : null}
          {view !== 'expense' ? (
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke={chartColors.income}
              strokeWidth={2}
              fill="url(#incomeFill)"
              activeDot={{ r: 4 }}
            />
          ) : null}
          {view === 'both' ? (
            <Line type="monotone" dataKey="expense" name="Spending" stroke={chartColors.expense} strokeWidth={2} dot={false} />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
