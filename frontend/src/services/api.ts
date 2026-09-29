import type {
  AnalyzeResponse,
  ApiErrorPayload,
  ClusterResponse,
  DatasetInfo,
  DatasetSummary,
  InsightsResponse,
  ModelInfo,
  TransactionPage,
  TransactionQueryParams,
  UploadResponse,
} from '@/types/api';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
const BASE = RAW_BASE.replace(/\/+$/, '');
export const API_ROOT = `${BASE}/api`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];

  constructor(message: string, status: number, code: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** A short, user-facing summary that never leaks a stack trace. */
  get summary(): string {
    return this.status === 0
      ? 'The analytics service is unreachable. Start the FastAPI backend and try again.'
      : this.message;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const payload = body as ApiErrorPayload | null;
  if (payload && typeof payload === 'object' && payload.error) {
    return new ApiError(payload.error.message, status, payload.error.code, payload.error.details ?? []);
  }
  return new ApiError('The request failed.', status, 'unknown_error', []);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(
      'The analytics service is unreachable.',
      0,
      'network_error',
      [`Tried ${API_ROOT}${path}. Is the backend running?`],
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, parsed);
  }
  return parsed as T;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && entry !== '') search.append(key, String(entry));
      });
      return;
    }
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  health: () => request<Record<string, unknown>>('/health'),

  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<UploadResponse>('/upload', { method: 'POST', body });
  },

  demo: () => request<UploadResponse>('/demo', { method: 'POST' }),

  sampleCsvUrl: () => `${API_ROOT}/sample-csv`,

  datasets: () => request<DatasetInfo[]>('/datasets'),

  deleteDataset: (datasetId: string) => request<void>(`/datasets/${datasetId}`, { method: 'DELETE' }),

  summary: (datasetId: string) => request<DatasetSummary>(`/summary${buildQuery({ dataset_id: datasetId })}`),

  analyze: (datasetId: string, k?: number) =>
    request<AnalyzeResponse>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, k: k ?? null }),
    }),

  clusters: (datasetId: string, k: number) =>
    request<ClusterResponse>('/clusters', {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId, k }),
    }),

  sweep: (datasetId: string) =>
    request<{ dataset_id: string; entries: { k: number; inertia: number; silhouette: number }[]; optimal_k: number | null }>(
      `/clusters/sweep${buildQuery({ dataset_id: datasetId })}`,
    ),

  insights: (datasetId: string) => request<InsightsResponse>(`/insights${buildQuery({ dataset_id: datasetId })}`),

  model: (datasetId: string, k?: number) => request<ModelInfo>(`/model${buildQuery({ dataset_id: datasetId, k })}`),

  transactions: (datasetId: string, params: TransactionQueryParams = {}) =>
    request<TransactionPage>(`/transactions${buildQuery({ dataset_id: datasetId, ...params })}`),
};
