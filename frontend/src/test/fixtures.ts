import type {
  AnalyzeResponse,
  CleaningReport,
  ClusterResponse,
  DatasetSummary,
  InsightsResponse,
  ModelInfo,
  TransactionPage,
  TransactionQueryParams,
  UploadResponse,
} from '@/types/api';

export const DATASET_ID = 'demo123456';

const cleaning: CleaningReport = {
  rows_read: 120,
  rows_clean: 118,
  rows_removed: 2,
  invalid_date_rows: 1,
  invalid_amount_rows: 1,
  duplicate_rows_removed: 0,
  missing_category_filled: 2,
  missing_description_filled: 0,
  income_rows: 8,
  expense_rows: 110,
  delimiter: ',',
  truncated_rows: 0,
  detected_columns: [
    { field: 'date', source_column: 'date', confidence: 'exact' },
    { field: 'description', source_column: 'description', confidence: 'exact' },
    { field: 'amount', source_column: 'amount', confidence: 'exact' },
  ],
  issues: [
    { row: 14, column: 'date', reason: 'Value could not be parsed as a valid calendar date', severity: 'error', value: '31/02/2024' },
  ],
  notes: ['No category column was available; all transactions were placed in "Uncategorized".'],
  truncated_issues: 0,
};

export function makeSummary(): DatasetSummary {
  return {
    dataset_id: DATASET_ID,
    kpis: {
      total_spending: 248_500,
      total_income: 320_000,
      net_cash_flow: 71_500,
      average_monthly_spending: 124_250,
      average_monthly_income: 160_000,
      largest_expense: 52_000,
      largest_expense_description: 'Croma',
      largest_expense_date: '2024-02-11',
      largest_expense_category: 'Electronics',
      transaction_count: 118,
      expense_count: 110,
      income_count: 8,
      average_transaction: 2_105.93,
      average_expense: 2_259.09,
      median_expense: 1_480,
      savings_rate: 22.3,
      months_covered: 2,
      first_date: '2024-01-01',
      last_date: '2024-02-29',
    },
    monthly: [
      { month: '2024-01', label: 'Jan 2024', income: 160_000, expense: 118_500, net: 41_500, transactions: 58, avg_transaction: 2_043.1 },
      { month: '2024-02', label: 'Feb 2024', income: 160_000, expense: 130_000, net: 30_000, transactions: 60, avg_transaction: 2_166.67 },
    ],
    categories: [
      {
        category: 'Food & Dining',
        total_spending: 62_000,
        share: 24.9,
        transactions: 48,
        average_transaction: 1_291.67,
        largest_transaction: 3_200,
        monthly: [],
        trend_change: 4.2,
        first_date: '2024-01-02',
        last_date: '2024-02-28',
      },
      {
        category: 'Electronics',
        total_spending: 52_000,
        share: 20.9,
        transactions: 2,
        average_transaction: 26_000,
        largest_transaction: 52_000,
        monthly: [],
        trend_change: -12.5,
        first_date: '2024-02-11',
        last_date: '2024-02-11',
      },
      {
        category: 'Housing',
        total_spending: 64_000,
        share: 25.8,
        transactions: 2,
        average_transaction: 32_000,
        largest_transaction: 32_000,
        monthly: [],
        trend_change: 0,
        first_date: '2024-01-01',
        last_date: '2024-02-01',
      },
    ],
    volume: [
      { month: '2024-01', label: 'Jan 2024', transactions: 58, expenses: 54, incomes: 4 },
      { month: '2024-02', label: 'Feb 2024', transactions: 60, expenses: 56, incomes: 4 },
    ],
    top_merchants: [
      { description: 'Croma', category: 'Electronics', total_spending: 52_000, transactions: 2, average_transaction: 26_000 },
    ],
    cleaning,
    generated_at: '2026-01-01T00:00:00Z',
  };
}

export function makeUpload(): UploadResponse {
  return {
    dataset_id: DATASET_ID,
    filename: 'demo_transactions.csv',
    source: 'demo',
    row_count: 118,
    cleaning,
    summary: makeSummary(),
    clustering_available: true,
    min_rows_for_clustering: 8,
  };
}

