import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CategoryDonut } from '@/components/charts/CategoryDonut';
import { IncomeExpenseChart } from '@/components/charts/IncomeExpenseChart';
import { MonthlySpendChart } from '@/components/charts/MonthlySpendChart';
import { VolumeChart } from '@/components/charts/VolumeChart';
import { ChartFrame } from '@/components/charts/primitives';
import { CleaningReportPanel } from '@/components/dashboard/CleaningReportPanel';
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { Metric, PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from '@/components/ui/table';
import { useDataset } from '@/hooks/useDataset';
import { formatCurrency, formatDate, formatNumber, formatPercent, formatRange } from '@/utils/format';

export function DashboardPage() {
  const { dataset } = useDataset();
  const navigate = useNavigate();
  const [monthlyView, setMonthlyView] = useState<'trend' | 'flow'>('trend');

  const summary = dataset?.summary;
  const busiestMonth = useMemo(() => {
    if (!summary?.monthly.length) return null;
    return summary.monthly.reduce((max, point) => (point.expense > max.expense ? point : max), summary.monthly[0]);
  }, [summary]);

  if (!dataset || !summary) return null;

  const { kpis, categories, top_merchants: merchants, monthly, volume } = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial overview"
        description="Every number below is computed from the dataset currently loaded: totals, monthly series, category breakdowns and transaction volume."
        meta={
          <>
            <Badge variant="neutral">{dataset.source === 'demo' ? 'Demo dataset' : 'Uploaded CSV'}</Badge>
            <Badge variant="outline">
              {formatNumber(kpis.transaction_count)} transactions · {kpis.months_covered} months
            </Badge>
            <Badge variant="outline">{formatRange(kpis.first_date, kpis.last_date)}</Badge>
            {dataset.cleaning.rows_removed > 0 ? (
              <Badge variant="warning">{formatNumber(dataset.cleaning.rows_removed)} rows rejected in cleaning</Badge>
            ) : null}
          </>
        }
      />

      <KpiGrid kpis={kpis} />

      <section className="grid min-w-0 gap-5 xl:grid-cols-3">
        <ChartFrame
          className="xl:col-span-2"
          title={monthlyView === 'trend' ? 'Monthly spending trend' : 'Monthly income versus spending'}
          description={
            monthlyView === 'trend'
              ? 'Expenses per month, with income available as an overlay.'
              : 'Grouped bars per month with the net cash-flow line on top.'
          }
          actions={
            <Segmented<'trend' | 'flow'>
              size="sm"
              ariaLabel="Monthly chart view"
              value={monthlyView}
              onChange={setMonthlyView}
              options={[
                { value: 'trend', label: 'Spending' },
                { value: 'flow', label: 'Income vs spend' },
              ]}
            />
          }
          footer={
            busiestMonth
              ? `Highest spending month: ${busiestMonth.label} at ${formatCurrency(busiestMonth.expense)}. Average monthly spending across the period is ${formatCurrency(kpis.average_monthly_spending)}.`
              : undefined
          }
        >
          {monthlyView === 'trend' ? <MonthlySpendChart data={monthly} /> : <IncomeExpenseChart data={monthly} />}
        </ChartFrame>

        <ChartFrame
          title="Spending by category"
          description="Share of total expenses per category. Select a category to open it in the explorer."
        >
          <CategoryDonut categories={categories} onSelect={(category) => navigate('/transactions', { state: { category } })} />
        </ChartFrame>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-3">
        <ChartFrame
          className="xl:col-span-2"
          title="Transaction volume over time"
          description="Number of transactions per month, stacked by direction."
          footer="Volume is counted from the cleaned dataset, so rejected rows never inflate the count."
        >
          <VolumeChart data={volume} />
        </ChartFrame>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Distribution insight</CardTitle>
              <CardDescription>Where the money and the transactions actually sit.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Average expense" value={formatCurrency(kpis.average_expense)} hint="Mean of expense rows" />
              <Metric label="Median expense" value={formatCurrency(kpis.median_expense)} hint="Half of expenses below" />
              <Metric label="Average transaction" value={formatCurrency(kpis.average_transaction)} hint="Income and expenses" />
              <Metric
                label="Savings rate"
                value={formatPercent(kpis.savings_rate)}
                hint="Net cash flow over income"
                tone={kpis.savings_rate >= 0 ? 'positive' : 'negative'}
              />
            </div>
            <div className="space-y-2 border-t border-border/70 pt-3">
              <p className="label-caps">Largest expense</p>
              <p className="text-sm font-medium">{kpis.largest_expense_description ?? '—'}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(kpis.largest_expense)} · {kpis.largest_expense_category ?? 'Uncategorised'} ·{' '}
                {formatDate(kpis.largest_expense_date)}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Top merchants by spending</CardTitle>
              <CardDescription>Aggregated from the cleaned description column.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Merchant</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Average</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchants.map((merchant) => (
                    <TableRow key={`${merchant.description}-${merchant.category}`}>
                      <TableCell className="max-w-[220px] truncate text-sm" title={merchant.description}>
                        {merchant.description}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{merchant.category}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(merchant.transactions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(merchant.average_transaction)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(merchant.total_spending)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          </CardContent>
        </Card>

        <CleaningReportPanel report={summary.cleaning} />
      </section>
    </div>
  );
}
