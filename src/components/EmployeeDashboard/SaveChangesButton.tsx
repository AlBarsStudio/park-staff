import { Save, AlertTriangle } from 'lucide-react';
import { Button } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { PendingChanges } from './index';

interface SaveChangesButtonProps {
  pendingChanges: PendingChanges;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function SaveChangesButton({
  pendingChanges,
  isSaving,
  onSave,
  onCancel,
}: SaveChangesButtonProps) {
  const isMobile = useIsMobile();
  
  const hasChanges = pendingChanges.additions.length > 0 || pendingChanges.deletions.length > 0;
  
  if (!hasChanges) return null;

  const changesText = `${pendingChanges.additions.length > 0 ? `+${pendingChanges.additions.length}` : ''}${pendingChanges.deletions.length > 0 ? ` -${pendingChanges.deletions.length}` : ''}`;

  return (
    <div 
      className="fixed z-50 shadow-2xl rounded-2xl p-4"
      style={{
        bottom: isMobile ? '80px' : '24px',
        right: '24px',
        background: 'linear-gradient(135deg, var(--warning), var(--warning-hover))',
        border: '2px solid var(--warning)',
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-white animate-pulse" />
        <div className="text-white">
          <p className="font-bold text-sm">Несохраненные изменения</p>
          <p className="text-xs opacity-90">{changesText} операций</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          onClick={onCancel}
          variant="secondary"
          size="sm"
          className="flex-1"
        >
          Отменить
        </Button>
        <Button
          onClick={onSave}
          variant="primary"
          size="sm"
          loading={isSaving}
          icon={<Save className="h-4 w-4" />}
          className="flex-1"
          style={{
            backgroundColor: 'white',
            color: 'var(--warning)',
          }}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}
