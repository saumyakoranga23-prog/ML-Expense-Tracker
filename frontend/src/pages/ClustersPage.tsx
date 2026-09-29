import { useState } from 'react';

import { ClusterScatter } from '@/components/charts/ClusterScatter';
import { SilhouetteChart } from '@/components/charts/SilhouetteChart';
import { ChartFrame } from '@/components/charts/primitives';
import { ClusterCard } from '@/components/clusters/ClusterCard';
import { ClusterControls } from '@/components/clusters/ClusterControls';
import { InfoNote, PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { useDataset } from '@/hooks/useDataset';
import { formatDecimal, formatNumber, formatPercent } from '@/utils/format';

export function ClustersPage() {
  const { dataset, clusters, model, k, runClusters, status } = useDataset();
  const [pendingK, setPendingK] = useState<number | null>(null);

  if (!dataset) return null;

  const clusteringAvailable = clusters !== null || model?.clustering_available !== false;
  const selectedK = pendingK ?? k;
  const running = status === 'clustering';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Spending clusters"
        description="K-Means partitions transactions by six engineered behavioural features. Labels, dominant categories and frequency bands are derived from the fitted centroids, not pre-assigned."
        meta={
          clusters ? (
            <>
              <Badge variant="accent">K = {clusters.k}</Badge>
              <Badge variant="outline">Silhouette {formatDecimal(clusters.metrics.silhouette, 3)}</Badge>
              <Badge variant="outline">Inertia {formatNumber(clusters.metrics.inertia)}</Badge>
              {clusters.metrics.silhouette_sampled ? (
                <Badge variant="warning">
                  Silhouette sampled at {formatNumber(clusters.metrics.silhouette_sample_size)} rows
                </Badge>
              ) : null}
            </>
          ) : null
        }
      />

      <ClusterControls
        k={selectedK}
        onChange={(value) => setPendingK(value)}
        onRun={() => void runClusters(selectedK)}
        running={running}
        clusters={clusters}
        optimalK={clusters?.optimal_k ?? model?.optimal_k ?? null}
        clusteringAvailable={clusteringAvailable}
        unavailableReason={model?.unavailable_reason}
      />

      {clusters ? (
        <>
          <ChartFrame
            title="PCA cluster map"
            description="Each point is one transaction projected onto the first two principal components of the behavioural features."
            actions={<Badge variant="neutral">{formatNumber(clusters.total_points)} transactions clustered</Badge>}
          >
            <ClusterScatter
              points={clusters.points}
              clusters={clusters.clusters}
              centroids={clusters.centroids}
              explainedVariance={clusters.metrics.explained_variance}
            />
          </ChartFrame>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight">Cluster analysis</h3>
              <p className="text-[11px] text-muted-foreground">
                {clusters.clusters.length} clusters · {formatPercent(
                  clusters.clusters.reduce((total, cluster) => total + cluster.percentage, 0),
                )}{' '}
                of transactions accounted for
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {clusters.clusters.map((cluster) => (
                <ClusterCard
                  key={cluster.cluster}
                  cluster={cluster}
                  maxSpendShare={Math.max(...clusters.clusters.map((entry) => entry.spend_share))}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <ChartFrame
              title="Cluster quality across K"
              description="Silhouette score for K = 2…8 computed on the standardised feature matrix."
            >
              <SilhouetteChart sweep={clusters.sweep} currentK={clusters.k} />
            </ChartFrame>

            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle>Cluster centroids in feature space</CardTitle>
                  <CardDescription>
                    Standardised (z-scored) centroid coordinates show which features pull each cluster apart.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-[11px]">
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">Feature</th>
                        {clusters.clusters.map((cluster) => (
                          <th key={cluster.cluster} className="px-2 py-2 text-right font-medium" title={cluster.label}>
                            C{cluster.cluster}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clusters.metrics.feature_names.map((feature) => (
                        <tr key={feature} className="border-b border-border/50 last:border-0">
                          <td className="px-2 py-1.5 font-mono text-muted-foreground">{feature}</td>
                          {clusters.clusters.map((cluster) => {
                            const value = cluster.feature_z_scores[feature] ?? 0;
                            return (
                              <td
                                key={`${feature}-${cluster.cluster}`}
                                className="px-2 py-1.5 text-right tabular-nums"
                                style={{
                                  color: value > 0.5 ? 'hsl(var(--positive))' : value < -0.5 ? 'hsl(var(--negative))' : undefined,
                                }}
                              >
                                {value.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-1.5 border-t border-border/70 pt-3">
                  {clusters.clusters.map((cluster) => (
                    <p key={cluster.cluster} className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">C{cluster.cluster}</span> · {cluster.label} ·{' '}
                      {formatNumber(cluster.size)} rows · {formatPercent(cluster.percentage)} of transactions ·{' '}
                      {formatPercent(cluster.spend_share)} of spending
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <InfoNote>
            K-Means always returns exactly K clusters, so the labels describe the partition it found — they do not prove
            that spending really has {clusters.k} natural modes. Compare the silhouette sweep and the centroid table
            above before treating any configuration as final.
          </InfoNote>
        </>
      ) : (
        <EmptyState
          title="Clustering is not available for this dataset"
          description={
            model?.unavailable_reason ??
            'The dataset needs at least eight usable transactions before K-Means can build spending profiles.'
          }
        />
      )}
    </div>
  );
}
