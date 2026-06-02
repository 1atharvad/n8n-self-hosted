import { useEffect, useState } from 'react';
import { useWorkerMonitorStore } from '@/store/useWorkerMonitorStore';
import { Header } from '@/components/Header';
import { CpuChart } from '@/components/CpuChart';
import { ContainerCpuChart } from '@/components/ContainerCpuChart';
import { MultiServerCpuChart } from '@/components/MultiServerCpuChart';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { AlertCircle } from 'lucide-react';

const PerformancePage = () => {

  const { servers, serverNames, selectedServer, setSelectedServer, loading, error, load } = useWorkerMonitorStore();
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('performance');

  const metrics = selectedServer ? (servers[selectedServer] ?? []) : [];

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        title="Performance"
        actions={
          serverNames.length > 1 ? (
            <select
              value={selectedServer ?? ''}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {serverNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : undefined
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
            <p className="text-sm text-muted-foreground mt-1">CPU usage, container metrics, and multi-server monitoring.</p>
          </div>

          <div className="flex flex-col gap-5">
            <CpuChart metrics={metrics} loading={loading} />
            <ContainerCpuChart metrics={metrics} loading={loading} />
            <MultiServerCpuChart servers={servers} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default PerformancePage;
