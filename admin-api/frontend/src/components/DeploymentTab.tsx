import React, { useCallback, useEffect, useState } from 'react';
import { fetchWorkflowRuns, fetchGitHubConfig } from '@/api/env';
import type { WorkflowRun, GitHubConfig } from '@/api/env';
import { GitHubActionsSection } from '@/components/GitHubActionsSection';
import { RunLogsDrawer } from '@/components/RunLogsDrawer';
import { Github } from 'lucide-react';

export const DeploymentTab = () => {
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  const isConfigured = Boolean(config?.token_set && config?.repo);

  const loadConfig = useCallback(() => {
    setConfigLoading(true);
    fetchGitHubConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));
  }, []);

  const loadRuns = useCallback(() => {
    setRunsLoading(true);
    setRunsError(null);
    setPage(1);
    fetchWorkflowRuns(1)
      .then(({ runs: fetched, has_more }) => {
        setRuns(fetched);
        setHasMore(has_more);
      })
      .catch((e: Error) => setRunsError(e.message))
      .finally(() => setRunsLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetchWorkflowRuns(nextPage)
      .then(({ runs: fetched, has_more }) => {
        setRuns((prev) => [...prev, ...fetched]);
        setHasMore(has_more);
        setPage(nextPage);
      })
      .catch((e: Error) => setRunsError(e.message))
      .finally(() => setLoadingMore(false));
  }, [page]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (isConfigured) loadRuns(); }, [isConfigured, loadRuns]);

  if (configLoading) {
    return (
      <section className="bg-card border border-border rounded-xl px-6 py-12 text-center">
        <p className="text-xs text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!isConfigured) {
    return (
      <section className="bg-card border border-border rounded-xl px-6 py-14 flex flex-col items-center gap-3">
        <Github className="h-8 w-8 text-muted-foreground/20" />
        <p className="text-sm font-medium text-foreground">GitHub not configured</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Add your GitHub token and repository in <span className="font-medium text-foreground">Settings → Personal</span> to view deployment runs.
        </p>
      </section>
    );
  }

  return (
    <>
      <GitHubActionsSection
        runs={runs}
        loading={runsLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={runsError}
        onRefresh={loadRuns}
        onLoadMore={loadMore}
        onRunClick={setSelectedRun}
      />
      <RunLogsDrawer
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </>
  );
};
