import { useEffect, useState } from 'react';
import { useLogStore } from '@/store/useLogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from 'advi-ui';
import { cn } from '@/lib/utils';

export const ContainersTab = () => {
  const labels = useLogStore((s) => s.labels);
  const loadLabels = useLogStore((s) => s.loadLabels);
  const { visibleContainers, setVisibleContainers } = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [checked, setChecked] = useState<Set<string>>(() =>
    visibleContainers.length === 0 ? new Set() : new Set(visibleContainers)
  );
  const [containersSaved, setContainersSaved] = useState(false);

  useEffect(() => { loadLabels(); }, [loadLabels]);

  const allVisible = checked.size === 0;
  const isVisible = (name: string) => checked.size === 0 || checked.has(name);

  const toggleContainer = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.size === 0) labels.forEach((l) => next.add(l));
      if (next.has(name)) next.delete(name);
      else next.add(name);
      if (next.size === labels.length) return new Set();
      return next;
    });
    setContainersSaved(false);
  };

  const toggleAll = () => {
    setChecked((prev) => (prev.size === 0 ? new Set(labels) : new Set()));
    setContainersSaved(false);
  };

  const saveContainerSettings = () => {
    setVisibleContainers(checked.size === 0 ? [] : Array.from(checked));
    setContainersSaved(true);
    setTimeout(() => setContainersSaved(false), 2000);
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">
          {isAdmin ? 'Container Visibility' : 'Container Access'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? 'Choose which containers appear in the log filter dropdown.'
            : 'Containers you have access to (set by an administrator).'}
        </p>
      </div>

      {isAdmin ? (
        <>
          <div className="px-6 py-6">
            {labels.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No containers discovered yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {allVisible
                      ? `All ${labels.length} containers visible`
                      : `${checked.size} of ${labels.length} visible`}
                  </span>
                  <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                    {allVisible ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((name) => (
                    <button
                      key={name}
                      onClick={() => toggleContainer(name)}
                      className={cn(
                        'font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer',
                        isVisible(name)
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-background/40">
            <Button onClick={saveContainerSettings} variant="default" size="sm" className="!rounded-sm">Save</Button>
            <Button
              variant="ghost"
              size="sm"
              className="!rounded-sm"
              onClick={() => { setChecked(new Set()); setContainersSaved(false); }}
            >
              Reset to all
            </Button>
            {containersSaved && <span className="text-xs text-green-400 ml-2">Saved.</span>}
          </div>
        </>
      ) : (
        <div className="px-6 py-6">
          {user?.allowed_containers === null ? (
            <p className="text-xs text-muted-foreground">Access to all containers.</p>
          ) : user?.allowed_containers?.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No containers assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {user?.allowed_containers?.map((c) => (
                <span key={c} className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
