import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_ROOT, ApiError, api } from '@/services/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('surfaces structured backend errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'invalid_dataset',
              message: 'The file is missing required transaction columns.',
              details: ["No usable 'date' column could be found."],
            },
          },
          422,
        ),
      ),
    );

    await expect(api.demo()).rejects.toMatchObject({
      code: 'invalid_dataset',
      status: 422,
      details: ["No usable 'date' column could be found."],
    });
  });

  it('reports an unreachable backend without throwing a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await api.health().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('network_error');
    expect((error as ApiError).summary).toMatch(/unreachable/i);
  });

  it('serialises repeated query parameters and skips empty ones', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ items: [], total: 0, page: 1, page_size: 25, pages: 1, dataset_id: 'x', totals: {}, facets: {}, clustering_available: false }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await api.transactions('abc123', {
      search: 'coffee',
      category: ['Food', 'Travel'],
      cluster: [1],
      flow: undefined,
      page: 2,
      page_size: 25,
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url.startsWith(`${API_ROOT}/transactions?`)).toBe(true);
    expect(url).toContain('search=coffee');
    expect(url).toContain('category=Food');
    expect(url).toContain('category=Travel');
    expect(url).toContain('cluster=1');
    expect(url).toContain('page=2');
    expect(url).not.toContain('flow=');
  });
});
