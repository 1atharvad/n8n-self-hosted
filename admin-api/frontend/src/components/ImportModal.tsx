import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from 'advi-ui';
import { Upload, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  existingKeys: string[];
  onClose: () => void;
  onImport: (vars: Record<string, string>) => Promise<void>;
}

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

export const ImportModal = ({ existingKeys, onClose, onImport }: ImportModalProps) => {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<{
    vars: Record<string, string>;
    duplicates: string[];
  } | null>(null);

  const handleClose = () => {
    setImportText('');
    setImportError(null);
    setConfirmImport(null);
    onClose();
  };

  const handleSubmit = () => {
    setImportError(null);
    const vars = parseImportText(importText);
    if (!vars) {
      setImportError('Could not parse input. Use KEY=value format, one per line.');
      return;
    }
    const existingSet = new Set(existingKeys);
    const duplicates = Object.keys(vars).filter((k) => existingSet.has(k));
    if (duplicates.length > 0) {
      setConfirmImport({ vars, duplicates });
      return;
    }
    void onImport(vars).then(handleClose).catch((e: Error) => setImportError(e.message));
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
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
              <Button size="sm" className="!rounded-sm" onClick={() => void onImport(confirmImport.vars).then(handleClose).catch((e: Error) => setImportError(e.message))}>
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
                <Button size="sm" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button size="sm" className="!rounded-sm" onClick={handleSubmit} disabled={!importText.trim()}>
                  Import
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
