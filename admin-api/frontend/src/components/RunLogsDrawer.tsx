import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, XCircle, Circle, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchRunJobs, fetchJobLogs } from '@/api/env';
import type { WorkflowRun, WorkflowJob } from '@/api/env';

interface RunLogsDrawerProps {
  run: WorkflowRun | null;
  onClose: () => void;
}

const StepIcon = ({ status, conclusion }: { status: string; conclusion: string | null }) => {
  if (status === 'in_progress') return <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />;
  if (status !== 'completed') return <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />;
  if (conclusion === 'success') return <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />;
  if (conclusion === 'failure') return <XCircle className="h-3 w-3 text-destructive shrink-0" />;
  return <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />;
};

const JobStatusDot = ({ status, conclusion }: { status: string; conclusion: string | null }) => {
  const cls =
    status === 'in_progress' ? 'bg-blue-400 animate-pulse' :
    status === 'queued' ? 'bg-muted-foreground/40' :
    conclusion === 'success' ? 'bg-green-400' :
    conclusion === 'failure' ? 'bg-destructive' :
    'bg-muted-foreground/40';
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${cls}`} />;
};

const duration = (started: string | null, completed: string | null) => {
  if (!started) return null;
  const end = completed ? new Date(completed) : new Date();
  const secs = Math.round((end.getTime() - new Date(started).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

const runBadge = (run: WorkflowRun) => {
  if (run.status === 'in_progress') return { label: 'Running', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  if (run.status === 'queued') return { label: 'Queued', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  if (run.conclusion === 'success') return { label: 'Success', cls: 'bg-green-500/15 text-green-400 border-green-500/30' };
  if (run.conclusion === 'failure') return { label: 'Failed', cls: 'bg-destructive/15 text-destructive border-destructive/30' };
  return { label: run.conclusion ?? 'Cancelled', cls: 'bg-secondary text-muted-foreground border-border' };
};

const stripTimestamp = (line: string) => line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, '');

export const RunLogsDrawer = ({ run, onClose }: RunLogsDrawerProps) => {
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const isRunning = run?.status !== 'completed';

  const loadJobs = useCallback(async (runId: number) => {
    const j = await fetchRunJobs(runId);
    setJobs(j);
    setSelectedJobId((prev) => prev ?? (j[0]?.id ?? null));
  }, []);

  const loadLogs = useCallback(async (jobId: number) => {
    setLogsLoading(true);
    try {
      const text = await fetchJobLogs(jobId);
      setLogs(text);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!run) return;
    setJobs([]);
    setSelectedJobId(null);
    setLogs('');
    void loadJobs(run.id);
    if (!isRunning) return;
    const t = setInterval(() => void loadJobs(run.id), 4000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, isRunning, loadJobs]);

  useEffect(() => {
    if (!selectedJobId) return;
    setLogs('');
    void loadLogs(selectedJobId);
    if (!isRunning) return;
    const t = setInterval(() => void loadLogs(selectedJobId), 4000);
    return () => clearInterval(t);
  }, [selectedJobId, isRunning, loadLogs]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!run) return null;

  const badge = runBadge(run);
  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const logLines = logs ? logs.split('\n').map(stripTimestamp) : [];

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-x-4 top-6 bottom-6 z-50 md:inset-x-12 lg:inset-x-24 xl:inset-x-40 flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                {badge.label}
              </span>
              {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
            </div>
            <h2 className="text-sm font-semibold text-foreground truncate">{run.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              #{run.run_number}
              {run.actor ? ` · triggered by ${run.actor}` : ''}
              {' · '}{new Date(run.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Jobs panel */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col overflow-hidden">
            <p className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/60 bg-background/30">
              Jobs
            </p>
            <div className="flex-1 overflow-y-auto">
              {jobs.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                </div>
              ) : jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border/40 transition-colors',
                    job.id === selectedJobId
                      ? 'bg-primary/8 border-l-2 border-l-primary'
                      : 'hover:bg-secondary/40 border-l-2 border-l-transparent'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <JobStatusDot status={job.status} conclusion={job.conclusion} />
                    <span className="text-xs font-medium text-foreground truncate flex-1">{job.name}</span>
                  </div>
                  {duration(job.started_at, job.completed_at) && (
                    <div className="flex items-center gap-1 ml-4 mb-2">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/60">{duration(job.started_at, job.completed_at)}</span>
                    </div>
                  )}
                  {job.id === selectedJobId && job.steps.length > 0 && (
                    <div className="ml-4 space-y-1.5">
                      {job.steps.map((step) => (
                        <div key={step.number} className="flex items-center gap-1.5">
                          <StepIcon status={step.status} conclusion={step.conclusion} />
                          <span className="text-[10px] text-muted-foreground leading-tight truncate">{step.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Log viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
            {/* Log toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 shrink-0">
              <span className="text-[10px] font-mono text-white/40 truncate">
                {selectedJob ? selectedJob.name : 'Select a job'}
              </span>
              {logsLoading && <Loader2 className="h-3 w-3 animate-spin text-white/30 ml-auto shrink-0" />}
            </div>

            {/* Logs */}
            <pre
              ref={logRef}
              className="flex-1 overflow-y-auto text-[11.5px] font-mono leading-relaxed text-[#c9d1d9] select-text"
            >
              {logLines.length > 0 ? (
                logLines.map((line, i) => {
                  const isGroup = line.startsWith('##[group]') || line.startsWith('##[endgroup]');
                  const isError = line.includes('##[error]') || line.toLowerCase().includes('error:');
                  const isWarning = line.includes('##[warning]');
                  const isSuccess = /✅|successfully|success/i.test(line);
                  const display = line
                    .replace('##[group]', '')
                    .replace('##[endgroup]', '')
                    .replace('##[error]', '')
                    .replace('##[warning]', '');
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex px-4 hover:bg-white/[0.03] transition-colors',
                        isGroup && 'bg-white/[0.03] font-semibold text-white/80',
                        isError && 'text-red-400',
                        isWarning && 'text-yellow-400',
                        isSuccess && 'text-green-400',
                      )}
                    >
                      <span className="select-none text-white/20 mr-4 shrink-0 w-8 text-right text-[10px] pt-px">
                        {i + 1}
                      </span>
                      <span className="break-all whitespace-pre-wrap py-px">{display || ' '}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-xs text-white/20">
                    {logsLoading ? 'Loading logs…' : 'No logs available.'}
                  </span>
                </div>
              )}
            </pre>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
