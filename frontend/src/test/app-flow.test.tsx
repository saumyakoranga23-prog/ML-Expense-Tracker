import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { ApiError } from '@/services/api';
import { makeAnalyze, makeClusters, makeTransactionPage, makeUpload } from '@/test/fixtures';

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    api: {
      health: vi.fn(),
      upload: vi.fn(),
      demo: vi.fn(),
      sampleCsvUrl: vi.fn(() => '/api/sample-csv'),
      datasets: vi.fn(),
      deleteDataset: vi.fn(),
      summary: vi.fn(),
      analyze: vi.fn(),
      clusters: vi.fn(),
      sweep: vi.fn(),
      insights: vi.fn(),
      model: vi.fn(),
      transactions: vi.fn(),
    },
  };
});

const { api } = await import('@/services/api');
const mocked = api as unknown as {
  demo: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
  analyze: ReturnType<typeof vi.fn>;
  clusters: ReturnType<typeof vi.fn>;
  datasets: ReturnType<typeof vi.fn>;
  transactions: ReturnType<typeof vi.fn>;
};

const RESUME_KEY = 'ledgerlens.datasetId';
const DATASET_INFO = {
  dataset_id: 'demo123456',
  filename: 'demo_transactions.csv',
  source: 'demo',
  row_count: 118,
  created_at: '2026-01-01T00:00:00Z',
  clustering_available: true,
  min_rows_for_clustering: 8,
  active_k: 3,
};

beforeEach(() => {
  window.history.pushState({}, '', '/');
  window.sessionStorage.clear();
  mocked.demo.mockResolvedValue(makeUpload());
  mocked.datasets.mockResolvedValue([DATASET_INFO]);
  mocked.analyze.mockResolvedValue(makeAnalyze());
  mocked.clusters.mockResolvedValue({ ...makeClusters(3), cached: true });
  mocked.transactions.mockImplementation((_id: string, params: { search?: string; page?: number }) =>
    Promise.resolve(makeTransactionPage(params?.page ?? 1, params?.search)),
  );
});

describe('critical user journey', () => {
  it('loads the demo dataset and renders the dashboard from API data', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/Turn transaction data into actionable spending patterns/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /explore demo data/i }));

    // The provider calls /demo and then /analyze before rendering the dashboard.
    await waitFor(() => expect(mocked.demo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocked.analyze).toHaveBeenCalledWith('demo123456'));

    expect(await screen.findByRole('heading', { name: /financial overview/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Total Spending/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Net Cash Flow/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Largest Expense/i).length).toBeGreaterThan(0);
    // KPI value comes from the mocked payload (248,500 in en-IN grouping).
    expect(screen.getAllByText(/2,48,500/).length).toBeGreaterThan(0);
  });

  it('filters the transaction table when the user searches', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /explore demo data/i }));
    await screen.findByText(/Financial overview/i);

    await user.click(screen.getByRole('link', { name: /transactions/i }));
    expect(await screen.findByRole('heading', { level: 2, name: /transaction explorer/i })).toBeInTheDocument();
    expect(await screen.findByText(/Transaction 1/)).toBeInTheDocument();

    mocked.transactions.mockImplementation((_id: string, params: { search?: string }) =>
      Promise.resolve(makeTransactionPage(1, params?.search)),
    );

    await user.type(screen.getByLabelText(/search description or category/i), 'swiggy');

    await waitFor(
      () =>
        expect(
          mocked.transactions.mock.calls.some((call) => call[1]?.search === 'swiggy'),
        ).toBe(true),
      { timeout: 3000 },
    );
    expect(await screen.findByText(/Swiggy order 0/)).toBeInTheDocument();
  });

  it('renders cluster analysis and re-runs K-Means when K changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /explore demo data/i }));
    await screen.findByText(/Financial overview/i);

    await user.click(screen.getByRole('link', { name: /clusters/i }));
    expect(await screen.findByRole('heading', { level: 2, name: /^spending clusters$/i })).toBeInTheDocument();

    const analysisHeading = await screen.findByRole('heading', { name: /Cluster analysis/i });
    expect(analysisHeading).toBeInTheDocument();
    // Cluster labels come from the API, not from a hard-coded list in the UI.
    expect(screen.getAllByText(/Frequent Small Purchases/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/High-Value Occasional Spending/).length).toBeGreaterThan(0);

    const controls = screen.getByRole('radiogroup', { name: /number of clusters/i });
    await user.click(within(controls).getByRole('radio', { name: '5' }));
    await user.click(screen.getByRole('button', { name: /run clustering with k = 5/i }));

    await waitFor(() => expect(mocked.clusters).toHaveBeenCalledWith('demo123456', 5));
  });
});

describe('dataset resume', () => {
  it('remembers the dataset id after an ingest so a reload can resume', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /explore demo data/i }));
    await screen.findByText(/Financial overview/i);

    expect(window.sessionStorage.getItem(RESUME_KEY)).toBe('demo123456');
  });

  it('restores the dataset behind a deep link instead of showing the upload screen', async () => {
    window.sessionStorage.setItem(RESUME_KEY, 'demo123456');
    window.history.pushState({}, '', '/clusters');
    render(<App />);

    // No re-upload: the analysis is rebuilt from the dataset still in memory.
    await waitFor(() => expect(mocked.analyze).toHaveBeenCalledWith('demo123456'));
    expect(mocked.demo).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { level: 2, name: /^spending clusters$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Turn transaction data into actionable spending patterns/i)).not.toBeInTheDocument();
  });

  it('falls back to the landing page when the remembered dataset is gone', async () => {
    window.sessionStorage.setItem(RESUME_KEY, 'evicted12345');
    window.history.pushState({}, '', '/dashboard');
    mocked.datasets.mockResolvedValue([]);
    mocked.analyze.mockRejectedValue(new ApiError('That dataset is no longer loaded.', 404, 'dataset_not_found'));

    render(<App />);

    expect(await screen.findByText(/Turn transaction data into actionable spending patterns/i)).toBeInTheDocument();
    // The stale pointer is dropped so the next reload does not retry it.
    expect(window.sessionStorage.getItem(RESUME_KEY)).toBeNull();
  });
});
