/**
 * TypeScript mirror of the FastAPI response schemas (see backend/app/schemas).
 * Field names match the JSON payloads exactly so nothing is renamed in flight.
 */

export type Flow = 'income' | 'expense';
export type ColumnConfidence = 'exact' | 'alias' | 'heuristic' | 'missing';
export type FrequencyBand = 'Low' | 'Medium' | 'High';
export type InsightGroup = 'spending' | 'income' | 'trend' | 'category' | 'cluster' | 'behaviour';
export type InsightTone = 'neutral' | 'positive' | 'negative' | 'warning';
export type MetricKind = 'currency' | 'percent' | 'count' | 'ratio';

export interface DetectedColumn {
  field: string;
  source_column: string | null;
  confidence: ColumnConfidence;
}

export interface CleaningIssue {
  row: number;
  column: string | null;
  reason: string;
  severity: 'error' | 'warning';
  value: string | null;
}

export interface CleaningReport {
  rows_read: number;
  rows_clean: number;
  rows_removed: number;
  invalid_date_rows: number;
  invalid_amount_rows: number;
  duplicate_rows_removed: number;
  missing_category_filled: number;
  missing_description_filled: number;
  income_rows: number;
  expense_rows: number;
  delimiter: string;
  truncated_rows: number;
  detected_columns: DetectedColumn[];
  issues: CleaningIssue[];
  notes: string[];
  truncated_issues: number;
}

export interface Kpis {
  total_spending: number;
  total_income: number;
  net_cash_flow: number;
  average_monthly_spending: number;
  average_monthly_income: number;
  largest_expense: number;
  largest_expense_description: string | null;
  largest_expense_date: string | null;
  largest_expense_category: string | null;
  transaction_count: number;
  expense_count: number;
  income_count: number;
  average_transaction: number;
  average_expense: number;
  median_expense: number;
  savings_rate: number;
  months_covered: number;
  first_date: string;
  last_date: string;
}

export interface MonthlyPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  transactions: number;
  avg_transaction: number;
}

export interface VolumePoint {
  month: string;
  label: string;
  transactions: number;
  expenses: number;
  incomes: number;
}

export interface CategoryStat {
  category: string;
  total_spending: number;
  share: number;
  transactions: number;
  average_transaction: number;
  largest_transaction: number;
  monthly: MonthlyPoint[];
  trend_change: number;
  first_date: string | null;
  last_date: string | null;
}

export interface MerchantStat {
  description: string;
  category: string;
  total_spending: number;
  transactions: number;
  average_transaction: number;
}

export interface DatasetSummary {
  dataset_id: string;
  kpis: Kpis;
  monthly: MonthlyPoint[];
  categories: CategoryStat[];
  volume: VolumePoint[];
  top_merchants: MerchantStat[];
  cleaning: CleaningReport;
  generated_at: string;
}

export interface UploadResponse {
  dataset_id: string;
  filename: string;
  source: 'upload' | 'demo';
  row_count: number;
  cleaning: CleaningReport;
  summary: DatasetSummary;
  clustering_available: boolean;
  min_rows_for_clustering: number;
}

export interface DatasetInfo {
  dataset_id: string;
  filename: string;
  source: string;
  row_count: number;
  created_at: string;
  clustering_available: boolean;
  min_rows_for_clustering: number;
  active_k: number | null;
}

export interface KSweepEntry {
  k: number;
  inertia: number;
  silhouette: number;
}

export interface ClusterMetrics {
  k: number;
  inertia: number;
  silhouette: number;
  iterations: number;
  explained_variance: number[];
  explained_variance_total: number;
  feature_names: string[];
  n_samples: number;
  n_features: number;
  scaler_mean: Record<string, number>;
  scaler_scale: Record<string, number>;
  silhouette_sampled: boolean;
  silhouette_sample_size: number;
}

export interface CategoryBreakdown {
  category: string;
  transactions: number;
  total: number;
  share: number;
}

