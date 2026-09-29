import { useMemo, useState } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartEmpty, TooltipShell, type ChartTooltipProps } from '@/components/charts/primitives';
import { axisProps, clusterColor, gridProps } from '@/components/charts/theme';
import type { Centroid, ClusterPoint, ClusterStat } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatDecimal, formatNumber } from '@/utils/format';

interface ScatterPayload extends ClusterPoint {
  centroid?: boolean;
}

function ScatterTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as unknown as ScatterPayload | undefined;
  if (!point) return null;

  if (point.centroid) {
    return (
      <TooltipShell
        title={`${point.cluster_label} centroid`}
        subtitle="Centre of the cluster in PCA space"
        rows={[
          { label: 'PC1', value: formatDecimal(point.x, 3) },
          { label: 'PC2', value: formatDecimal(point.y, 3) },
        ]}
      />
    );
  }

  return (
    <TooltipShell
      title={point.description}
      subtitle={`${formatDate(point.date)} · ${point.category}`}
      rows={[
        { label: 'Amount', value: formatCurrency(point.amount) },
        { label: 'Type', value: point.flow === 'income' ? 'Income' : 'Expense' },
        { label: 'Cluster', value: `${point.cluster} · ${point.cluster_label}` },
        { label: 'PC1 / PC2', value: `${formatDecimal(point.x, 2)} / ${formatDecimal(point.y, 2)}` },
      ]}
    />
  );
}

export function ClusterScatter({
  points,
  clusters,
  centroids,
  explainedVariance,
}: {
  points: ClusterPoint[];
  clusters: ClusterStat[];
  centroids: Centroid[];
  explainedVariance: number[];
}) {
  const [hidden, setHidden] = useState<number[]>([]);

  const ordered = useMemo(() => {
    const labels = new Map(clusters.map((cluster) => [cluster.cluster, cluster.label]));
    return clusters.map((cluster) => ({
      cluster,
      label: labels.get(cluster.cluster) ?? `Cluster ${cluster.cluster}`,
      points: points.filter((point) => point.cluster === cluster.cluster),
    }));
  }, [clusters, points]);

  if (!points.length) return <ChartEmpty message="Run the clustering model to plot spending profiles." height={360} />;

  const centroidPoints: ScatterPayload[] = centroids.map((centroid) => ({
    transaction_id: -1,
    x: centroid.x,
    y: centroid.y,
    cluster: centroid.cluster,
    cluster_label: centroid.label,
    amount: 0,
    description: `${centroid.label} centroid`,
    category: '',
    date: '',
    flow: 'expense',
    centroid: true,
  }));

  const toggle = (cluster: number) => {
    setHidden((current) =>
      current.includes(cluster) ? current.filter((entry) => entry !== cluster) : [...current, cluster],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ordered.map(({ cluster }) => {
          const active = !hidden.includes(cluster.cluster);
          return (
            <button
              key={cluster.cluster}
              type="button"
              onClick={() => toggle(cluster.cluster)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                active ? 'border-border bg-surface-muted text-foreground' : 'border-border/60 text-muted-foreground',
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: clusterColor(cluster.cluster), opacity: active ? 1 : 0.3 }}
                aria-hidden="true"
              />
              <span className="font-medium">{cluster.label}</span>
              <span className="text-muted-foreground">{formatNumber(cluster.size)}</span>
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 12, right: 20, bottom: 24, left: 8 }}>
          <CartesianGrid {...gridProps} vertical />
          <XAxis
            type="number"
            dataKey="x"
            name="PC1"
            {...axisProps}
            tickFormatter={(value: number) => formatDecimal(value, 1)}
            label={{
              value: `PCA component 1 (${formatDecimal((explainedVariance[0] ?? 0) * 100, 1)}% of variance)`,
              position: 'insideBottom',
              offset: -14,
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="PC2"
            {...axisProps}
            tickFormatter={(value: number) => formatDecimal(value, 1)}
            width={64}
            label={{
              value: `PC2 (${formatDecimal((explainedVariance[1] ?? 0) * 100, 1)}%)`,
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
            }}
          />
          <ReferenceLine x={0} stroke="hsl(var(--border))" strokeDasharray="2 4" />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 4" />
          <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          {ordered
            .filter(({ cluster }) => !hidden.includes(cluster.cluster))
            .map(({ cluster, points: clusterPoints }) => (
              <Scatter
                key={cluster.cluster}
                name={cluster.label}
                data={clusterPoints}
                fill={clusterColor(cluster.cluster)}
                fillOpacity={0.72}
                isAnimationActive={false}
              />
            ))}
          <Scatter
            name="Centroids"
            data={centroidPoints}
            fill="hsl(var(--foreground))"
            shape="diamond"
            legendType="diamond"
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Each point is one transaction placed by PCA on the first two principal components of the six behavioural
        features. Diamond markers show cluster centroids. The two components together explain{' '}
        {formatDecimal((explainedVariance.reduce((total, value) => total + value, 0) ?? 0) * 100, 1)}% of the
        variance in the feature space, so nearby points behave similarly across all features — not only here.
      </p>
    </div>
  );
}
