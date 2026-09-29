import { BarChart3, Boxes, FileSpreadsheet, LineChart, Lock, Sparkles } from 'lucide-react';

import { UploadPanel } from '@/components/upload/UploadPanel';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: 'Intelligent CSV ingestion',
    body: 'Column names are detected from real bank exports, including Txn Date / Narration / Withdrawal Amt. styles, signed amounts or separate debit and credit columns.',
  },
  {
    icon: Boxes,
    title: 'K-Means spending clusters',
    body: 'Six engineered behavioural features per transaction, standardised with StandardScaler and clustered with K-Means for K = 2…8.',
  },
  {
    icon: BarChart3,
    title: 'PCA-projected visualisation',
    body: 'Every profile is placed on the first two principal components, with centroids marked so the geometry of the partition is visible.',
  },
  {
    icon: LineChart,
    title: 'Deterministic insights',
    body: 'Category concentration, month-over-month momentum, recurring baselines and cluster imbalance — all computed from your data, never invented.',
  },
  {
    icon: Lock,
    title: 'Safe by construction',
    body: 'File type and size validation, safe CSV parsing, no shell execution and CORS locked to configured origins. Datasets stay in memory only.',
  },
  {
    icon: Sparkles,
    title: 'Auditable cleaning',
    body: 'Invalid dates, unreadable amounts, duplicates and filled values are reported line by line, so nothing is silently changed.',
  },
];

const PIPELINE = [
  { step: '01', title: 'Upload', body: 'Drop a CSV export or load the packaged demo dataset.' },
  { step: '02', title: 'Clean', body: 'Rows are normalised, validated and audited.' },
  { step: '03', title: 'Analyse', body: 'KPIs, monthly series and category breakdowns.' },
  { step: '04', title: 'Cluster', body: 'K-Means with PCA, silhouette scoring and labels.' },
];

export function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <div className="space-y-5">
          <Badge variant="accent" className="w-fit">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Data science portfolio project
          </Badge>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Turn transaction data into actionable spending patterns.
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            LedgerLens reads a transaction CSV, cleans and validates every row, then clusters spending behaviour with
            K-Means over engineered features. The result is a dashboard where each metric, chart and sentence can be
            traced back to a calculation on your own data.
          </p>
          <dl className="grid gap-4 pt-2 sm:grid-cols-3">
            {[
              { label: 'Behavioural features', value: '6' },
              { label: 'Cluster range', value: 'K = 2…8' },
              { label: 'Metrics explained', value: 'Silhouette + inertia' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-surface/60 px-3 py-2.5">
                <dt className="label-caps">{item.label}</dt>
                <dd className="metric-value mt-1 text-sm">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Card className="min-w-0">
          <CardContent className="pt-5">
            <UploadPanel />
          </CardContent>
        </Card>
      </section>

      <section aria-label="Pipeline" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE.map((item) => (
          <Card key={item.step} className="p-4">
            <span className="font-mono text-[11px] text-primary">{item.step}</span>
            <p className="mt-2 text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.body}</p>
          </Card>
        ))}
      </section>

      <section aria-label="Capabilities" className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">What the dashboard does</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="p-5">
                <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">{feature.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{feature.body}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-label="Expected CSV shape" className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Expected CSV columns</h2>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Only a date and an amount are strictly required — everything else is detected heuristically. The parser also
          accepts separate debit and credit columns, signed amounts, currency symbols, thousands separators and
          accounting-style negatives such as <span className="font-mono">(450.00)</span>.
        </p>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Column</th>
                <th className="px-4 py-2 font-medium">Accepted aliases</th>
                <th className="px-4 py-2 font-medium">Required</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px]">
              {[
                { column: 'date', aliases: 'date, txn_date, transaction_date, posted_date, value_date', required: 'Yes' },
                { column: 'amount', aliases: 'amount, amt, value, amount_inr — or debit/credit pair', required: 'Yes' },
                { column: 'description', aliases: 'description, narration, particulars, merchant, payee', required: 'No' },
                { column: 'category', aliases: 'category, category_name, spend_category, tag', required: 'No' },
                { column: 'transaction_type', aliases: 'type, txn_type, dr_cr, debit_credit, direction', required: 'No' },
              ].map((row) => (
                <tr key={row.column} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 text-foreground">{row.column}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.aliases}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
