import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from 'advi-ui';
import { Plus } from 'lucide-react';

interface AddVarModalProps {
  onClose: () => void;
  onAdd: (key: string, value: string) => Promise<void>;
}

export const AddVarModal = ({ onClose, onAdd }: AddVarModalProps) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await onAdd(newKey.trim(), newValue.trim());
  };

  const handleClose = () => {
    setNewKey('');
    setNewValue('');
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
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
              onKeyDown={(e) => { if (e.key === 'Enter' && newKey.trim() && newValue.trim()) void handleAdd(); }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button size="sm" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" className="!rounded-sm" onClick={() => void handleAdd()} disabled={!newKey.trim() || !newValue.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
