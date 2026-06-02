import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Cpu, Network, Database, Settings, GitBranch, ShieldCheck, BarChart2 } from 'lucide-react';
import type { SidebarSection } from '@/components/AppSidebar';

export type ActivePage = 'dashboard' | 'logs' | 'performance' | 'infrastructure' | 'workflows' | 'audit' | 'reports' | 'db-admin' | 'settings';

export const useNavSections = (active: ActivePage): SidebarSection[] => {
  const navigate = useNavigate();

  return [
    {
      title: 'Monitor',
      items: [
        { icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard', onClick: () => navigate('/dashboard'), active: active === 'dashboard' },
        { icon: <ScrollText className="h-4 w-4" />, label: 'Logs', onClick: () => navigate('/logs'), active: active === 'logs' },
      ],
    },
    {
      title: 'System',
      items: [
        { icon: <Cpu className="h-4 w-4" />, label: 'Performance', onClick: () => navigate('/performance'), active: active === 'performance' },
        { icon: <Network className="h-4 w-4" />, label: 'Infrastructure', onClick: () => navigate('/infrastructure'), active: active === 'infrastructure' },
        { icon: <GitBranch className="h-4 w-4" />, label: 'Workflows', onClick: () => navigate('/workflows'), active: active === 'workflows' },
        { icon: <ShieldCheck className="h-4 w-4" />, label: 'Audit Log', onClick: () => navigate('/audit'), active: active === 'audit' },
        { icon: <BarChart2 className="h-4 w-4" />, label: 'Reports', onClick: () => navigate('/reports'), active: active === 'reports' },
      ],
    },
    {
      title: 'Manage',
      items: [
        { icon: <Database className="h-4 w-4" />, label: 'DB Admin', onClick: () => { window.location.href = '/api/core/db-admin/'; }, active: active === 'db-admin' },
        { icon: <Settings className="h-4 w-4" />, label: 'Settings', onClick: () => navigate('/settings'), active: active === 'settings' },
      ],
    },
  ];
};
