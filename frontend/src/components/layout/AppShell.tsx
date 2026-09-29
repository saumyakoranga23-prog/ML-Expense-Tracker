import { useEffect, useState, type ReactNode } from 'react';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useDataset } from '@/hooks/useDataset';

/** Application chrome: fixed sidebar on desktop, slide-over drawer on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { status } = useDataset();

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar className="sticky top-0 hidden h-screen lg:flex" />

      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[264px] max-w-[86vw] animate-fade-in shadow-panel">
            <Sidebar onClose={() => setNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main
          id="main"
          className="mx-auto w-full min-w-0 max-w-[1500px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8"
          aria-busy={status === 'uploading' || status === 'analyzing' || status === 'clustering'}
        >
          {children}
        </main>
        <footer className="border-t border-border px-4 py-4 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
          LedgerLens · K-Means spending clusters, PCA projection and deterministic financial analytics. Every figure on
          this page is computed from the dataset currently loaded in memory.
        </footer>
      </div>
    </div>
  );
}
