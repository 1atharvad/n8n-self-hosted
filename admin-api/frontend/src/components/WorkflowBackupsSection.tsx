import { useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { triggerBackup, fetchBackups, fetchBackupDetails } from '@/api/backups';
import type { WorkflowBackup, ExecuteResult, BackupWorkflow } from '@/api/backups';

const OutputLog = ({ result }: { result: ExecuteResult }) => (
  <div className={cn(
    'mx-5 mb-4 rounded-lg border text-xs font-mono',
    result.returnCode === 0
      ? 'border-green-500/20 bg-green-500/5'
      : 'border-destructive/20 bg-destructive/5',
  )}>
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-2 border-b text-[10px] font-sans font-semibold',
      result.returnCode === 0
        ? 'border-green-500/20 text-green-400'
        : 'border-destructive/20 text-destructive',
    )}>
      {result.returnCode === 0
        ? <CheckCircle2 className="h-3 w-3" />
        : <XCircle className="h-3 w-3" />
      }
      {result.returnCode === 0 ? 'Success' : `Failed (exit ${result.returnCode})`}
    </div>
    <pre className="px-3 py-2 whitespace-pre-wrap break-words text-muted-foreground leading-relaxed max-h-64 overflow-y-auto">
      {result.output || '(no output)'}
    </pre>
  </div>
);

const BackupRow = ({ backup }: { backup: WorkflowBackup }) => {
  const [expanded, setExpanded] = useState(false);
  const [workflows, setWorkflows] = useState<BackupWorkflow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggle = () => {
    if (!expanded && workflows === null) {
      setDetailLoading(true);
      fetchBackupDetails(backup.sha)
        .then((d) => setWorkflows(d.workflows))
        .catch(() => setWorkflows([]))
        .finally(() => setDetailLoading(false));
    }
    setExpanded((v) => !v);
  };

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        }
        <Archive className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{backup.message}</p>
          <p className="text-xs text-muted-foreground/50 mt-0.5">{timeAgo(backup.date)} · {backup.sha.slice(0, 7)}</p>
        </div>
        {workflows !== null && (
          <span className="text-xs text-muted-foreground/50 shrink-0">{workflows.length} workflows</span>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-3 border-t border-border/30 bg-muted/10">
          {detailLoading ? (
            <div className="py-4 flex items-center gap-2 text-xs text-muted-foreground/50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading workflows…
            </div>
          ) : workflows && workflows.length > 0 ? (
            <div className="pt-2 grid grid-cols-1 gap-0.5 max-h-48 overflow-y-auto">
              {workflows.map((w) => (
                <div key={w.name} className="flex items-center gap-2 py-1">
                  <Circle className={cn('h-2 w-2 shrink-0', w.active ? 'fill-green-500 text-green-500' : 'fill-muted-foreground/20 text-muted-foreground/20')} />
                  <span className={cn('text-xs truncate', w.archived ? 'line-through text-muted-foreground/40' : 'text-foreground/80')}>
                    {w.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-3 text-xs text-muted-foreground/40">No workflow data available for this backup.</p>
          )}
        </div>
      )}
    </div>
  );
};

export const WorkflowBackupsSection = () => {
  const [backups, setBackups] = useState<WorkflowBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState<ExecuteResult | null>(null);

  const loadBackups = useCallback(() => {
    setBackupsLoading(true);
    setBackupsError(null);
    fetchBackups()
      .then(setBackups)
      .catch((e: Error) => setBackupsError(e.message))
      .finally(() => setBackupsLoading(false));
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupResult(null);
    try {
      const result = await triggerBackup();
      setBackupResult(result);
      if (result.returnCode === 0) loadBackups();
    } catch (e) {
      setBackupResult({ output: (e as Error).message, returnCode: 1 });
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Workflow Backups</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Backup n8n workflows to git</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadBackups}
            disabled={backupsLoading || backingUp}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', backupsLoading && 'animate-spin')} />
          </button>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5 transition-colors disabled:opacity-40"
          >
            {backingUp
              ? <><Loader2 className="h-3 w-3 animate-spin" />Backing up…</>
              : <><Archive className="h-3 w-3" />Backup Now</>
            }
          </button>
        </div>
      </div>

      {backupResult && <OutputLog result={backupResult} />}

      <div>
        {backupsLoading && backups.length === 0 ? (
          <div className="py-10 text-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">Loading backups…</p>
          </div>
        ) : backupsError ? (
          <div className="py-10 text-center px-6">
            <XCircle className="h-4 w-4 text-destructive/40 mx-auto mb-2" />
            <p className="text-xs text-destructive">{backupsError}</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs text-muted-foreground/50">No backups yet. Click "Backup Now" to create one.</p>
          </div>
        ) : (
          backups.map((b) => <BackupRow key={b.sha} backup={b} />)
        )}
      </div>
    </section>
  );
};
