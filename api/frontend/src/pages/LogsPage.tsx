import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogStore } from '@/store/useLogStore';
import { Header } from '@/components/Header';
import { Toolbar } from '@/components/Toolbar';
import { LogTable } from '@/components/LogTable';
import { StatusBar } from '@/components/StatusBar';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PageAside } from 'advi-ui';
import { Settings, LayoutDashboard, ScrollText } from 'lucide-react';

export default function LogsPage() {
  const loadLabels = useLogStore((s) => s.loadLabels);
  const startStream = useLogStore((s) => s.startStream);
  const stopStream = useLogStore((s) => s.stopStream);
  const filters = useLogStore((s) => s.filters);

  const navigate = useNavigate();
  const [asideOpen, setAsideOpen] = useState(true);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  useEffect(() => {
    void startStream();
    return () => stopStream();
  }, [filters]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <PageAside
          open={asideOpen}
          onToggle={() => setAsideOpen((v) => !v)}
          items={[
            {
              icon: <ScrollText className="h-4 w-4" />,
              label: 'Logs',
              onClick: () => navigate('/'),
              active: true,
            },
            {
              icon: <LayoutDashboard className="h-4 w-4" />,
              label: 'Dashboard',
              onClick: () => navigate('/dashboard'),
            },
            {
              icon: <Settings className="h-4 w-4" />,
              label: 'Settings',
              onClick: () => navigate('/settings'),
            },
          ]}
        />

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
