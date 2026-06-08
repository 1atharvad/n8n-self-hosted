import { Button } from 'advi-ui';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  varKey: string;
  onCancel: () => void;
  onDelete: (key: string) => Promise<void>;
}

export const DeleteConfirmModal = ({ varKey, onCancel, onDelete }: DeleteConfirmModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <h3 className="text-base font-semibold text-foreground mb-1">Delete variable</h3>
        <p className="text-sm text-muted-foreground mb-1">
          Are you sure you want to delete:
        </p>
        <p className="font-mono text-sm font-medium text-foreground bg-secondary px-3 py-2 rounded-lg mb-5">
          {varKey}
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void onDelete(varKey)}
            className="!rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};
