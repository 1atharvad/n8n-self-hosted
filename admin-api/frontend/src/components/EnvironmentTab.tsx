import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input } from 'advi-ui';
import {
  KeyRound, Plus, Trash2, Eye, EyeOff, Rocket, Check,
  AlertCircle, Search, Upload, Pencil, ChevronDown,
} from 'lucide-react';
import { fetchEnvVars, fetchEnvVarValue, setEnvVar, deleteEnvVar, deployEnv } from '@/api/env';
import type { EnvVarKey } from '@/api/env';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { AddVarModal } from '@/components/AddVarModal';
import { ImportModal } from '@/components/ImportModal';

export const EnvironmentTab = () => {
  const [envKeys, setEnvKeys] = useState<EnvVarKey[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [fetchingKeys, setFetchingKeys] = useState<Set<string>>(new Set());

  const [isEditMode, setIsEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const loadEnvVars = useCallback(() => {
    setEnvLoading(true);
    setEnvError(null);
    fetchEnvVars()
      .then(setEnvKeys)
      .catch((e: Error) => setEnvError(e.message))
      .finally(() => setEnvLoading(false));
  }, []);

  useEffect(() => { loadEnvVars(); }, [loadEnvVars]);

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
      await deployEnv();
      setDeployResult({ ok: true, msg: 'Deploy triggered — workflow running.' });
      loadEnvVars();
    } catch (e) {
      setDeployResult({ ok: false, msg: e instanceof Error ? e.message : 'Deploy failed' });
    } finally {
      setSaving(false);
      setDeploying(false);
      deployTimerRef.current = setTimeout(() => setDeployResult(null), 6000);
    }
  };

  const handleEnvAdd = async (key: string, value: string) => {
    await setEnvVar(key, value);
    setRevealedValues((prev) => ({ ...prev, [key]: value }));
    setShowValues((prev) => new Set(prev).add(key));
    setShowAddForm(false);
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

  const handleImport = async (vars: Record<string, string>) => {
    await Promise.all(Object.entries(vars).map(([k, v]) => setEnvVar(k, v)));
    setRevealedValues((prev) => ({ ...prev, ...vars }));
    loadEnvVars();
  };

  const filteredKeys = envKeys.filter((v) =>
    !searchQuery || v.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col max-h-[80vh]">

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

        {saveError && (
          <div className="mx-5 my-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />{saveError}
          </div>
        )}

        {deployResult && (
          <div className={`mx-5 my-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs shrink-0 ${deployResult.ok ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
            <AlertCircle className="h-4 w-4 shrink-0" />{deployResult.msg}
          </div>
        )}

        {envError && (
          <div className="mx-5 my-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />{envError}
          </div>
        )}

        {!envLoading && filteredKeys.length > 0 && (
          <div className={`shrink-0 grid ${isEditMode ? 'grid-cols-[4fr_8fr_52px]' : 'grid-cols-[4fr_8fr]'} px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/60 bg-background/20`}>
            <span>Key</span>
            <span>Value</span>
            {isEditMode && <span className="text-right">Del</span>}
          </div>
        )}

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
                    onClick={() => { enterEditMode(); setShowAddForm(true); }}
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

        {!envLoading && envKeys.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground bg-background/20 shrink-0">
            {searchQuery ? `${filteredKeys.length} of ${envKeys.length}` : envKeys.length} variable{envKeys.length !== 1 ? 's' : ''} · values fetched on demand
          </div>
        )}

        {isEditMode && (
          <div className="px-5 py-3 border-t border-border bg-background/40 flex items-center justify-between shrink-0">
            <Button size="sm" variant="ghost" onClick={exitEditMode} disabled={saving}>
              Cancel
            </Button>
            <div className="relative">
              {showSaveDropdown && (
                <div className="fixed inset-0 z-[10]" onClick={() => setShowSaveDropdown(false)} />
              )}
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

      {confirmDeleteKey && (
        <DeleteConfirmModal
          varKey={confirmDeleteKey}
          onCancel={() => setConfirmDeleteKey(null)}
          onDelete={handleEnvDelete}
        />
      )}

      {showAddForm && (
        <AddVarModal
          onClose={() => setShowAddForm(false)}
          onAdd={handleEnvAdd}
        />
      )}

      {showImportModal && (
        <ImportModal
          existingKeys={envKeys.map((v) => v.key)}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}
    </>
  );
};
