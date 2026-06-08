import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Header } from '@/components/Header';
import { Button } from 'advi-ui';
import { AppSidebar } from '@/components/AppSidebar';
import type { SidebarSection } from '@/components/AppSidebar';
import { LogOut, ChevronLeft, User, Box, Users, KeyRound, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonalTab } from '@/components/PersonalTab';
import { ContainersTab } from '@/components/ContainersTab';
import { EnvironmentTab } from '@/components/EnvironmentTab';
import { DeploymentTab } from '@/components/DeploymentTab';
import { UserManagement } from '@/components/UserManagement';

type Tab = 'personal' | 'containers' | 'users' | 'environment' | 'deployment';

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const activeTab: Tab = (tab as Tab) ?? 'personal';
  const setActiveTab = (next: Tab) => navigate(`/settings/${next}`);

  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [asideOpen, setAsideOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navSections: SidebarSection[] = [
    {
      title: 'Settings',
      items: [
        { icon: <User className="h-4 w-4" />, label: 'Personal', onClick: () => setActiveTab('personal'), active: activeTab === 'personal' },
        { icon: <Box className="h-4 w-4" />, label: 'Containers', onClick: () => setActiveTab('containers'), active: activeTab === 'containers' },
        ...(isAdmin ? [
          { icon: <Users className="h-4 w-4" />, label: 'Users', onClick: () => setActiveTab('users'), active: activeTab === 'users' },
          { icon: <KeyRound className="h-4 w-4" />, label: 'Environment', onClick: () => setActiveTab('environment'), active: activeTab === 'environment' },
          { icon: <Rocket className="h-4 w-4" />, label: 'Deployment', onClick: () => setActiveTab('deployment'), active: activeTab === 'deployment' },
        ] : []),
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        title="Settings"
        actions={
          <Button variant="ghost" size="sm" className="!rounded-sm" onClick={() => navigate('/dashboard')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          open={asideOpen}
          onToggle={() => setAsideOpen((v) => !v)}
          sections={navSections}
          footer={(open) => (
            <div className={cn('px-2 py-1', !open && 'flex justify-center')}>
              <button
                onClick={handleLogout}
                title="Sign out"
                className={cn(
                  'flex items-center gap-2.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary',
                  open ? 'w-full px-3 py-1.5 rounded-sm' : 'p-2 rounded-sm'
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {open && <span className="text-sm truncate">Sign out</span>}
              </button>
            </div>
          )}
        />

        <main className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-20 py-8 md:py-12">
          <div className="space-y-6">
            {activeTab === 'personal' && <PersonalTab />}
            {activeTab === 'containers' && <ContainersTab />}
            {activeTab === 'users' && isAdmin && (
              <section className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-base font-semibold text-foreground">User Management</h2>
                  <p className="text-sm text-muted-foreground mt-1">Create users, assign roles, and restrict container access.</p>
                </div>
                <div className="px-6 py-6">
                  <UserManagement />
                </div>
              </section>
            )}
            {activeTab === 'environment' && isAdmin && <EnvironmentTab />}
            {activeTab === 'deployment' && isAdmin && <DeploymentTab />}
          </div>
        </main>
      </div>
    </div>
  );
};
