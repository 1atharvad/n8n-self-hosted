import { useEffect, useState } from 'react';
import { useLogStore } from '@/store/useLogStore';
import { Header } from '@/components/Header';
import { Toolbar } from '@/components/Toolbar';
import { LogTable } from '@/components/LogTable';
import { StatusBar } from '@/components/StatusBar';
import { ErrorBanner } from '@/components/ErrorBanner';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';

export default function LogsPage() {
  const loadLabels = useLogStore((s) => s.loadLabels);
  const startStream = useLogStore((s) => s.startStream);
  const stopStream = useLogStore((s) => s.stopStream);
  const filters = useLogStore((s) => s.filters);

  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('logs');

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  useEffect(() => {
    void startStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header title="Logs" showLogControls />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />

        <div className="flex flex-col flex-1 overflow-hidden">
          <Toolbar />
          <ErrorBanner />
          <LogTable />
          <StatusBar />
        </div>
      </div>
    </div>
  );
}
