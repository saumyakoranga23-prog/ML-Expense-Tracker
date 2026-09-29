import { Database, Download, Menu, Moon, Sparkles, Sun, Upload } from 'lucide-react';
import { useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDataset } from '@/hooks/useDataset';
import { useTheme } from '@/hooks/useTheme';
import { API_ROOT } from '@/services/api';
import { cn } from '@/lib/utils';
import { formatNumber, formatRange } from '@/utils/format';

const DOCS_URL = `${API_ROOT.replace(/\/api$/, '')}/docs`;

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { dataset, status, uploadFile, busy } = useDataset();
  const { theme, toggle } = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);

  const statusLabel = {
    idle: 'No dataset',
    restoring: 'Restoring',
    uploading: 'Uploading',
    analyzing: 'Analysing',
    clustering: 'Clustering',
    ready: dataset ? 'Ready' : 'No dataset',
  }[status];
  const pending = busy || status === 'restoring';

  return (
    <header className="glass sticky top-0 z-30 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenNav} aria-label="Open navigation">
        <Menu className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold tracking-tight">Personal Finance Dashboard</h1>
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] sm:inline-flex',
              pending
                ? 'border-warning/40 bg-warning/10 text-warning'
                : dataset
                  ? 'border-positive/40 bg-positive/10 text-positive'
                  : 'border-border bg-surface-muted text-muted-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', pending ? 'bg-warning' : dataset ? 'bg-positive' : 'bg-muted-foreground')} />
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {dataset ? (
            <>
              <Database className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
              {dataset.filename} · {formatNumber(dataset.row_count)} transactions ·{' '}
              {formatRange(dataset.summary.kpis.first_date, dataset.summary.kpis.last_date)}
            </>
          ) : status === 'restoring' ? (
            'Restoring your last dataset from the analytics service…'
          ) : (
            'Upload a transaction CSV to generate spending clusters and analytics.'
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {dataset ? <Badge variant="neutral" className="hidden md:inline-flex">{dataset.source === 'demo' ? 'Demo dataset' : 'CSV upload'}</Badge> : null}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:block"
        >
          API docs
        </a>
        <a
          href={`${API_ROOT}/sample-csv`}
          className="hidden items-center gap-1.5 text-[11px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:inline-flex"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          Sample CSV
        </a>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} loading={busy}>
          {busy ? <Sparkles className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
          Upload CSV
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,text/csv"
          className="hidden"
          aria-label="Upload transaction CSV"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
