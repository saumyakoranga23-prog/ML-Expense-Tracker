import { ShieldCheck } from 'lucide-react';

import { Metric } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { CleaningReport } from '@/types/api';
import { formatNumber } from '@/utils/format';

const CONFIDENCE_VARIANT = {
  exact: 'positive',
  alias: 'info',
  heuristic: 'warning',
  missing: 'negative',
} as const;

/** Shows exactly what the cleaning pipeline changed, including rejected rows. */
export function CleaningReportPanel({ report }: { report: CleaningReport }) {
  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Data quality report
          </CardTitle>
          <CardDescription>
            {formatNumber(report.rows_read)} rows read · {formatNumber(report.rows_clean)} usable after cleaning
          </CardDescription>
        </div>
        <Badge variant={report.rows_removed > 0 ? 'warning' : 'positive'}>
          {report.rows_removed > 0 ? `${formatNumber(report.rows_removed)} rows rejected` : 'No rows rejected'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Rows read" value={formatNumber(report.rows_read)} />
          <Metric label="Usable rows" value={formatNumber(report.rows_clean)} />
          <Metric label="Invalid dates" value={formatNumber(report.invalid_date_rows)} tone={report.invalid_date_rows ? 'warning' : 'default'} />
          <Metric label="Invalid amounts" value={formatNumber(report.invalid_amount_rows)} tone={report.invalid_amount_rows ? 'warning' : 'default'} />
          <Metric label="Duplicates removed" value={formatNumber(report.duplicate_rows_removed)} tone={report.duplicate_rows_removed ? 'warning' : 'default'} />
        </div>

        <div className="space-y-2">
          <p className="label-caps">Detected columns</p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {report.detected_columns.map((column) => (
              <li
                key={column.field}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted/50 px-2.5 py-1.5 text-[11px]"
              >
                <span className="font-mono text-muted-foreground">{column.field}</span>
                <span className="min-w-0 truncate font-medium" title={column.source_column ?? 'not found'}>
                  {column.source_column ?? 'not found'}
                </span>
                <Badge variant={CONFIDENCE_VARIANT[column.confidence]}>{column.confidence}</Badge>
              </li>
            ))}
          </ul>
        </div>

        {report.issues.length > 0 ? (
          <div className="space-y-2">
            <p className="label-caps">
              Rejected or flagged rows ({formatNumber(report.issues.length)}
              {report.truncated_issues > 0 ? ` of ${formatNumber(report.issues.length + report.truncated_issues)}` : ''})
            </p>
            <div className="max-h-52 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-surface-muted/90 backdrop-blur">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium text-muted-foreground">Line</th>
                    <th className="px-2.5 py-1.5 font-medium text-muted-foreground">Column</th>
                    <th className="px-2.5 py-1.5 font-medium text-muted-foreground">Value</th>
                    <th className="px-2.5 py-1.5 font-medium text-muted-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.map((issue, index) => (
                    <tr key={`${issue.row}-${issue.column}-${index}`} className="border-t border-border/60">
                      <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{issue.row}</td>
                      <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{issue.column ?? '—'}</td>
                      <td className="max-w-[160px] truncate px-2.5 py-1.5" title={issue.value ?? ''}>
                        {issue.value ?? '—'}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Badge variant={issue.severity === 'error' ? 'negative' : 'warning'}>{issue.reason}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {report.notes.length > 0 ? (
          <div className="space-y-2">
            <p className="label-caps">Pipeline notes</p>
            <ul className="space-y-1">
              {report.notes.map((note) => (
                <li key={note} className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
