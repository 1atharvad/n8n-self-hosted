import React from 'react';
import { cn } from '@/lib/utils';

interface BentoStatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}

export const BentoStatCard = ({ label, value, icon, accent, iconBg, iconColor, loading }: BentoStatCardProps) => {
  return (
    <div className={cn('bg-card border border-border border-t-2 rounded-2xl px-5 py-5 flex flex-col justify-between gap-4', accent)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{label}</span>
        <div className={cn('p-1.5 rounded-lg', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <span className="text-3xl font-bold tabular-nums tracking-tight font-mono">
        {loading ? <span className="text-muted-foreground text-2xl">—</span> : value.toLocaleString()}
      </span>
    </div>
  );
};
