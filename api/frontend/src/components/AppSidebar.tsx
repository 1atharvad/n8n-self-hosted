import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface AppSidebarProps {
  open: boolean;
  onToggle: () => void;
  sections: SidebarSection[];
  footer?: (open: boolean) => ReactNode;
}

export const AppSidebar = ({ open, onToggle, sections, footer }: AppSidebarProps) => {
  return (
    <aside
      className={cn(
        'flex flex-col h-full border-r border-border bg-card shrink-0 transition-[width] duration-200 overflow-hidden',
        open ? 'w-52' : 'w-[52px]'
      )}
    >
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => (
          <div key={section.title} className={cn(si > 0 && 'mt-1')}>
            {open ? (
              <p className="px-4 pt-3 pb-1 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                {section.title}
              </p>
            ) : (
              si > 0 && <div className="mx-3 my-2 border-t border-border" />
            )}
            <div className="flex flex-col gap-0.5 px-2">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  title={item.label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg transition-colors w-full',
                    open ? 'px-3 py-1.5' : 'p-2 justify-center',
                    item.active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {open && <span className="text-sm truncate">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {footer && (
        <div className="border-t border-border">
          {footer(open)}
        </div>
      )}

      <div className={cn('border-t border-border p-2 flex', open ? 'justify-end' : 'justify-center')}>
        <button
          onClick={onToggle}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
};
