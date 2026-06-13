import { useState } from 'react';
import { Header } from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { WorkflowBackupsSection } from '@/components/WorkflowBackupsSection';

const BackupsPage = () => {
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('backups');

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header title="Backups" />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Workflow Backups</h1>
            <p className="text-sm text-muted-foreground mt-1">Backup n8n workflows to git or restore a previous version.</p>
          </div>
          <WorkflowBackupsSection />
        </main>
      </div>
    </div>
  );
};

export default BackupsPage;
