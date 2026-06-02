import { useEffect, useState } from 'react';
import { useWorkerMonitorStore } from '@/store/useWorkerMonitorStore';
import { useDashboardStore } from '@/store/useDashboardStore';
import { Header } from '@/components/Header';
import { ServerHealthCards } from '@/components/ServerHealthCards';
import { ActiveContainersSection } from '@/components/ActiveContainersSection';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { AlertCircle } from 'lucide-react';

const InfrastructurePage = () => {

  const { servers, selectedServer, setSelectedServer, loading, error, load } = useWorkerMonitorStore();
  const { data, load: loadDashboard } = useDashboardStore();
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('infrastructure');

  const metrics = selectedServer ? (servers[selectedServer] ?? []) : [];
  const fallbackContainers = data?.containers ?? [];

  useEffect(() => {
    load();
    loadDashboard();
  }, [load, loadDashboard]);

  useEffect(() => {
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header title="Infrastructure" />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />

        <main className="flex-1 overflow-y-auto px-10 py-8">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
            <p className="text-sm text-muted-foreground mt-1">Server health and active containers per host.</p>
          </div>

          <div className="flex flex-col gap-5">
            <ServerHealthCards
              servers={servers}
              selectedServer={selectedServer}
              onSelect={setSelectedServer}
            />
            <ActiveContainersSection
              metrics={metrics}
              fallbackContainers={fallbackContainers}
              loading={loading}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default InfrastructurePage;