export function makeClusters(k = 3): ClusterResponse {
  return {
    dataset_id: DATASET_ID,
    k,
    generated_at: '2026-01-01T00:00:00Z',
    cached: false,
    metrics: {
      k,
      inertia: 421.55,
      silhouette: 0.4123,
      iterations: 7,
      explained_variance: [0.41, 0.22],
      explained_variance_total: 0.63,
      feature_names: ['log_amount', 'flow_indicator', 'category_frequency', 'amount_vs_category', 'monthly_spend_z', 'weekend_indicator'],
      n_samples: 118,
      n_features: 6,
      scaler_mean: { log_amount: 6.1, flow_indicator: 0.07 },
      scaler_scale: { log_amount: 1.8, flow_indicator: 0.25 },
      silhouette_sampled: false,
      silhouette_sample_size: 118,
    },
    clusters: [
      {
        cluster: 0,
        label: 'Frequent Small Purchases',
        size: 74,
        percentage: 62.7,
        avg_transaction: 820,
        median_transaction: 640,
        total_spending: 60_680,
        total_income: 0,
        spend_share: 24.4,
        dominant_category: 'Food & Dining',
        dominant_category_share: 41.2,
        frequency: 'High',
        transactions_per_month: 37,
        active_months: 2,
        income_share: 0,
        weekend_share: 51.4,
        characteristics: ['Average transaction is 0.4× the dataset average for its direction'],
        top_categories: [{ category: 'Food & Dining', transactions: 40, total: 25_000, share: 41.2 }],
        first_date: '2024-01-02',
        last_date: '2024-02-28',
        feature_means: { log_amount: 6.4 },
        feature_z_scores: { log_amount: -0.62, monthly_spend_z: 0.1 },
      },
      {
        cluster: 1,
        label: 'High-Value Occasional Spending',
        size: 36,
        percentage: 30.5,
        avg_transaction: 5_200,
        median_transaction: 4_100,
        total_spending: 187_200,
        total_income: 0,
        spend_share: 75.3,
        dominant_category: 'Housing',
        dominant_category_share: 34.2,
        frequency: 'Medium',
        transactions_per_month: 18,
        active_months: 2,
        income_share: 0,
        weekend_share: 22.2,
        characteristics: ['Average transaction is 2.3× the dataset average for its direction'],
        top_categories: [{ category: 'Housing', transactions: 2, total: 64_000, share: 34.2 }],
        first_date: '2024-01-01',
        last_date: '2024-02-29',
        feature_means: { log_amount: 8.4 },
        feature_z_scores: { log_amount: 1.24, monthly_spend_z: 0.4 },
      },
      {
        cluster: 2,
        label: 'Recurring Income',
        size: 8,
        percentage: 6.8,
        avg_transaction: 40_000,
        median_transaction: 40_000,
        total_spending: 0,
        total_income: 320_000,
        spend_share: 0,
        dominant_category: 'Income',
        dominant_category_share: 100,
        frequency: 'Low',
        transactions_per_month: 4,
        active_months: 2,
        income_share: 100,
        weekend_share: 0,
        characteristics: ['100% of the rows in this cluster are income'],
        top_categories: [{ category: 'Income', transactions: 8, total: 320_000, share: 100 }],
        first_date: '2024-01-01',
        last_date: '2024-02-01',
        feature_means: { flow_indicator: 1 },
        feature_z_scores: { flow_indicator: 3.72 },
      },
    ],
    centroids: [
      { cluster: 0, label: 'Frequent Small Purchases', x: -1.2, y: 0.4, size: 74 },
      { cluster: 1, label: 'High-Value Occasional Spending', x: 1.8, y: -0.2, size: 36 },
      { cluster: 2, label: 'Recurring Income', x: 3.1, y: 2.4, size: 8 },
    ],
    points: [
      {
        transaction_id: 1,
        x: -1.1,
        y: 0.2,
        cluster: 0,
        cluster_label: 'Frequent Small Purchases',
        amount: 480,
        description: 'Swiggy',
        category: 'Food & Dining',
        date: '2024-01-04',
        flow: 'expense',
      },
      {
        transaction_id: 2,
        x: 2.0,
        y: -0.4,
        cluster: 1,
        cluster_label: 'High-Value Occasional Spending',
        amount: 52_000,
        description: 'Croma',
        category: 'Electronics',
        date: '2024-02-11',
        flow: 'expense',
      },
    ],
    total_points: 118,
    points_sampled: false,
    sweep: [
      { k: 2, inertia: 512.4, silhouette: 0.3831 },
      { k: 3, inertia: 421.55, silhouette: 0.4123 },
      { k: 4, inertia: 356.12, silhouette: 0.3987 },
    ],
    optimal_k: 3,
  };
}

