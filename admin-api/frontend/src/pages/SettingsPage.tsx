import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLogStore } from '@/store/useLogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { UserManagement } from '@/components/UserManagement';
import { Header } from '@/components/Header';
import { Button, Input } from 'advi-ui';
import { AppSidebar } from '@/components/AppSidebar';
import type { SidebarSection } from '@/components/AppSidebar';
import {
  LogOut, ChevronLeft, User, Box, Users, KeyRound, Plus, Trash2,
  Eye, EyeOff, Rocket, Check, AlertCircle, Search, Upload, Pencil, ChevronDown,
} from 'lucide-react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchEnvVars, fetchEnvVarValue, setEnvVar, deleteEnvVar, deployEnv } from '@/api/env';
import type { EnvVarKey } from '@/api/env';

type Tab = 'personal' | 'containers' | 'users' | 'environment';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const activeTab: Tab = (tab as Tab) ?? 'personal';
  const setActiveTab = (next: Tab) => navigate(`/settings/${next}`);
  const labels = useLogStore((s) => s.labels);
  const loadLabels = useLogStore((s) => s.loadLabels);
  const { visibleContainers, setVisibleContainers, theme, setTheme } = useSettingsStore();
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [asideOpen, setAsideOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() =>
    visibleContainers.length === 0 ? new Set() : new Set(visibleContainers)
  );
  const [containersSaved, setContainersSaved] = useState(false);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // ── Environment state ──────────────────────────────────────────────────────
  const [envKeys, setEnvKeys] = useState<EnvVarKey[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  // values fetched on-demand; cached so repeated reveals skip the network
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  // keys whose values are currently visible in view mode
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  // keys with an in-flight fetch
  const [fetchingKeys, setFetchingKeys] = useState<Set<string>>(new Set());

  const [isEditMode, setIsEditMode] = useState(false);
  // pending edits: key → new value (only for keys the user has revealed/edited)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // import modal
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<{
    vars: Record<string, string>;
    duplicates: string[];
  } | null>(null);

  // ── Env handlers ───────────────────────────────────────────────────────────

  const loadEnvVars = useCallback(() => {
    setEnvLoading(true);
    setEnvError(null);
    fetchEnvVars()
      .then(setEnvKeys)
      .catch((e: Error) => setEnvError(e.message))
      .finally(() => setEnvLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'environment') loadEnvVars();
  }, [activeTab, loadEnvVars]);

  const fetchValue = async (key: string): Promise<string> => {
    if (revealedValues[key] !== undefined) return revealedValues[key];
    setFetchingKeys((prev) => new Set(prev).add(key));
    try {
      const value = await fetchEnvVarValue(key);
      setRevealedValues((prev) => ({ ...prev, [key]: value }));
      return value;
    } finally {
      setFetchingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const toggleShowValue = async (key: string) => {
    if (fetchingKeys.has(key)) return;
    if (revealedValues[key] === undefined) {
      const value = await fetchValue(key);
      setShowValues((prev) => new Set(prev).add(key));
      // In edit mode, also load into draft so the input has a value
      if (isEditMode) {
        setEditDraft((prev) => ({ ...prev, [key]: value }));
      }
    } else {
      setShowValues((prev) => {
        const next = new Set(prev);
        if (next.has(key)) { next.delete(key); } else { next.add(key); }
        return next;
      });
    }
  };

  const enterEditMode = () => {
    setIsEditMode(true);
    setSaveError(null);
    // pre-populate draft with already-revealed values
    setEditDraft({ ...revealedValues });
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setEditDraft({});
    setSaveError(null);
    setConfirmDeleteKey(null);
  };

  const handleSave = async () => {
    if (Object.keys(editDraft).length === 0) { exitEditMode(); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(Object.entries(editDraft).map(([k, v]) => setEnvVar(k, v)));
      setRevealedValues((prev) => ({ ...prev, ...editDraft }));
      exitEditMode();
      loadEnvVars();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndDeploy = async () => {
    setSaving(true);
    setSaveError(null);
    if (deployTimerRef.current) clearTimeout(deployTimerRef.current);
    try {
      if (Object.keys(editDraft).length > 0) {
        await Promise.all(Object.entries(editDraft).map(([k, v]) => setEnvVar(k, v)));
        setRevealedValues((prev) => ({ ...prev, ...editDraft }));
      }
      exitEditMode();
      setDeploying(true);
      const res = await deployEnv();
      setDeployResult({ ok: true, msg: `${res.pushed} secrets pushed — deploy triggered.` });
      loadEnvVars();
    } catch (e) {
      setDeployResult({ ok: false, msg: e instanceof Error ? e.message : 'Deploy failed' });
    } finally {
      setSaving(false);
      setDeploying(false);
      deployTimerRef.current = setTimeout(() => setDeployResult(null), 6000);
    }
  };

  const handleEnvAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    const k = newKey.trim();
    const v = newValue.trim();
    await setEnvVar(k, v);
    setRevealedValues((prev) => ({ ...prev, [k]: v }));
    setShowValues((prev) => new Set(prev).add(k));
    setNewKey('');
    setNewValue('');
    setShowAddForm(false); // closes modal
    loadEnvVars();
  };

  const handleEnvDelete = async (key: string) => {
    await deleteEnvVar(key);
    setConfirmDeleteKey(null);
    setRevealedValues((prev) => { const n = { ...prev }; delete n[key]; return n; });
    setShowValues((prev) => { const s = new Set(prev); s.delete(key); return s; });
    setEditDraft((prev) => { const n = { ...prev }; delete n[key]; return n; });
    loadEnvVars();
  };

  // ── Import handlers ─────────────────────────────────────────────────────────

  const parseImportText = (text: string): Record<string, string> | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const result: Record<string, string> = {};
    for (const line of trimmed.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx === -1) continue;
      const key = t.slice(0, idx).trim();
      let value = t.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) result[key] = value;
    }
    return Object.keys(result).length > 0 ? result : null;
  };

  const doImport = async (vars: Record<string, string>) => {
    try {
      await Promise.all(Object.entries(vars).map(([k, v]) => setEnvVar(k, v)));
      setRevealedValues((prev) => ({ ...prev, ...vars }));
      setShowImportModal(false);
      setImportText('');
      setImportError(null);
      setConfirmImport(null);
      loadEnvVars();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
      setConfirmImport(null);
    }
  };

  const handleImportSubmit = () => {
    setImportError(null);
    const vars = parseImportText(importText);
    if (!vars) {
      setImportError('Could not parse input. Use KEY=value format, one per line.');
      return;
    }
    const existingKeys = new Set(envKeys.map((v) => v.key));
    const duplicates = Object.keys(vars).filter((k) => existingKeys.has(k));
    if (duplicates.length > 0) {
      setConfirmImport({ vars, duplicates });
      return;
    }
    void doImport(vars);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText((ev.target?.result as string) ?? '');
      setImportError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Other handlers ─────────────────────────────────────────────────────────

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

  const handleLogout = () => { logout(); navigate('/login'); };

  const pwFields = [
    { label: 'Current password', value: oldPw, onChange: setOldPw, autoComplete: 'current-password' },
    { label: 'New password',     value: newPw, onChange: setNewPw, autoComplete: 'new-password' },
    { label: 'Confirm password', value: confirmPw, onChange: setConfirmPw, autoComplete: 'new-password' },
  ];

  const navSections: SidebarSection[] = [
    {
      title: 'Settings',
      items: [
        { icon: <User className="h-4 w-4" />,  label: 'Personal',   onClick: () => setActiveTab('personal'),   active: activeTab === 'personal' },
        { icon: <Box className="h-4 w-4" />,   label: 'Containers', onClick: () => setActiveTab('containers'), active: activeTab === 'containers' },
        ...(isAdmin ? [
          { icon: <Users className="h-4 w-4" />,    label: 'Users',       onClick: () => setActiveTab('users'),       active: activeTab === 'users' },
          { icon: <KeyRound className="h-4 w-4" />, label: 'Environment', onClick: () => setActiveTab('environment'), active: activeTab === 'environment' },
        ] : []),
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        title="Settings"
        actions={
          <Button variant="ghost" size="sm" className="!rounded-sm" onClick={() => navigate('/dashboard')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          open={asideOpen}
          onToggle={() => setAsideOpen((v) => !v)}
          sections={navSections}
          footer={(open) => (
            <div className={cn('px-2 py-1', !open && 'flex justify-center')}>
              <button
                onClick={handleLogout}
                title="Sign out"
                className={cn(
                  'flex items-center gap-2.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary',
                  open ? 'w-full px-3 py-1.5 rounded-sm' : 'p-2 rounded-sm'
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {open && <span className="text-sm truncate">Sign out</span>}
              </button>
            </div>
          )}
        />

        <main className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-20 py-8 md:py-12">
          <div className="space-y-6">

            {/* Personal */}
            {activeTab === 'personal' && (
              <>
                <section className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">Appearance</h2>
                    <p className="text-sm text-muted-foreground mt-1">Choose your preferred colour scheme.</p>
                  </div>
                  <div className="px-6 py-6 flex gap-3">
                    {([
                      { value: 'light',  label: 'Light',  icon: Sun },
                      { value: 'dark',   label: 'Dark',   icon: Moon },
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
              </>
            )}

            {/* Containers */}
            {activeTab === 'containers' && (
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
            )}

            {/* Users (admin only) */}
            {activeTab === 'users' && isAdmin && (
              <section className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-border">
                  <h2 className="text-base font-semibold text-foreground">User Management</h2>
                  <p className="text-sm text-muted-foreground mt-1">Create users, assign roles, and restrict container access.</p>
                </div>
                <div className="px-6 py-6">
                  <UserManagement />
                </div>
              </section>
            )}

            {/* Environment (admin only) */}
            {activeTab === 'environment' && isAdmin && (() => {
              const filteredKeys = envKeys.filter((v) =>
                !searchQuery || v.key.toLowerCase().includes(searchQuery.toLowerCase())
              );
              return (
                <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col max-h-[80vh]">

                  {/* Card header — matches other tabs' header pattern */}
                  <div className="px-6 py-5 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">Environment Variables</h2>
                      <span className="text-[10px] font-semibold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                        {envKeys.length} var{envKeys.length !== 1 ? 's' : ''}
                      </span>
                      {isEditMode && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 shrink-0">
                          <Pencil className="h-2.5 w-2.5" />
                          Editing
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage variables stored in SQLite. Use Save &amp; Deploy to push to GitHub Secrets.
                    </p>
                  </div>

                  {/* Toolbar */}
                  <div className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0">
                      <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search variables…"
                          className="w-full bg-secondary/40 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      {isEditMode ? (
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            onClick={() => setShowImportModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Import
                          </button>
                          <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </button>
                        </div>
                      ) : (
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            onClick={enterEditMode}
                            disabled={envKeys.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Save error */}
                    {saveError && (
                      <div className="mx-5 my-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0">
                        <AlertCircle className="h-4 w-4 shrink-0" />{saveError}
                      </div>
                    )}

                    {/* Deploy result */}
                    {deployResult && (
                      <div className={`mx-5 my-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs shrink-0 ${deployResult.ok ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
                        <AlertCircle className="h-4 w-4 shrink-0" />{deployResult.msg}
                      </div>
                    )}

                    {/* Fetch error */}
                    {envError && (
                      <div className="mx-5 my-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0">
                        <AlertCircle className="h-4 w-4 shrink-0" />{envError}
                      </div>
                    )}

                    {/* Column headers */}
                    {!envLoading && filteredKeys.length > 0 && (
                      <div className={`shrink-0 grid ${isEditMode ? 'grid-cols-[4fr_8fr_52px]' : 'grid-cols-[4fr_8fr]'} px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/60 bg-background/20`}>
                        <span>Key</span>
                        <span>Value</span>
                        {isEditMode && <span className="text-right">Del</span>}
                      </div>
                    )}

                    {/* Scrollable rows */}
                    <div className="flex-1 overflow-y-auto">
                      {envLoading ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">Loading…</div>
                      ) : filteredKeys.length === 0 ? (
                        <div className="py-14 flex flex-col items-center gap-3">
                          <KeyRound className="h-8 w-8 text-muted-foreground/20" />
                          <p className="text-sm text-muted-foreground">
                            {searchQuery ? 'No variables match your search.' : 'No variables yet.'}
                          </p>
                          {!searchQuery && (
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => { enterEditMode(); setShowAddForm(true); setNewKey(''); setNewValue(''); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add variable
                              </button>
                              <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Import
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {filteredKeys.map((v) => {
                            const revealed = revealedValues[v.key];
                            const draftVal = editDraft[v.key];
                            const isFetching = fetchingKeys.has(v.key);
                            return (
                              <div key={v.key} className={`grid ${isEditMode ? 'grid-cols-[4fr_8fr_52px]' : 'grid-cols-[4fr_8fr]'} items-center px-5 py-3 hover:bg-secondary/10 transition-colors`}>

                                {/* Key */}
                                <div className="flex items-center gap-2 pr-4 min-w-0">
                                  {isEditMode ? (
                                    <input
                                      readOnly
                                      value={v.key}
                                      className="font-mono text-xs font-medium text-foreground bg-secondary/30 border border-border/60 rounded-sm px-2 h-7 w-full outline-none cursor-default select-all"
                                    />
                                  ) : (
                                    <>
                                      <KeyRound className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                      <span className="font-mono text-xs font-medium text-foreground truncate">{v.key}</span>
                                    </>
                                  )}
                                </div>

                                {/* Value */}
                                <div className="flex items-center gap-2 min-w-0 pr-3">
                                  {isEditMode ? (
                                    <>
                                      {draftVal !== undefined && showValues.has(v.key) ? (
                                        <Input
                                          value={draftVal}
                                          onChange={(e) => setEditDraft((prev) => ({ ...prev, [v.key]: e.target.value }))}
                                          className="font-mono text-xs h-7 flex-1"
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          readOnly
                                          value={isFetching ? '' : '••••••••••••••••'}
                                          placeholder={isFetching ? 'Fetching…' : ''}
                                          onClick={() => { if (!isFetching) void toggleShowValue(v.key); }}
                                          className="font-mono text-xs h-7 flex-1 cursor-pointer bg-secondary/30 border border-border/60 rounded-sm px-2 text-muted-foreground/50 outline-none select-none"
                                        />
                                      )}
                                      <button
                                        onClick={() => void toggleShowValue(v.key)}
                                        className="p-1 rounded-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
                                        title={showValues.has(v.key) ? 'Hide' : 'Reveal'}
                                        disabled={isFetching}
                                      >
                                        {isFetching
                                          ? <span className="text-xs text-muted-foreground/40">…</span>
                                          : showValues.has(v.key)
                                            ? <Eye className="h-4 w-4" />
                                            : <EyeOff className="h-4 w-4" />
                                        }
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                                        {showValues.has(v.key) && revealed !== undefined ? revealed : '••••••••••••••••'}
                                      </span>
                                      <button
                                        onClick={() => void toggleShowValue(v.key)}
                                        className="p-1 rounded-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
                                        title={showValues.has(v.key) ? 'Hide' : 'Reveal'}
                                        disabled={isFetching}
                                      >
                                        {isFetching
                                          ? <span className="text-xs text-muted-foreground/40">…</span>
                                          : showValues.has(v.key)
                                            ? <Eye className="h-4 w-4" />
                                            : <EyeOff className="h-4 w-4" />
                                        }
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Delete — edit mode only */}
                                {isEditMode && (
                                  <div className="flex items-center justify-end">
                                    <button
                                      onClick={() => setConfirmDeleteKey(v.key)}
                                      className="p-1.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {!envLoading && envKeys.length > 0 && (
                      <div className="px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground bg-background/20 shrink-0">
                        {searchQuery ? `${filteredKeys.length} of ${envKeys.length}` : envKeys.length} variable{envKeys.length !== 1 ? 's' : ''} · values fetched on demand
                      </div>
                    )}

                    {/* Bottom action bar — edit mode only */}
                    {isEditMode && (
                      <div className="px-5 py-3 border-t border-border bg-background/40 flex items-center justify-between shrink-0">
                        <Button size="sm" variant="ghost" onClick={exitEditMode} disabled={saving}>
                          Cancel
                        </Button>
                        <div className="relative">
                          {/* Click-away backdrop */}
                          {showSaveDropdown && (
                            <div className="fixed inset-0 z-[10]" onClick={() => setShowSaveDropdown(false)} />
                          )}
                          {/* Dropdown menu (above the button) */}
                          {showSaveDropdown && (
                            <div className="absolute bottom-full right-0 mb-1.5 z-[11] bg-popover border border-border rounded-sm shadow-xl overflow-hidden min-w-[160px]">
                              <button
                                onClick={() => { setShowSaveDropdown(false); void handleSave(); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                              >
                                <Check className="h-3.5 w-3.5 text-muted-foreground" />
                                Save
                              </button>
                              <button
                                onClick={() => { setShowSaveDropdown(false); void handleSaveAndDeploy(); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors border-t border-border/60"
                              >
                                <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
                                Save & Deploy
                              </button>
                            </div>
                          )}
                          {/* Split button */}
                          <div className="flex rounded-sm overflow-hidden">
                            <button
                              onClick={() => void handleSave()}
                              disabled={saving}
                              className="px-3 h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 border-r border-primary-foreground/20"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setShowSaveDropdown((v) => !v)}
                              disabled={saving || deploying}
                              className="px-2 h-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                </section>
              );
            })()}

          </div>
        </main>
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-foreground mb-1">Delete variable</h3>
            <p className="text-sm text-muted-foreground mb-1">
              Are you sure you want to delete:
            </p>
            <p className="font-mono text-sm font-medium text-foreground bg-secondary px-3 py-2 rounded-lg mb-5">
              {confirmDeleteKey}
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteKey(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleEnvDelete(confirmDeleteKey)}
                className="!rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add variable modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddForm(false); setNewKey(''); setNewValue(''); } }}
        >
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-foreground mb-4">Add variable</h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Key</label>
                <Input
                  autoFocus
                  placeholder="MY_VARIABLE"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Value</label>
                <Input
                  placeholder="Enter value…"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="font-mono text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newKey.trim() && newValue.trim()) void handleEnvAdd(); }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewKey(''); setNewValue(''); }}>
                Cancel
              </Button>
              <Button size="sm" className="!rounded-sm" onClick={() => void handleEnvAdd()} disabled={!newKey.trim() || !newValue.trim()}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowImportModal(false); setImportText(''); setImportError(null); setConfirmImport(null); } }}
        >
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-foreground mb-1">Import variables</h3>

            {confirmImport ? (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  The following keys already exist and will be overwritten:
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                  <div className="flex flex-wrap gap-1.5">
                    {confirmImport.duplicates.map((k) => (
                      <span key={k} className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded border border-border">{k}</span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmImport(null)}>Back</Button>
                  <Button size="sm" className="!rounded-sm" onClick={() => void doImport(confirmImport.vars)}>
                    Overwrite & import
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Paste in <code className="font-mono bg-secondary px-1 rounded text-[10px]">KEY=value</code> format, one per line. Lines starting with <code className="font-mono bg-secondary px-1 rounded text-[10px]">#</code> are ignored.
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportError(null); }}
                  placeholder={'DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=mydb\n\n# comments are ignored'}
                  className="w-full h-40 bg-secondary/40 border border-border rounded-lg p-3 font-mono text-xs placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-ring resize-none mb-3"
                />
                {importError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive mb-3">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{importError}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1.5 rounded-sm border border-border hover:border-border/80 transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Import .env file
                    <input type="file" accept=".env,text/plain" className="sr-only" onChange={handleFileImport} />
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setShowImportModal(false); setImportText(''); setImportError(null); }}>
                      Cancel
                    </Button>
                    <Button size="sm" className="!rounded-sm" onClick={handleImportSubmit} disabled={!importText.trim()}>
                      Import
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
