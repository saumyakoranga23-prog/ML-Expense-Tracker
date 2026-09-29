import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { StageProgress } from '@/components/ui/states';
import { useDataset } from '@/hooks/useDataset';
import { loadingStages } from '@/hooks/loadingStages';
import { useStageTicker } from '@/hooks/useStageTicker';

/** Progress strip shown while the previous dataset is being restored. */
export function RestoreProgress({ className }: { className?: string }) {
  const stages = useStageTicker(true, loadingStages.restore);
  return <StageProgress stages={stages} className={className} />;
}

/** Redirects to the landing page when no dataset has been loaded. */
export function RequireDataset({ children }: { children: ReactNode }) {
  const { dataset, status } = useDataset();
  if (dataset) return <>{children}</>;
  // Wait for the resume attempt instead of bouncing a deep link to the landing page.
  if (status === 'restoring') return <RestoreProgress className="mt-6" />;
  return <Navigate to="/" replace />;
}

/**
 * Global progress strip. The messages reflect the real phases of the request
 * that is currently running (upload, analysis or re-clustering).
 */
export function ActivityStrip() {
  const { busy, status } = useDataset();
  const stages = useStageTicker(
    busy,
    status === 'uploading'
      ? loadingStages.upload
      : status === 'clustering'
        ? loadingStages.clusters
        : loadingStages.analysis,
  );

  if (!busy) return null;
  return <StageProgress stages={stages} className="mb-5" />;
}
