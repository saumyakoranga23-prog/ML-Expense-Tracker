import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, chartColors, gridProps } from '@/components/charts/theme';
import { formatDecimal, formatPercent } from '@/utils/format';

interface VarianceRow {
  component: string;
  variance: number;
  cumulative: number;
}

function VarianceTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as unknown as VarianceRow | undefined;
  if (!row) return null;
  return (
    <TooltipShell
      title={row.component}
      rows={[
        { label: 'Explained variance', value: formatPercent(row.variance * 100) },
        { label: 'Cumulative', value: formatPercent(row.cumulative * 100) },
      ]}
    />
  );
}

export function ExplainedVarianceChart({ explainedVariance }: { explainedVariance: number[] }) {
  if (!explainedVariance.length) return <ChartEmpty message="PCA has not been fitted yet." height={200} />;

  let running = 0;
  const data: VarianceRow[] = explainedVariance.map((variance, index) => {
    running += variance;
    return { component: `PC${index + 1}`, variance, cumulative: running };
  });

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="component" {...axisProps} />
          <YAxis {...axisProps} width={56} tickFormatter={(value: number) => `${formatDecimal(value * 100, 0)}%`} domain={[0, 1]} />
          <Tooltip content={<VarianceTooltip />} cursor={{ fill: 'hsl(var(--border))', fillOpacity: 0.2 }} />
          <Bar dataKey="variance" name="Explained variance" radius={[4, 4, 0, 0]} maxBarSize={64}>
            {data.map((row, index) => (
              <Cell key={row.component} fill={index === 0 ? chartColors.primary : index === 1 ? chartColors.accent : chartColors.info} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        PC1 and PC2 together retain {formatPercent(running * 100)} of the variance of the six behavioural features.
        K-Means still clusters on the full feature space; the reduction exists so the partition can be drawn in two
        dimensions.
      </p>
    </div>
  );
}
