import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Metric, PageHeader } from '@/components/common/PageHeader';
import { EMPTY_FILTERS, toQueryParams, type FilterState } from '@/components/transactions/filters';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import { TransactionTable, type SortField } from '@/components/transactions/TransactionTable';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/states';
import { useDataset } from '@/hooks/useDataset';
import { useTransactions } from '@/hooks/useTransactions';
import { formatCurrency } from '@/utils/format';

export function TransactionsPage() {
  const { dataset } = useDataset();
  const location = useLocation();
  const initialCategory = (location.state as { category?: string } | null)?.category ?? '';

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS, category: initialCategory });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const params = useMemo(() => toQueryParams(filters, page, pageSize), [filters, page, pageSize]);
  const { data, loading, error } = useTransactions(dataset?.dataset_id ?? null, params);

  const handleFilterChange = useCallback((next: FilterState) => {
    setFilters(next);
    setPage(1);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      setFilters((current) => ({
        ...current,
        sort_by: field,
        sort_dir: current.sort_by === field && current.sort_dir === 'desc' ? 'asc' : 'desc',
      }));
      setPage(1);
    },
    [],
  );

  if (!dataset) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction explorer"
        description="Search and filter every cleaned transaction. Totals react to the active filters, and cluster assignment appears once the model has been run."
      />

      <TransactionFilters
        facets={data?.facets ?? null}
        value={filters}
        onChange={handleFilterChange}
        onReset={() => {
          setFilters(EMPTY_FILTERS);
          setPage(1);
        }}
        clusteringAvailable={Boolean(data?.clustering_available)}
        resultCount={data?.total ?? 0}
      />

      {error ? <ErrorBanner title="The transaction table could not be loaded" message={error.summary} details={error.details} /> : null}

      <Card>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-2 gap-4 border-b border-border/70 pb-4 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Matching rows" value={data ? data.total.toLocaleString() : '—'} />
            <Metric label="Filtered spending" value={data ? formatCurrency(data.totals.spending) : '—'} tone="default" />
            <Metric label="Filtered income" value={data ? formatCurrency(data.totals.income) : '—'} tone="positive" />
            <Metric label="Net" value={data ? formatCurrency(data.totals.net) : '—'} tone={data && data.totals.net >= 0 ? 'positive' : 'negative'} />
            <Metric label="Average" value={data ? formatCurrency(data.totals.average) : '—'} />
            <Metric label="Largest" value={data ? formatCurrency(data.totals.largest) : '—'} />
          </div>

          <TransactionTable
            page={data}
            loading={loading}
            sortBy={filters.sort_by}
            sortDir={filters.sort_dir}
            onSortChange={handleSort}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
