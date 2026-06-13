import { useCallback, useEffect, useRef, useState } from 'react';
import { Github } from 'lucide-react';
import { Header } from '@/components/Header';
import { AppSidebar } from '@/components/AppSidebar';
import { useNavSections } from '@/hooks/useNavSections';
import { GitHubActionsSection } from '@/components/GitHubActionsSection';
import { RunLogsDrawer } from '@/components/RunLogsDrawer';
import { fetchWorkflowRuns, fetchGitHubConfig } from '@/api/env';
import type { WorkflowRun, GitHubConfig } from '@/api/env';

const DeploymentsPage = () => {
  const [asideOpen, setAsideOpen] = useState(false);
  const navSections = useNavSections('deployments');

  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  const isConfigured = Boolean(config?.token_set && config?.repo);

  const loadConfig = useCallback(() => {
    setConfigLoading(true);
    fetchGitHubConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));
  }, []);

  const loadRuns = useCallback((silent = false) => {
    if (!silent) {
      setRunsLoading(true);
      setRunsError(null);
    }
    pageRef.current = 1;
    fetchWorkflowRuns(1)
      .then(({ runs: fetched, has_more }) => {
        setRuns(fetched);
        setHasMore(has_more);
      })
      .catch((e: Error) => { if (!silent) setRunsError(e.message); })
      .finally(() => { if (!silent) setRunsLoading(false); });
  }, []);

  const loadMore = useCallback(() => {
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    fetchWorkflowRuns(nextPage)
      .then(({ runs: fetched, has_more }) => {
        setRuns((prev) => [...prev, ...fetched]);
        setHasMore(has_more);
        pageRef.current = nextPage;
      })
      .catch((e: Error) => setRunsError(e.message))
      .finally(() => setLoadingMore(false));
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    if (isConfigured) loadRuns();
  }, [isConfigured, loadRuns]);

  const hasActiveRef = useRef(false);
  hasActiveRef.current = runs.some((r) => r.status === 'queued' || r.status === 'in_progress');

  useEffect(() => {
    if (!isConfigured) return;
    const id = setInterval(() => {
      if (hasActiveRef.current) loadRuns(true);
    }, 5000);
    pollRef.current = id;
    return () => clearInterval(id);
  }, [isConfigured, loadRuns]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header title="Deployments" />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar open={asideOpen} onToggle={() => setAsideOpen((v) => !v)} sections={navSections} />
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
            <p className="text-sm text-muted-foreground mt-1">GitHub Actions workflow runs for this repository.</p>
          </div>

          {configLoading ? (
            <section className="bg-card border border-border rounded-xl px-6 py-12 text-center">
              <p className="text-xs text-muted-foreground">Loading…</p>
            </section>
          ) : !isConfigured ? (
            <section className="bg-card border border-border rounded-xl px-6 py-14 flex flex-col items-center gap-3">
              <Github className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm font-medium text-foreground">GitHub not configured</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Add your GitHub token and repository in{' '}
                <span className="font-medium text-foreground">Settings → Personal</span> to view deployment runs.
              </p>
            </section>
          ) : (
            <GitHubActionsSection
              runs={runs}
              loading={runsLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              error={runsError}
              onRefresh={() => loadRuns()}
              onLoadMore={loadMore}
              onRunClick={setSelectedRun}
            />
          )}
        </main>
      </div>
      <RunLogsDrawer run={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
};

export default DeploymentsPage;
