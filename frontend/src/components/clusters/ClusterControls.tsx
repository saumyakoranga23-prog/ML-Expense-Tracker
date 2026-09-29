import { RefreshCw, Save } from 'lucide-react';

import { Metric } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import type { ClusterResponse } from '@/types/api';
import { formatDecimal, formatNumber } from '@/utils/format';

export function ClusterControls({
  k,
  onChange,
  onRun,
  running,
  clusters,
  optimalK,
  minK = 2,
  maxK = 8,
  clusteringAvailable = true,
  unavailableReason,
}: {
  k: number;
  onChange: (value: number) => void;
  onRun: () => void;
  running: boolean;
  clusters: ClusterResponse | null;
  optimalK: number | null;
  minK?: number;
  maxK?: number;
  clusteringAvailable?: boolean;
  unavailableReason?: string | null;
}) {
  const options = Array.from({ length: maxK - minK + 1 }, (_, index) => minK + index);
  const dirty = clusters ? clusters.k !== k : false;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps">Number of clusters</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose K between {minK} and {maxK}. Changing K re-runs K-Means on the same behavioural features.
            </p>
          </div>
          <Segmented<number>
            ariaLabel="Number of clusters"
            value={k}
            onChange={onChange}
            options={options.map((value) => ({ value, label: value, title: `K = ${value}` }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onRun} loading={running} disabled={!clusteringAvailable}>
            {dirty ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {dirty ? `Run clustering with K = ${k}` : `Cluster with K = ${k}`}
          </Button>
          {optimalK ? (
            <Button variant="ghost" size="sm" onClick={() => onChange(optimalK)} disabled={optimalK === k}>
              Use highest silhouette (K = {optimalK})
            </Button>
          ) : null}
          {clusters?.cached ? <Badge variant="neutral">Served from cache</Badge> : null}
          {clusters?.points_sampled ? <Badge variant="warning">Scatter plot sampled</Badge> : null}
        </div>

        {!clusteringAvailable ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning">
            {unavailableReason ?? 'This dataset does not have enough usable transactions for clustering.'}
          </p>
        ) : null}

        {clusters ? (
          <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4 sm:grid-cols-4">
            <Metric label="Clusters" value={formatNumber(clusters.clusters.length)} hint={`K = ${clusters.k}`} />
            <Metric label="Silhouette" value={formatDecimal(clusters.metrics.silhouette, 3)} hint="Higher is better separated" />
            <Metric label="Inertia" value={formatNumber(clusters.metrics.inertia)} hint="Within-cluster distance" />
            <Metric
              label="PCA variance"
              value={`${formatDecimal(clusters.metrics.explained_variance_total * 100, 1)}%`}
              hint="Captured by PC1 + PC2"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
