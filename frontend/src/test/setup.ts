import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeAll(() => {
  // Recharts' ResponsiveContainer needs these in jsdom.
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1024 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 480 });
});