export function makeInsights(): InsightsResponse {
  return {
    dataset_id: DATASET_ID,
    generated_at: '2026-01-01T00:00:00Z',
    cluster_based: true,
    cluster_k: 3,
    insights: [
      {
        id: 'category-leader',
        title: 'Housing drives the largest share of spending',
        detail: 'Housing accounts for 25.8% of total spending across 2 transactions.',
        group: 'category',
        tone: 'neutral',
        metrics: [
          { label: 'Category spending', value: 64_000, kind: 'currency' },
          { label: 'Share of total spending', value: 25.8, kind: 'percent' },
        ],
      },
      {
        id: 'cluster-spend-imbalance',
        title: 'Cluster "High-Value Occasional Spending" punches above its weight',
        detail: 'It contains 30.5% of transactions but represents 75.3% of total spending.',
        group: 'cluster',
        tone: 'warning',
        metrics: [{ label: 'Share of spending', value: 75.3, kind: 'percent' }],
      },
    ],
  };
}

export function makeModel(k = 3): ModelInfo {
  return {
    dataset_id: DATASET_ID,
    algorithm: 'K-Means clustering',
    algorithm_detail: "Lloyd's algorithm with k-means++ initialisation, run 10 times per K.",
    preprocessing: 'StandardScaler (z-score standardisation)',
    preprocessing_detail: 'Each feature is centred and scaled.',
    dimensionality_reduction: 'PCA (2 components) for visualisation only',
    dimensionality_reduction_detail: 'Clustering runs on the full feature space.',
    evaluation: 'Silhouette score, with an inertia sweep for reference',
    features: [
      {
        name: 'log_amount',
        label: 'Log transaction amount',
        description: 'Natural logarithm of the absolute amount.',
        source: 'amount',
        scaled: true,
      },
    ],
    selected_k: k,
    optimal_k: 3,
    sweep: makeClusters(k).sweep,
    metrics: makeClusters(k).metrics,
    explanations: [
      {
        name: 'Silhouette score',
        value: 0.4123,
        display: 'score',
        meaning: 'Compares closeness to the own cluster versus the nearest other cluster.',
        caution: 'This is a diagnostic, not a verdict.',
      },
      { name: 'Inertia', value: 421.55, display: 'number', meaning: 'Sum of squared distances to cluster centres.', caution: null },
    ],
    clustering_available: true,
    unavailable_reason: null,
    total_transactions: 118,
    hyperparameters: { n_init: '10', random_state: '42', k_range: '2-8' },
  };
}

export function makeAnalyze(): AnalyzeResponse {
  return {
    dataset_id: DATASET_ID,
    summary: makeSummary(),
    insights: makeInsights(),
    clusters: makeClusters(),
    model: makeModel(),
  };
}

export function makeTransactionPage(page = 1, search?: string): TransactionPage {
  const items = Array.from({ length: 5 }).map((_, index) => ({
    id: (page - 1) * 5 + index + 1,
    date: '2024-02-1'.concat(String(index % 9)),
    description: search ? `Swiggy order ${index}` : `Transaction ${(page - 1) * 5 + index + 1}`,
    category: 'Food & Dining',
    amount: 500 + index * 100,
    signed_amount: -(500 + index * 100),
    flow: 'expense' as const,
    cluster: 0,
    cluster_label: 'Frequent Small Purchases',
    month: '2024-02',
    month_label: 'Feb 2024',
    weekday: 'Mon',
  }));

  return {
    dataset_id: DATASET_ID,
    items,
    total: search ? 5 : 40,
    page,
    page_size: 25,
    pages: search ? 1 : 2,
    totals: { transactions: items.length, spending: 3_500, income: 0, net: -3_500, average: 700, largest: 900 },
    facets: {
      categories: ['Food & Dining', 'Electronics', 'Housing'],
      flows: ['expense', 'income'],
      clusters: [
        { id: 0, label: 'Frequent Small Purchases', size: 74 },
        { id: 1, label: 'High-Value Occasional Spending', size: 36 },
      ],
      months: ['2024-01', '2024-02'],
      min_amount: 120,
      max_amount: 52_000,
    },
    clustering_available: true,
  };
}

export type { TransactionQueryParams };
