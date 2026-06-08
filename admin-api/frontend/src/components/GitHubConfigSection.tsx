import React, { useEffect, useState } from 'react';
import { Check, Github, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from 'advi-ui';
import { saveGitHubConfig, fetchGitHubToken } from '@/api/env';
import type { GitHubConfig } from '@/api/env';

interface GitHubConfigSectionProps {
  config: GitHubConfig | null;
  onSaved: () => void;
}

export const GitHubConfigSection = ({ config, onSaved }: GitHubConfigSectionProps) => {
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(false);

  useEffect(() => {
    setRepo(config?.repo ?? '');
    setRevealedToken(null);
    setShowToken(false);
  }, [config?.repo, config?.token_set]);

  const isConfigured = Boolean(config?.token_set && config?.repo);

  const toggleShowToken = async () => {
    if (fetchingToken) return;
    if (revealedToken !== null) { setShowToken((v) => !v); return; }
    setFetchingToken(true);
    try {
      const t = await fetchGitHubToken();
      setRevealedToken(t);
      setShowToken(true);
    } catch { /* ignore */ } finally {
      setFetchingToken(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveGitHubConfig(token || undefined, repo || undefined);
      setToken('');
      setRevealedToken(null);
      setShowToken(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveGitHubConfig('', '');
      setRepo('');
      setToken('');
      setRevealedToken(null);
      setShowToken(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Github className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">GitHub Connection</h2>
          {isConfigured ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-500/15 text-green-400 border-green-500/30">
              Connected
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-secondary text-muted-foreground border-border">
              Not configured
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Required to sync environment variables to GitHub Secrets and view deployment runs.
        </p>
      </div>

      <div className="px-6 py-6 space-y-4">
        <div className="grid grid-cols-[10rem_1fr] items-center gap-4">
          <span className="text-sm text-muted-foreground text-right">Repository</span>
          <Input
            placeholder="owner/repo-name"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        {/* Current token display with reveal — only when token is already set */}
        {config?.token_set && (
          <div className="grid grid-cols-[10rem_1fr] items-center gap-4">
            <span className="text-sm text-muted-foreground text-right">Current token</span>
            <div className="flex items-center gap-2 bg-secondary/40 border border-border/60 rounded-sm px-2 h-9">
              <span className="font-mono text-xs text-foreground flex-1 truncate select-all">
                {showToken && revealedToken ? revealedToken : '••••••••••••••••'}
              </span>
              <button
                onClick={toggleShowToken}
                disabled={fetchingToken}
                className="p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
              >
                {fetchingToken
                  ? <span className="text-[10px] text-muted-foreground/40">…</span>
                  : showToken
                    ? <Eye className="h-4 w-4" />
                    : <EyeOff className="h-4 w-4" />
                }
              </button>
            </div>
          </div>
        )}

        {/* Token input — new token when already set, or first-time setup */}
        <div className="grid grid-cols-[10rem_1fr] items-center gap-4">
          <span className="text-sm text-muted-foreground text-right">
            {config?.token_set ? 'New token' : 'Access token'}
          </span>
          <Input
            type="password"
            placeholder={config?.token_set ? 'Leave blank to keep current' : 'ghp_…'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        {error && (
          <div className="grid grid-cols-[10rem_1fr] gap-4">
            <span />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-[10rem_1fr] items-center gap-4 pt-1">
          <span />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="!rounded-sm"
              onClick={handleSave}
              disabled={saving || (!token && repo === (config?.repo ?? ''))}
            >
              {saving ? 'Saving…' : saved ? <><Check className="h-3.5 w-3.5 mr-1" />Saved</> : isConfigured ? 'Update' : 'Save'}
            </Button>
            {isConfigured && (
              <button
                onClick={handleClear}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
