import React, { useState } from 'react';
import { ToastProvider } from './Toast';
import { Navbar } from './Navbar';
import { Datatable } from './Datatable';
import { SalesHistoryTable } from './SalesHistoryTable';
import { IngestionModal } from './IngestionModal';

interface DashboardAppProps {
  currentPath?: string;
  pageType?: 'dashboard' | 'sales';
}

export const DashboardApp: React.FC<DashboardAppProps> = ({ currentPath = '/', pageType = 'dashboard' }) => {
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <Navbar currentPath={currentPath} onOpenIngestModal={() => setIsIngestOpen(true)} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {pageType === 'dashboard' ? (
            <Datatable key={refreshTrigger} />
          ) : (
            <SalesHistoryTable />
          )}
        </main>

        <IngestionModal
          isOpen={isIngestOpen}
          onClose={() => setIsIngestOpen(false)}
          onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </div>
    </ToastProvider>
  );
};
