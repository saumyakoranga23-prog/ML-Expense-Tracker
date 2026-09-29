import { describe, expect, it } from 'vitest';

import { EMPTY_FILTERS, toQueryParams } from '@/components/transactions/filters';

describe('transaction filters', () => {
  it('omits empty filters so the API receives a clean request', () => {
    const params = toQueryParams(EMPTY_FILTERS, 1, 25);
    expect(params).toEqual({ sort_by: 'date', sort_dir: 'desc', page: 1, page_size: 25 });
  });

  it('maps populated filters onto API query parameters', () => {
    const params = toQueryParams(
      {
        ...EMPTY_FILTERS,
        search: '  swiggy  ',
        category: 'Food & Dining',
        flow: 'expense',
        cluster: 2,
        start: '2024-01-01',
        end: '2024-03-31',
        sort_by: 'amount',
        sort_dir: 'asc',
      },
      3,
      50,
    );

    expect(params).toEqual({
      search: 'swiggy',
      category: ['Food & Dining'],
      flow: ['expense'],
      cluster: [2],
      start: '2024-01-01',
      end: '2024-03-31',
      sort_by: 'amount',
      sort_dir: 'asc',
      page: 3,
      page_size: 50,
    });
  });

  it('drops a blank search string', () => {
    const params = toQueryParams({ ...EMPTY_FILTERS, search: '   ' }, 1, 25);
    expect(params.search).toBeUndefined();
  });
});
