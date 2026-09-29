import { Filter, RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

import type { FilterState } from '@/components/transactions/filters';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import type { Facets } from '@/types/api';
import { formatCurrency } from '@/utils/format';

export function TransactionFilters({
  facets,
  value,
  onChange,
  onReset,
  clusteringAvailable,
  resultCount,
}: {
  facets: Facets | null;
  value: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  clusteringAvailable: boolean;
  resultCount: number;
}) {
  const [searchDraft, setSearchDraft] = useState(value.search);

  // Keep the text field in sync when filters are reset externally.
  useEffect(() => setSearchDraft(value.search), [value.search]);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    if (searchDraft === value.search) return;
    const timer = window.setTimeout(() => onChange({ ...value, search: searchDraft }), 320);
    return () => window.clearTimeout(timer);
  }, [searchDraft, value, onChange]);

  const update = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">{resultCount.toLocaleString()}</span> transactions match the
            current filters
            {facets ? ` · amounts range ${formatCurrency(facets.min_amount)} to ${formatCurrency(facets.max_amount)}` : ''}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset filters
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div className="lg:col-span-2">
          <Label htmlFor="search">Search description or category</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="search"
              value={searchDraft}
              placeholder="e.g. swiggy, rent, electronics"
              className="pl-9"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchDraft(event.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" value={value.category} onChange={(event) => update({ category: event.target.value })}>
            <option value="">All categories</option>
            {facets?.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="flow">Type</Label>
          <Select id="flow" value={value.flow} onChange={(event) => update({ flow: event.target.value as FilterState['flow'] })}>
            <option value="">Income and expenses</option>
            <option value="expense">Expenses only</option>
            <option value="income">Income only</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="cluster">Cluster</Label>
          <Select
            id="cluster"
            value={value.cluster === '' ? '' : String(value.cluster)}
            disabled={!clusteringAvailable}
            onChange={(event) => update({ cluster: event.target.value === '' ? '' : Number(event.target.value) })}
          >
            <option value="">{clusteringAvailable ? 'All clusters' : 'Run clustering first'}</option>
            {facets?.clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.id} · {cluster.label} ({cluster.size})
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="start">From date</Label>
          <Input id="start" type="date" value={value.start} onChange={(event) => update({ start: event.target.value })} />
        </div>

        <div>
          <Label htmlFor="end">To date</Label>
          <Input id="end" type="date" value={value.end} onChange={(event) => update({ end: event.target.value })} />
        </div>

        <div>
          <Label htmlFor="sort">Sort by</Label>
          <Select
            id="sort"
            value={value.sort_by}
            onChange={(event) => update({ sort_by: event.target.value as FilterState['sort_by'] })}
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="description">Description</option>
            <option value="category">Category</option>
            <option value="cluster">Cluster</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="direction">Direction</Label>
          <Select
            id="direction"
            value={value.sort_dir}
            onChange={(event) => update({ sort_dir: event.target.value as FilterState['sort_dir'] })}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </div>
    </div>
  );
}
