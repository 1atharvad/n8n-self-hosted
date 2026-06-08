import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Button, Input } from 'advi-ui';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchGitHubConfig } from '@/api/env';
import type { GitHubConfig } from '@/api/env';
import { GitHubConfigSection } from '@/components/GitHubConfigSection';

export const PersonalTab = () => {
  const { theme, setTheme } = useSettingsStore();
  const changePassword = useAuthStore((s) => s.changePassword);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [ghConfig, setGhConfig] = useState<GitHubConfig | null>(null);

  const loadGhConfig = useCallback(() => {
    if (!isAdmin) return;
    fetchGitHubConfig().then(setGhConfig).catch(() => setGhConfig(null));
  }, [isAdmin]);

  useEffect(() => { loadGhConfig(); }, [loadGhConfig]);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const pwFields = [
    { label: 'Current password', value: oldPw, onChange: setOldPw, autoComplete: 'current-password' },
    { label: 'New password', value: newPw, onChange: setNewPw, autoComplete: 'new-password' },
    { label: 'Confirm password', value: confirmPw, onChange: setConfirmPw, autoComplete: 'new-password' },
  ];

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setPwLoading(true);
    try {
      await changePassword(oldPw, newPw);
      setPwSuccess(true);
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Appearance</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose your preferred colour scheme.</p>
        </div>
        <div className="px-6 py-6 flex gap-3">
          {([
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'system', label: 'System', icon: Monitor },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-sm border text-sm transition-colors',
                theme === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Change Password</h2>
          <p className="text-sm text-muted-foreground mt-1">Update your login credentials.</p>
        </div>
        <form onSubmit={handlePasswordChange} className="px-6 py-6">
          <input type="text" name="username" autoComplete="username" value={user?.username ?? ''} readOnly className="sr-only" aria-hidden="true" />
          <div className="space-y-4">
            {pwFields.map(({ label, value, onChange, autoComplete }) => (
              <div key={label} className="grid grid-cols-[11rem_1fr] items-center gap-4">
                <span className="text-sm text-muted-foreground text-right">{label}</span>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete={autoComplete}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                />
              </div>
            ))}

            {pwError && (
              <div className="grid grid-cols-[11rem_1fr] gap-4 items-start">
                <span />
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                  <span className="text-destructive text-xs">⚠</span>
                  <p className="text-xs text-destructive">{pwError}</p>
                </div>
              </div>
            )}

            {pwSuccess && (
              <div className="grid grid-cols-[11rem_1fr] gap-4">
                <span />
                <p className="text-xs text-green-400">Password updated successfully.</p>
              </div>
            )}

            <div className="grid grid-cols-[11rem_1fr] items-center gap-4 pt-2">
              <span />
              <Button type="submit" size="sm" className="!rounded-sm" disabled={!oldPw || !newPw || !confirmPw || pwLoading}>
                {pwLoading ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </div>
        </form>
      </section>

      {isAdmin && (
        <GitHubConfigSection config={ghConfig} onSaved={loadGhConfig} />
      )}
    </>
  );
};