export interface ClusterStat {
  cluster: number;
  label: string;
  size: number;
  percentage: number;
  avg_transaction: number;
  median_transaction: number;
  total_spending: number;
  total_income: number;
  spend_share: number;
  dominant_category: string;
  dominant_category_share: number;
  frequency: FrequencyBand;
  transactions_per_month: number;
  active_months: number;
  income_share: number;
  weekend_share: number;
  characteristics: string[];
  top_categories: CategoryBreakdown[];
  first_date: string;
  last_date: string;
  feature_means: Record<string, number>;
  feature_z_scores: Record<string, number>;
}

export interface ClusterPoint {
  transaction_id: number;
  x: number;
  y: number;
  cluster: number;
  cluster_label: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  flow: Flow;
}

export interface Centroid {
  cluster: number;
  label: string;
  x: number;
  y: number;
  size: number;
}

export interface ClusterResponse {
  dataset_id: string;
  k: number;
  generated_at: string;
  cached: boolean;
  metrics: ClusterMetrics;
  clusters: ClusterStat[];
  centroids: Centroid[];
  points: ClusterPoint[];
  total_points: number;
  points_sampled: boolean;
  sweep: KSweepEntry[];
  optimal_k: number;
}

export interface TransactionRow {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  signed_amount: number;
  flow: Flow;
  cluster: number | null;
  cluster_label: string | null;
  month: string;
  month_label: string;
  weekday: string;
}

export interface TransactionTotals {
  transactions: number;
  spending: number;
  income: number;
  net: number;
  average: number;
  largest: number;
}

export interface FacetCluster {
  id: number;
  label: string;
  size: number;
}

export interface Facets {
  categories: string[];
  flows: Flow[];
  clusters: FacetCluster[];
  months: string[];
  min_amount: number;
  max_amount: number;
}

export interface TransactionPage {
  dataset_id: string;
  items: TransactionRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  totals: TransactionTotals;
  facets: Facets;
  clustering_available: boolean;
}

export interface InsightMetric {
  label: string;
  value: number;
  kind: MetricKind;
}

export interface Insight {
  id: string;
  title: string;
  detail: string;
  group: InsightGroup;
  tone: InsightTone;
  metrics: InsightMetric[];
}

export interface InsightsResponse {
  dataset_id: string;
  generated_at: string;
  cluster_based: boolean;
  cluster_k: number | null;
  insights: Insight[];
}

export interface FeatureDescription {
  name: string;
  label: string;
  description: string;
  source: string;
  scaled: boolean;
}

export interface MetricExplanation {
  name: string;
  value: number | null;
  display: 'number' | 'score' | 'percent';
  meaning: string;
  caution: string | null;
}

export interface ModelInfo {
  dataset_id: string;
  algorithm: string;
  algorithm_detail: string;
  preprocessing: string;
  preprocessing_detail: string;
  dimensionality_reduction: string;
  dimensionality_reduction_detail: string;
  evaluation: string;
  features: FeatureDescription[];
  selected_k: number | null;
  optimal_k: number | null;
  sweep: KSweepEntry[];
  metrics: ClusterMetrics | null;
  explanations: MetricExplanation[];
  clustering_available: boolean;
  unavailable_reason: string | null;
  total_transactions: number;
  hyperparameters: Record<string, string>;
}

export interface AnalyzeResponse {
  dataset_id: string;
  summary: DatasetSummary;
  insights: InsightsResponse;
  clusters: ClusterResponse | null;
  model: ModelInfo;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details: string[];
    context?: Record<string, unknown>;
  };
}

export interface TransactionQueryParams {
  search?: string;
  category?: string[];
  flow?: Flow[];
  cluster?: number[];
  start?: string;
  end?: string;
  min_amount?: number;
  max_amount?: number;
  sort_by?: 'date' | 'amount' | 'description' | 'category' | 'cluster';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}
