import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Cpu, Network, Database, Settings } from 'lucide-react';
import type { SidebarSection } from '@/components/AppSidebar';

export type ActivePage = 'dashboard' | 'logs' | 'performance' | 'infrastructure' | 'db-admin' | 'settings';

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
