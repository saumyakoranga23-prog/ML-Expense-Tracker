import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/common/PageHeader';
import { InsightCard } from '@/components/insights/InsightCard';
import { CleaningReportPanel } from '@/components/dashboard/CleaningReportPanel';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState } from '@/components/ui/states';
import { useDataset } from '@/hooks/useDataset';
import type { InsightGroup } from '@/types/api';
import { formatDate } from '@/utils/format';

type GroupFilter = 'all' | InsightGroup;

export function InsightsPage() {
  const { dataset, insights } = useDataset();
  const [group, setGroup] = useState<GroupFilter>('all');

  const availableGroups = useMemo(() => {
    const groups = new Set<InsightGroup>();
    insights?.insights.forEach((insight) => groups.add(insight.group));
    return groups;
  }, [insights]);

  const visible = useMemo(() => {
    if (!insights) return [];
    return group === 'all' ? insights.insights : insights.insights.filter((insight) => insight.group === group);
  }, [insights, group]);

  if (!dataset) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Spending insights"
        description="Findings calculated directly from the processed dataset. Nothing here is generated advice: every sentence is backed by the metrics listed beneath it."
        meta={
          insights ? (
            <>
              <Badge variant="outline">{insights.insights.length} findings</Badge>
              {insights.cluster_based ? (
                <Badge variant="accent">Cluster insights from K = {insights.cluster_k}</Badge>
              ) : (
                <Badge variant="warning">Run clustering to unlock cluster findings</Badge>
              )}
              <Badge variant="neutral">Generated {formatDate(insights.generated_at.slice(0, 10))}</Badge>
            </>
          ) : null
        }
      />

      {insights && insights.insights.length > 0 ? (
        <>
          <Segmented<GroupFilter>
            ariaLabel="Filter insights by group"
            value={group}
            onChange={setGroup}
            options={[
              { value: 'all', label: `All (${insights.insights.length})` },
              ...(['category', 'trend', 'cluster', 'spending', 'income', 'behaviour'] as InsightGroup[])
                .filter((entry) => availableGroups.has(entry))
                .map((entry) => ({
                  value: entry,
                  label: `${entry.charAt(0).toUpperCase()}${entry.slice(1)} (${
                    insights.insights.filter((insight) => insight.group === entry).length
                  })`,
                })),
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No insights could be derived"
          description="Insights require at least a few transactions spread across more than one period. Upload a longer history to unlock them."
        />
      )}

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h3 className="text-sm font-semibold">How these insights are produced</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Each finding is a rule over computed statistics: category concentration and shares, month-over-month changes
            in average transaction size, the recent-versus-previous three-month window, the share of months in which a
            category appears, weekend versus weekday daily value, three-sigma outliers from the expense distribution,
            and the spending-versus-size gap between clusters. Thresholds decide whether a statement is shown at all,
            but never change the number it reports.
          </p>
        </CardContent>
      </Card>

      <CleaningReportPanel report={dataset.summary.cleaning} />
    </div>
  );
}
