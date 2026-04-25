import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Trash2 } from 'lucide-react';
import { Card, Badge } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { EmployeeAvailability, EmployeeDataManager } from '../../lib/employeeDatabase';
import type { PendingChanges } from './index';

interface EmployeeShiftsTableProps {
  shiftsForMonth: EmployeeAvailability[];
  pendingChanges: PendingChanges;
  dataManager: EmployeeDataManager;
  openViewModal: (shift: EmployeeAvailability) => void;
}

export function EmployeeShiftsTable({
  shiftsForMonth,
  pendingChanges,
  dataManager,
  openViewModal,
}: EmployeeShiftsTableProps) {
  const isMobile = useIsMobile();

  if (shiftsForMonth.length === 0) {
    return (
      <Card padding="md">
        {!isMobile && (
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Мои смены</h3>
          </div>
        )}
        <div className="text-center py-12">
          <Calendar className="mx-auto mb-3 opacity-30 h-12 w-12" style={{ color: 'var(--text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Смен в этом месяце пока нет
          </p>
        </div>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card padding="sm">
        <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>Мои смены</h3>
        <div className="space-y-2">
          {shiftsForMonth.map((shift, index) => {
            const canDelete = shift.id < 0 || dataManager?.canDeleteAvailability(shift);
            const isPending = shift.id < 0;
            const isPendingDeletion = pendingChanges.deletions.some(d => d.id === shift.id);
            
            const bgColor = isPending
              ? 'rgba(var(--warning-rgb, 251, 191, 36), 0.1)'
              : index % 2 === 0 
                ? 'rgba(var(--primary-rgb, 249, 115, 22), 0.05)' 
                : 'rgba(var(--primary-rgb, 249, 115, 22), 0.02)';
            
            return (
              <Card 
                key={shift.id}
                padding="sm"
                className="active:scale-98 transition-transform"
                onClick={() => openViewModal(shift)}
                style={{
                  backgroundColor: bgColor,
                  border: isPending ? '2px dashed var(--warning)' : '1px solid var(--border)',
                  opacity: isPendingDeletion ? 0.5 : 1,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                      {format(parseISO(shift.work_date), 'dd MMMM', { locale: ru })}
                    </div>
                    {isPending && (
                      <Badge variant="warning" size="sm">Новая</Badge>
                    )}
                    {isPendingDeletion && (
                      <Badge variant="danger" size="sm">Удалена</Badge>
                    )}
                  </div>
                  <Badge variant={shift.is_full_day ? 'success' : 'warning'} size="sm">
                    {shift.is_full_day ? 'Полная' : 'Неполная'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {shift.is_full_day 
                      ? 'Весь день' 
                      : `${shift.start_time?.slice(0, 5) || '00:00'}–${shift.end_time?.slice(0, 5) || '00:00'}`
                    }
                  </span>
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openViewModal(shift);
                      }}
                      className="p-1.5 rounded-lg active:scale-95 transition-transform"
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Мои смены</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Статус</th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {shiftsForMonth.map((shift, index) => {
              const canDelete = shift.id < 0 || dataManager?.canDeleteAvailability(shift);
              const isPending = shift.id < 0;
              const isPendingDeletion = pendingChanges.deletions.some(d => d.id === shift.id);
              
              return (
                <tr 
                  key={shift.id}
                  onClick={() => openViewModal(shift)}
                  className="border-b cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  style={{ 
                    borderColor: 'var(--border)',
                    backgroundColor: isPending
                      ? 'rgba(var(--warning-rgb, 251, 191, 36), 0.05)'
                      : index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                    opacity: isPendingDeletion ? 0.5 : 1,
                  }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(shift.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={shift.is_full_day ? 'success' : 'warning'}>
                      {shift.is_full_day ? 'Полная' : 'Неполная'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {shift.is_full_day 
                      ? 'Весь день' 
                      : `${shift.start_time?.slice(0, 5) || '00:00'}–${shift.end_time?.slice(0, 5) || '00:00'}`
                    }
                  </td>
                  <td className="px-4 py-3">
                    {isPending && <Badge variant="warning" size="sm">Новая</Badge>}
                    {isPendingDeletion && <Badge variant="danger" size="sm">Удалена</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canDelete ? (
                      <button
                        onClick={() => openViewModal(shift)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900"
                        style={{ color: 'var(--error)' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Блок</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
