import { Download, FileSpreadsheet, Sparkles, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/states';
import { useDataset } from '@/hooks/useDataset';
import { API_ROOT } from '@/services/api';
import { cn } from '@/lib/utils';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['.csv', '.txt'];
const EXPECTED_COLUMNS = ['date', 'description', 'category', 'amount', 'transaction_type'];

/**
 * Upload surface used on the landing page and in the empty state. Validates the
 * file locally (type and size) before the request, and the server re-validates
 * everything again.
 */
export function UploadPanel({ className, dense = false }: { className?: string; dense?: boolean }) {
  const { uploadFile, loadDemo, busy, status, error, clearError } = useDataset();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    clearError();
    const name = file.name.toLowerCase();
    if (!ACCEPTED.some((extension) => name.endsWith(extension))) {
      setLocalError(`"${file.name}" is not a CSV file. Upload a .csv export of your transactions.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(`"${file.name}" is larger than 10 MB. Split the export into smaller periods.`);
      return;
    }
    void uploadFile(file);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors',
          dense ? 'py-8' : 'py-12',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-surface/50',
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-elevated text-primary">
          <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop your transaction CSV here</p>
          <p className="text-xs text-muted-foreground">
            CSV up to 10 MB · columns are detected automatically, including exports with debit/credit columns
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {EXPECTED_COLUMNS.map((column) => (
            <span key={column} className="rounded-full border border-border bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {column}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button onClick={() => inputRef.current?.click()} loading={busy}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload CSV
          </Button>
          <Button variant="secondary" onClick={() => void loadDemo()} loading={busy && status !== 'uploading'}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Explore demo data
          </Button>
          <Button variant="ghost" onClick={() => window.open(`${API_ROOT}/sample-csv`, '_blank')}>
            <Download className="h-4 w-4" aria-hidden="true" />
            View sample dataset
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv"
          className="hidden"
          aria-label="Upload transaction CSV"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>

      {localError ? <ErrorBanner title="That file cannot be used" message={localError} onDismiss={() => setLocalError(null)} /> : null}

      {error ? (
        <ErrorBanner title="The dataset could not be processed" message={error.summary} details={error.details} onDismiss={clearError} />
      ) : null}
    </div>
  );
}
