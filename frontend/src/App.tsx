import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { ActivityStrip, RequireDataset, RestoreProgress } from '@/components/common/RequireDataset';
import { AppShell } from '@/components/layout/AppShell';
import { DatasetProvider, useDataset } from '@/hooks/useDataset';
import { ClustersPage } from '@/pages/ClustersPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { LandingPage } from '@/pages/LandingPage';
import { ModelPage } from '@/pages/ModelPage';
import { SpendingAnalysisPage } from '@/pages/SpendingAnalysisPage';
import { TransactionsPage } from '@/pages/TransactionsPage';

function ShellLayout() {
  return (
    <AppShell>
      <ActivityStrip />
      <Outlet />
    </AppShell>
  );
}

/** The landing page doubles as the empty state once a dataset exists. */
function HomeRoute() {
  const { dataset, status } = useDataset();
  if (dataset) return <Navigate to="/dashboard" replace />;
  // Avoid flashing the upload screen at a user whose dataset is about to return.
  if (status === 'restoring') return <RestoreProgress className="mt-6" />;
  return <LandingPage />;
}

function Guarded({ children }: { children: React.ReactNode }) {
  return <RequireDataset>{children}</RequireDataset>;
}

export default function App() {
  return (
    <DatasetProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/dashboard" element={<Guarded><DashboardPage /></Guarded>} />
            <Route path="/transactions" element={<Guarded><TransactionsPage /></Guarded>} />
            <Route path="/analysis" element={<Guarded><SpendingAnalysisPage /></Guarded>} />
            <Route path="/clusters" element={<Guarded><ClustersPage /></Guarded>} />
            <Route path="/insights" element={<Guarded><InsightsPage /></Guarded>} />
            <Route path="/model" element={<Guarded><ModelPage /></Guarded>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DatasetProvider>
  );
}
