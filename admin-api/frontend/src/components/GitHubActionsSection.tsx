import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw, ChevronRight, Circle } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import type { WorkflowRun } from '@/api/env';

interface GitHubActionsSectionProps {
  runs: WorkflowRun[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onRefresh: () => void;
  onLoadMore: () => void;
  onRunClick: (run: WorkflowRun) => void;
}

const durationStr = (created: string, updated: string, status: string): string | null => {
  if (status !== 'completed') return null;
  const secs = Math.round((new Date(updated).getTime() - new Date(created).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

type StatusVariant = 'running' | 'queued' | 'success' | 'failure' | 'other';

const getVariant = (run: WorkflowRun): StatusVariant => {
  if (run.status === 'in_progress') return 'running';
  if (run.status === 'queued') return 'queued';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'failure';
  return 'other';
};

const StatusIcon = ({ variant }: { variant: StatusVariant }) => {
  if (variant === 'running') return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
  if (variant === 'queued') return <Clock className="h-5 w-5 text-muted-foreground/50" />;
  if (variant === 'success') return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  if (variant === 'failure') return <XCircle className="h-5 w-5 text-destructive" />;
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
};

const variantLabel: Record<StatusVariant, string> = {
  running: 'Running',
  queued: 'Queued',
  success: 'Success',
  failure: 'Failed',
  other: 'Cancelled',
};

const variantAccent: Record<StatusVariant, string> = {
  running: 'border-l-blue-500',
  queued: 'border-l-muted-foreground/30',
  success: 'border-l-green-500',
  failure: 'border-l-destructive',
  other: 'border-l-muted-foreground/30',
};

const RunRow = ({ run, onClick }: { run: WorkflowRun; onClick: () => void }) => {
  const variant = getVariant(run);
  const dur = durationStr(run.created_at, run.updated_at, run.status);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left flex items-start gap-4 px-5 py-4',
        'border-l-2 border-b border-b-border/50 transition-colors',
        'hover:bg-secondary/30',
        variantAccent[variant],
      )}
    >
      <div className="pt-0.5 shrink-0">
        <StatusIcon variant={variant} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground truncate">{run.name}</span>
          <span className="text-xs text-muted-foreground/60 shrink-0">#{run.run_number}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            'text-[10px] font-semibold px-1.5 py-px rounded border',
            variant === 'running' && 'text-blue-400 border-blue-500/30 bg-blue-500/10',
            variant === 'queued' && 'text-muted-foreground border-border bg-secondary/40',
            variant === 'success' && 'text-green-400 border-green-500/30 bg-green-500/10',
            variant === 'failure' && 'text-destructive border-destructive/30 bg-destructive/10',
            variant === 'other' && 'text-muted-foreground border-border bg-secondary/40',
          )}>
            {variantLabel[variant]}
          </span>
          {run.actor && (
            <>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <span className="text-xs text-muted-foreground/60">by {run.actor}</span>
            </>
          )}
          <span className="text-muted-foreground/30 text-xs">·</span>
          <span className="text-xs text-muted-foreground/50">{run.event}</span>
        </div>
      </div>

      <div className="shrink-0 text-right flex flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground/60">{timeAgo(run.created_at)}</span>
        {dur && (
          <span className="text-[10px] text-muted-foreground/40">{dur}</span>
        )}
      </div>

      <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </div>
    </button>
  );
};

export const GitHubActionsSection = ({ runs, loading, loadingMore, hasMore, error, onRefresh, onLoadMore, onRunClick }: GitHubActionsSectionProps) => {
  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Deployments</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Recent GitHub Actions workflow runs</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div>
        {loading && runs.length === 0 ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">Loading runs…</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center px-6">
            <XCircle className="h-5 w-5 text-destructive/40 mx-auto mb-2" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-muted-foreground/50">No deployment runs yet.</p>
          </div>
        ) : (
          <>
            {runs.map((run) => (
              <RunRow key={run.id} run={run} onClick={() => onRunClick(run)} />
            ))}
            {hasMore && (
              <div className="px-5 py-3 border-t border-border/40 flex justify-center">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  {loadingMore
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Loading…</>
                    : 'Load more'
                  }
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
