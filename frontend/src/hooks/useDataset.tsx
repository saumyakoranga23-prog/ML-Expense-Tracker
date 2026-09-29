import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api, ApiError } from '@/services/api';
import type {
  AnalyzeResponse,
  ClusterResponse,
  DatasetInfo,
  InsightsResponse,
  ModelInfo,
  UploadResponse,
} from '@/types/api';

export type DatasetStatus = 'idle' | 'restoring' | 'uploading' | 'analyzing' | 'clustering' | 'ready';

interface DatasetContextValue {
  dataset: UploadResponse | null;
  analysis: AnalyzeResponse | null;
  clusters: ClusterResponse | null;
  insights: InsightsResponse | null;
  model: ModelInfo | null;
  k: number;
  status: DatasetStatus;
  error: ApiError | null;
  busy: boolean;
  uploadFile: (file: File) => Promise<void>;
  loadDemo: () => Promise<void>;
  runClusters: (k: number) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

/**
 * The backend keeps datasets in memory, so a reload can pick the previous
 * dataset back up instead of forcing a fresh upload. The pointer lives in
 * sessionStorage (per tab) and is dropped as soon as the backend forgets it.
 */
const RESUME_KEY = 'ledgerlens.datasetId';

function readStoredDatasetId(): string | null {
  try {
    return window.sessionStorage.getItem(RESUME_KEY);
  } catch {
    // Hardened/private browsers can block storage; resuming is best effort.
    return null;
  }
}

function rememberDatasetId(datasetId: string): void {
  try {
    window.sessionStorage.setItem(RESUME_KEY, datasetId);
  } catch {
    /* resume is optional, never fatal */
  }
}

function forgetDatasetId(): void {
  try {
    window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
}

/** Rebuilds the upload payload from the datasets listing plus a fresh analysis. */
function toUploadResponse(info: DatasetInfo, analyzed: AnalyzeResponse): UploadResponse {
  return {
    dataset_id: info.dataset_id,
    filename: info.filename,
    source: info.source === 'demo' ? 'demo' : 'upload',
    row_count: info.row_count,
    cleaning: analyzed.summary.cleaning,
    summary: analyzed.summary,
    clustering_available: analyzed.clusters !== null || info.clustering_available,
    min_rows_for_clustering: info.min_rows_for_clustering,
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError('Something went wrong while loading the dataset.', 0, 'unknown_error');
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<UploadResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [clusters, setClusters] = useState<ClusterResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [k, setK] = useState(4);
  const [status, setStatus] = useState<DatasetStatus>(() => (readStoredDatasetId() ? 'restoring' : 'idle'));
  const [error, setError] = useState<ApiError | null>(null);

  const applyAnalysis = useCallback((uploaded: UploadResponse, analyzed: AnalyzeResponse) => {
    setDataset(uploaded);
    setAnalysis(analyzed);
    setClusters(analyzed.clusters);
    setInsights(analyzed.insights);
    setModel(analyzed.model);
    if (analyzed.clusters) setK(analyzed.clusters.k);
  }, []);

  const ingest = useCallback(
    async (load: () => Promise<UploadResponse>) => {
      setError(null);
      setStatus('uploading');
      let uploadedOk = false;
      try {
        const uploaded = await load();
        uploadedOk = true;
        rememberDatasetId(uploaded.dataset_id);
        setDataset(uploaded);
        setStatus('analyzing');
        const analyzed = await api.analyze(uploaded.dataset_id);
        applyAnalysis(uploaded, analyzed);
        setStatus('ready');
      } catch (caught) {
        setError(toApiError(caught));
        setStatus(uploadedOk || dataset ? 'ready' : 'idle');
      }
    },
    [applyAnalysis, dataset],
  );

  // Resume the previous dataset once, after the first paint. Deliberately not
  // cancelled on unmount: StrictMode remounts the effect, and abandoning the
  // request there would leave the app stuck on the restoring screen.
  const restoreStarted = useRef(false);
  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;

    const storedId = readStoredDatasetId();
    if (!storedId) return;

    void (async () => {
      try {
        const [listing, analyzed] = await Promise.all([api.datasets(), api.analyze(storedId)]);
        const info = listing.find((entry) => entry.dataset_id === storedId);
        if (!info) {
          // The listing no longer knows it (backend restart or eviction): a
          // fresh upload is the only honest option.
          forgetDatasetId();
          setStatus('idle');
          return;
        }
        applyAnalysis(toUploadResponse(info, analyzed), analyzed);
        setStatus('ready');
      } catch (caught) {
        const restored = toApiError(caught);
        if (restored.status === 404) {
          forgetDatasetId();
          setStatus('idle');
          return;
        }
        setError(restored);
        setStatus('idle');
      }
    })();
  }, [applyAnalysis]);

  const uploadFile = useCallback((file: File) => ingest(() => api.upload(file)), [ingest]);
  const loadDemo = useCallback(() => ingest(() => api.demo()), [ingest]);

  const runClusters = useCallback(
    async (nextK: number) => {
      if (!dataset) return;
      setError(null);
      setStatus('clustering');
      try {
        const result = await api.clusters(dataset.dataset_id, nextK);
        setClusters(result);
        setK(result.k);
        setAnalysis((current) => (current ? { ...current, clusters: result } : current));
        // Insights and the model report depend on the active partition.
        const [freshInsights, freshModel] = await Promise.all([
          api.insights(dataset.dataset_id),
          api.model(dataset.dataset_id, result.k),
        ]);
        setInsights(freshInsights);
        setModel(freshModel);
        setStatus('ready');
      } catch (caught) {
        setError(toApiError(caught));
        setStatus('ready');
      }
    },
    [dataset],
  );

  const reset = useCallback(() => {
    setDataset(null);
    setAnalysis(null);
    setClusters(null);
    setInsights(null);
    setModel(null);
    setError(null);
    setStatus('idle');
    // Drop the resume pointer too, otherwise the next reload would restore the
    // dataset the caller just cleared.
    forgetDatasetId();
  }, []);

  const value = useMemo<DatasetContextValue>(
    () => ({
      dataset,
      analysis,
      clusters,
      insights,
      model,
      k,
      status,
      error,
      busy: status === 'uploading' || status === 'analyzing' || status === 'clustering',
      uploadFile,
      loadDemo,
      runClusters,
      clearError: () => setError(null),
      reset,
    }),
    [dataset, analysis, clusters, insights, model, k, status, error, uploadFile, loadDemo, runClusters, reset],
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  const context = useContext(DatasetContext);
  if (!context) throw new Error('useDataset must be used inside <DatasetProvider>');
  return context;
}
