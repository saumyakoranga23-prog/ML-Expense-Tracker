import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from '@/components/ui/table';
import { clusterColor } from '@/components/charts/theme';
import type { TransactionPage, TransactionQueryParams } from '@/types/api';
import { cn } from '@/lib/utils';
import { formatCurrencyPrecise, formatNumber } from '@/utils/format';

export type SortField = NonNullable<TransactionQueryParams['sort_by']>;

interface TransactionTableProps {
  page: TransactionPage | null;
  loading: boolean;
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  onSortChange: (field: SortField) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const COLUMNS: Array<{ key: SortField | 'type' | 'cluster' | null; label: string; align?: 'right' }> = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: null, label: 'Type' },
  { key: 'cluster', label: 'Cluster' },
];

export function TransactionTable({
  page,
  loading,
  sortBy,
  sortDir,
  onSortChange,
  onPageChange,
  onPageSizeChange,
}: TransactionTableProps) {
  const items = page?.items ?? [];
  const showSkeleton = loading && items.length === 0;

  return (
    <div className="space-y-3">
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((column) => (
                <TableHead key={column.label} className={cn(column.align === 'right' && 'text-right')}>
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key as SortField)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                        sortBy === column.key && 'text-foreground',
                      )}
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {sortBy === column.key ? (
                        sortDir === 'desc' ? (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {COLUMNS.map((column) => (
                      <TableCell key={column.label}>
                        <Skeleton className="h-3.5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : items.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <span className="block">{transaction.date}</span>
                      <span className="text-[10px] uppercase tracking-wide">{transaction.weekday}</span>
                    </TableCell>
                    <TableCell className="min-w-[180px] max-w-[280px]">
                      <span className="block truncate text-sm" title={transaction.description}>
                        {transaction.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex max-w-[160px] truncate rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {transaction.category}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'whitespace-nowrap text-right font-medium tabular-nums',
                        transaction.flow === 'income' ? 'text-positive' : 'text-foreground',
                      )}
                    >
                      {transaction.flow === 'income' ? '+' : '−'}
                      {formatCurrencyPrecise(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.flow === 'income' ? 'positive' : 'neutral'}>
                        {transaction.flow === 'income' ? 'Income' : 'Expense'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.cluster === null ? (
                        <span className="text-[11px] text-muted-foreground">not clustered</span>
                      ) : (
                        <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: clusterColor(transaction.cluster) }}
                            aria-hidden="true"
                          />
                          {transaction.cluster} · {transaction.cluster_label}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            {!showSkeleton && items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNS.length} className="py-10 text-center text-sm text-muted-foreground">
                  No transactions match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableShell>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {page
              ? `${formatNumber(page.total)} rows · page ${page.page} of ${page.pages}`
              : 'No results'}
          </span>
          {page ? (
            <span className="hidden sm:inline">
              Filtered spending {formatCurrencyPrecise(page.totals.spending)} · income{' '}
              {formatCurrencyPrecise(page.totals.income)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Rows per page"
            className="h-8 w-[110px] text-xs"
            value={String(page?.page_size ?? 25)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((page?.page ?? 1) - 1)}
            disabled={!page || page.page <= 1 || loading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange((page?.page ?? 1) + 1)}
            disabled={!page || page.page >= page.pages || loading}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
