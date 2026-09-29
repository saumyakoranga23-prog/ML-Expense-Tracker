import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { CategoryBarChart } from '@/components/charts/CategoryBarChart';
import { CategoryDonut } from '@/components/charts/CategoryDonut';
import { CategoryTrendChart } from '@/components/charts/CategoryTrendChart';
import { ChartFrame } from '@/components/charts/primitives';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from '@/components/ui/table';
import { useDataset } from '@/hooks/useDataset';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/format';

export function SpendingAnalysisPage() {
  const { dataset } = useDataset();
  const navigate = useNavigate();
  const [donutLimit, setDonutLimit] = useState<6 | 8 | 12>(8);

  const categories = useMemo(() => dataset?.summary.categories ?? [], [dataset]);
  const totals = useMemo(
    () => ({
      spending: categories.reduce((total, category) => total + category.total_spending, 0),
      transactions: categories.reduce((total, category) => total + category.transactions, 0),
    }),
    [categories],
  );

  if (!dataset) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Spending analysis"
        description="Category-level breakdowns across the whole dataset: how much each category absorbs, how often it appears, and how the monthly profile moves."
        meta={
          <>
            <Badge variant="outline">{categories.length} categories</Badge>
            <Badge variant="outline">{formatNumber(totals.transactions)} expense transactions</Badge>
            <Badge variant="neutral">{formatCurrency(totals.spending)} total spending</Badge>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartFrame
          title="Category share of spending"
          description="Click a category to jump to its transactions."
          actions={
            <Segmented<6 | 8 | 12>
              size="sm"
              ariaLabel="Number of slices"
              value={donutLimit}
              onChange={setDonutLimit}
              options={[
                { value: 6, label: '6' },
                { value: 8, label: '8' },
                { value: 12, label: '12' },
              ]}
            />
          }
        >
          <CategoryDonut
            categories={categories}
            limit={donutLimit}
            onSelect={(category) => navigate('/transactions', { state: { category } })}
          />
        </ChartFrame>

        <ChartFrame
          title="Spending by category"
          description="Ranked by total expense value. Values come straight from the cleaned dataset."
        >
          <CategoryBarChart categories={categories} limit={10} />
        </ChartFrame>
      </section>

      <ChartFrame
        title="Monthly category trend"
        description="Month-by-month spending for the largest categories. Toggle the series to compare shapes."
        footer="Months without activity are plotted as zero rather than omitted, so gaps are visible."
      >
        <CategoryTrendChart categories={categories} maxSeries={6} />
      </ChartFrame>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Category detail</CardTitle>
            <CardDescription>
              Share, frequency, average transaction size and the change between the recent and previous three-month
              windows.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TableShell>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Spending</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Largest</TableHead>
                  <TableHead className="text-right">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const rising = category.trend_change > 0.5;
                  const falling = category.trend_change < -0.5;
                  return (
                    <TableRow key={category.category}>
                      <TableCell className="min-w-[160px]">
                        <button
                          type="button"
                          className="text-left text-sm transition-colors hover:text-primary"
                          onClick={() => navigate('/transactions', { state: { category: category.category } })}
                        >
                          {category.category}
                        </button>
                        <div className="mt-1 h-1 w-32 max-w-full overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, category.share)}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(category.total_spending)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPercent(category.share)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(category.transactions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(category.average_transaction)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(category.largest_transaction)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs tabular-nums',
                            rising && 'text-negative',
                            falling && 'text-positive',
                            !rising && !falling && 'text-muted-foreground',
                          )}
                        >
                          {rising ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : null}
                          {falling ? <TrendingDown className="h-3 w-3" aria-hidden="true" /> : null}
                          {formatPercent(category.trend_change)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Trend compares the last three months with the three before them. It is a descriptive comparison of the
            dataset, not a forecast.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
