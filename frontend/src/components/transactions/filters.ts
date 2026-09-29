import type { Flow, TransactionQueryParams } from '@/types/api';

export interface FilterState {
  search: string;
  category: string;
  flow: '' | Flow;
  cluster: '' | number;
  start: string;
  end: string;
  sort_by: NonNullable<TransactionQueryParams['sort_by']>;
  sort_dir: NonNullable<TransactionQueryParams['sort_dir']>;
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  category: '',
  flow: '',
  cluster: '',
  start: '',
  end: '',
  sort_by: 'date',
  sort_dir: 'desc',
};

/** Translate UI filter state into API query parameters, dropping empty values. */
export function toQueryParams(filters: FilterState, page: number, pageSize: number): TransactionQueryParams {
  return {
    search: filters.search.trim() || undefined,
    category: filters.category ? [filters.category] : undefined,
    flow: filters.flow ? [filters.flow] : undefined,
    cluster: filters.cluster === '' ? undefined : [Number(filters.cluster)],
    start: filters.start || undefined,
    end: filters.end || undefined,
    sort_by: filters.sort_by,
    sort_dir: filters.sort_dir,
    page,
    page_size: pageSize,
  };
}
