import { Boxes, Braces, Gauge, Layers, Scale, Scissors } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ExplainedVarianceChart } from '@/components/charts/ExplainedVarianceChart';
import { SilhouetteChart } from '@/components/charts/SilhouetteChart';
import { ChartFrame } from '@/components/charts/primitives';
import { Metric, PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from '@/components/ui/table';
import { useDataset } from '@/hooks/useDataset';
import { cn } from '@/lib/utils';
import { formatDecimal, formatNumber, formatPercent } from '@/utils/format';

interface SummaryCard {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}

export function ModelPage() {
  const { dataset, model, clusters, runClusters } = useDataset();

  if (!dataset || !model) return null;

  const metrics = clusters?.metrics ?? model.metrics;
  const activeK = metrics?.k ?? model.selected_k;

  const cards: SummaryCard[] = [
    { icon: Boxes, label: 'Algorithm', value: model.algorithm, detail: model.algorithm_detail },
    { icon: Scale, label: 'Preprocessing', value: 'StandardScaler', detail: model.preprocessing_detail },
    { icon: Scissors, label: 'Dimensionality reduction', value: 'PCA (2 components)', detail: model.dimensionality_reduction_detail },
    { icon: Gauge, label: 'Evaluation', value: 'Silhouette score', detail: 'Computed on the standardised feature matrix for every K in the sweep.' },
    { icon: Layers, label: 'Active clusters', value: activeK ? `K = ${activeK}` : '—', detail: `Sweep range ${model.hyperparameters.k_range} · best silhouette at K = ${model.optimal_k ?? '—'}.` },
    { icon: Braces, label: 'Features', value: `${model.features.length} engineered`, detail: 'Behavioural features are described in the table below.' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model information"
        description="What the clustering pipeline does, which features it uses, and how to read its diagnostics. Nothing here is trained on external data — the model is fitted on the uploaded transactions each time."
        meta={
          <>
            <Badge variant="outline">{formatNumber(model.total_transactions)} transactions available</Badge>
            {model.optimal_k ? <Badge variant="accent">Highest silhouette at K = {model.optimal_k}</Badge> : null}
            {model.clustering_available ? (
              <Badge variant="positive">Clustering available</Badge>
            ) : (
              <Badge variant="warning">Clustering unavailable</Badge>
            )}
          </>
        }
      />

      {!model.clustering_available && model.unavailable_reason ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning">
          {model.unavailable_reason}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <p className="label-caps">{card.label}</p>
              </div>
              <p className="mt-2 text-sm font-semibold">{card.value}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{card.detail}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <ChartFrame
          className="xl:col-span-2"
          title="Cluster quality: K versus silhouette score"
          description="Diagnostics only. Return to the clusters page to apply a different K."
          actions={
            model.optimal_k ? (
              <Segmented<number>
                size="sm"
                ariaLabel="Evaluate a K"
                value={activeK ?? model.optimal_k}
                onChange={(value) => void runClusters(value)}
                options={(model.sweep.length
                  ? model.sweep.map((entry) => entry.k)
                  : [2, 3, 4, 5, 6, 7, 8]
                ).map((value) => ({ value, label: `K${value}` }))}
              />
            ) : null
          }
        >
          <SilhouetteChart sweep={model.sweep} currentK={activeK} />
        </ChartFrame>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Fitted diagnostics</CardTitle>
              <CardDescription>Values from the most recent fit (K = {activeK ?? '—'}).</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Silhouette" value={metrics ? formatDecimal(metrics.silhouette, 4) : '—'} hint="-1 to 1, higher is better separated" />
              <Metric label="Inertia" value={metrics ? formatNumber(metrics.inertia) : '—'} hint="Within-cluster squared distance" />
              <Metric label="Iterations" value={metrics ? formatNumber(metrics.iterations) : '—'} hint="Lloyd steps until convergence" />
              <Metric
                label="PCA variance"
                value={metrics ? formatPercent(metrics.explained_variance_total * 100) : '—'}
                hint="Explained by PC1 + PC2"
              />
              <Metric label="Samples" value={metrics ? formatNumber(metrics.n_samples) : '—'} hint="Transactions clustered" />
              <Metric label="Features" value={metrics ? formatNumber(metrics.n_features) : '—'} hint="Numeric dimensions" />
            </div>
            <div className="space-y-2 border-t border-border/70 pt-3">
              <p className="label-caps">Hyperparameters</p>
              <dl className="space-y-1.5">
                {Object.entries(model.hyperparameters).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-[11px]">
                    <dt className="font-mono text-muted-foreground">{key}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>What the metrics mean</CardTitle>
              <CardDescription>Plain-English definitions, including their limits.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {model.explanations.map((explanation) => (
              <div key={explanation.name} className="space-y-1.5 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{explanation.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {explanation.value === null
                      ? '—'
                      : explanation.display === 'percent'
                        ? formatPercent(explanation.value)
                        : explanation.display === 'score'
                          ? formatDecimal(explanation.value, 4)
                          : formatNumber(explanation.value)}
                  </p>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{explanation.meaning}</p>
                {explanation.caution ? (
                  <p className={cn('text-[11px] leading-relaxed text-warning')}>{explanation.caution}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <ChartFrame title="PCA explained variance" description="How much of the feature space the 2D projection retains.">
            <ExplainedVarianceChart explainedVariance={metrics?.explained_variance ?? []} />
          </ChartFrame>

          <Card>
            <CardHeader>
              <div className="space-y-1">
                <CardTitle>K sweep table</CardTitle>
                <CardDescription>Inertia always falls with K; the silhouette score does not.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>K</TableHead>
                      <TableHead className="text-right">Silhouette</TableHead>
                      <TableHead className="text-right">Inertia</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.sweep.map((entry) => (
                      <TableRow key={entry.k}>
                        <TableCell className="font-medium">{entry.k}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDecimal(entry.silhouette, 4)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatNumber(entry.inertia)}
                        </TableCell>
                        <TableCell className="text-right text-[11px] text-muted-foreground">
                          {entry.k === model.optimal_k ? 'highest silhouette' : entry.k === activeK ? 'currently applied' : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Feature engineering</CardTitle>
            <CardDescription>
              Six numeric features describe each transaction before standardisation. Raw rows are never clustered
              directly.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Feature</TableHead>
                  <TableHead>Derived from</TableHead>
                  <TableHead>Why it matters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.features.map((feature) => (
                  <TableRow key={feature.name}>
                    <TableCell className="min-w-[160px]">
                      <span className="block text-sm font-medium">{feature.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{feature.name}</span>
                    </TableCell>
                    <TableCell className="min-w-[120px] font-mono text-[11px] text-muted-foreground">
                      {feature.source}
                    </TableCell>
                    <TableCell className="min-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
                      {feature.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>
    </div>
  );
}
