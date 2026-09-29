import { useEffect, useState } from 'react';

import { api, ApiError } from '@/services/api';
import type { TransactionPage, TransactionQueryParams } from '@/types/api';

interface TransactionsState {
  data: TransactionPage | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Fetches one page of the transaction explorer. The query object is
 * serialised into the dependency list so identical filters reuse the same
 * request, and an in-flight request is discarded when the filters change.
 */
export function useTransactions(datasetId: string | null, params: TransactionQueryParams) {
  const [state, setState] = useState<TransactionsState>({ data: null, loading: Boolean(datasetId), error: null });
  const serialised = JSON.stringify(params);

  useEffect(() => {
    if (!datasetId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    api
      .transactions(datasetId, JSON.parse(serialised) as TransactionQueryParams)
      .then((page) => {
        if (!cancelled) setState({ data: page, loading: false, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: caught instanceof ApiError ? caught : new ApiError('The transaction table could not be loaded.', 0, 'unknown_error'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId, serialised]);

  return state;
}
