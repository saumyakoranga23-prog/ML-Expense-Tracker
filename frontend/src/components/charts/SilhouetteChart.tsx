import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, chartColors, gridProps } from '@/components/charts/theme';
import type { KSweepEntry } from '@/types/api';
import { formatDecimal, formatNumber } from '@/utils/format';

function SweepTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as unknown as (KSweepEntry & { isOptimal?: boolean }) | undefined;
  if (!entry) return null;
  return (
    <TooltipShell
      title={`K = ${label}`}
      subtitle={entry.isOptimal ? 'Highest silhouette in the sweep' : undefined}
      rows={[
        { label: 'Silhouette', value: formatDecimal(entry.silhouette, 4) },
        { label: 'Inertia', value: formatNumber(entry.inertia) },
      ]}
    />
  );
}

export function SilhouetteChart({ sweep, currentK }: { sweep: KSweepEntry[]; currentK?: number | null }) {
  if (!sweep.length) {
    return <ChartEmpty message="Cluster quality needs at least two usable K values." height={260} />;
  }

  const optimal = sweep.reduce((best, entry) => (entry.silhouette > best.silhouette ? entry : best), sweep[0]);
  const data = sweep.map((entry) => ({ ...entry, isOptimal: entry.k === optimal.k }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="k" {...axisProps} tickFormatter={(value: number) => `K=${value}`} label={{ value: 'Number of clusters (K)', position: 'insideBottom', offset: -4, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
          <YAxis {...axisProps} width={56} tickFormatter={(value: number) => formatDecimal(value, 2)} domain={['auto', 'auto']} />
          <Tooltip content={<SweepTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 4" />
          {typeof currentK === 'number' ? (
            <ReferenceLine
              x={currentK}
              stroke={chartColors.accent}
              strokeDasharray="4 4"
              label={{ value: 'selected K', position: 'top', fill: chartColors.accent, fontSize: 10 }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="silhouette"
            name="Silhouette"
            stroke={chartColors.primary}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: chartColors.primary }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={optimal.k}
            y={optimal.silhouette}
            r={6}
            fill={chartColors.warning}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        The highlighted point is the highest silhouette score in the sweep (K = {optimal.k}, score{' '}
        {formatDecimal(optimal.silhouette, 4)}). A higher score means transactions sit closer to their own cluster
        than to neighbouring clusters — but it is a diagnostic signal, not proof that one K is objectively correct.
      </p>
    </div>
  );
}
