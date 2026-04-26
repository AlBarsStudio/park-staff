import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Clock, Edit2, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Card, Badge, Button } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { ScheduleAssignment, EmployeeDataManager } from '../../lib/employeeDatabase';

interface EmployeeScheduleTableProps {
  scheduleForMonth: ScheduleAssignment[];
  dataManager: EmployeeDataManager;
  openTimeLogModal: (schedule: ScheduleAssignment) => void;
  onUpdateActualTime?: (logId: number, actualStart: string, actualEnd: string) => Promise<void>;
}

export function EmployeeScheduleTable({
  scheduleForMonth,
  dataManager,
  openTimeLogModal,
  onUpdateActualTime,
}: EmployeeScheduleTableProps) {
  const isMobile = useIsMobile();
  
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleEditStart = (log: any) => {
    setEditingLogId(log.id);
    setEditStart(log.actual_start.slice(0, 5));
    setEditEnd(log.actual_end.slice(0, 5));
  };

  const handleEditCancel = () => {
    setEditingLogId(null);
    setEditStart('');
    setEditEnd('');
  };

  const handleEditSave = async (logId: number) => {
    if (!editStart || !editEnd || !onUpdateActualTime) return;
    
    setUpdating(true);
    try {
      await onUpdateActualTime(logId, editStart, editEnd);
      setEditingLogId(null);
      setEditStart('');
      setEditEnd('');
    } catch (error) {
      console.error('Ошибка обновления времени:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (scheduleForMonth.length === 0) {
    return (
      <Card padding={isMobile ? 'sm' : 'md'}>
        {!isMobile && (
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5" style={{ color: 'var(--info)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
              График от администратора
            </h3>
          </div>
        )}
        {isMobile && (
          <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>
            График от администратора
          </h3>
        )}
        <div className="text-center py-12">
          <Calendar
            className="mx-auto mb-3 opacity-30 h-12 w-12"
            style={{ color: 'var(--text-subtle)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            График не найден
          </p>
        </div>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <Card padding="sm">
        <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>
          График от администратора
        </h3>
        <div className="space-y-2">
          {scheduleForMonth.map((schedule, index) => {
            const log = dataManager?.getActualWorkLog(schedule.id);
            const canLog = dataManager?.canLogActualTime(schedule);
            const attraction = dataManager?.getAttraction(schedule.attraction_id);

            const bgColor =
              index % 2 === 0
                ? 'rgba(var(--info-rgb, 59, 130, 246), 0.05)'
                : 'rgba(var(--info-rgb, 59, 130, 246), 0.02)';

            return (
              <Card
                key={schedule.id}
                padding="sm"
                style={{
                  backgroundColor: bgColor,
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div
                      className="font-medium text-sm mb-1"
                      style={{ color: 'var(--text)' }}
                    >
                      {format(parseISO(schedule.work_date), 'dd MMMM', { locale: ru })}
                    </div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: 'var(--primary)' }}
                    >
                      {attraction?.name || '—'}
                    </div>
                    <div
                      className="text-xs flex items-center gap-1 mt-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Clock className="h-3 w-3" />
                      По расписанию: {schedule.start_time?.slice(0, 5) || '00:00'} –{' '}
                      {schedule.end_time?.slice(0, 5) || '00:00'}
                    </div>

                    {log && editingLogId !== log.id && (
                      <div className="text-xs mt-1 font-medium" style={{ color: 'var(--success)' }}>
                        Фактически: {log.actual_start.slice(0, 5)} - {log.actual_end.slice(0, 5)}
                      </div>
                    )}

                    {log && editingLogId === log.id && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border text-xs"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          />
                          <input
                            type="time"
                            value={editEnd}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="flex-1 px-2 py-1 rounded border text-xs"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--text)',
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditSave(log.id)}
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            disabled={updating}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={handleEditCancel}
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            disabled={updating}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {log && editingLogId !== log.id && onUpdateActualTime ? (
                    <button
                      onClick={() => handleEditStart(log)}
                      className="p-1 rounded hover:bg-black/5"
                      style={{ color: 'var(--primary)' }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  ) : !log && canLog?.allowed ? (
                    <Button
                      onClick={() => openTimeLogModal(schedule)}
                      variant="secondary"
                      size="sm"
                    >
                      Отметить
                    </Button>
                  ) : null}
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
        <Clock className="h-5 w-5" style={{ color: 'var(--info)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
          График от администратора
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Дата
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Аттракцион
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Время по расписанию
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Фактическое время
              </th>
              <th
                className="px-4 py-3 text-center text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Действие
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduleForMonth.map((schedule, index) => {
              const log = dataManager?.getActualWorkLog(schedule.id);
              const canLog = dataManager?.canLogActualTime(schedule);
              const attraction = dataManager?.getAttraction(schedule.attraction_id);

              return (
                <tr
                  key={schedule.id}
                  className="border-b"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor:
                      index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                  }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(schedule.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-medium"
                    style={{ color: 'var(--text)' }}
                  >
                    {attraction?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {schedule.start_time?.slice(0, 5) || '00:00'} –{' '}
                    {schedule.end_time?.slice(0, 5) || '00:00'}
                  </td>
                  <td className="px-4 py-3">
                    {log && editingLogId !== log.id && (
                      <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                        {log.actual_start.slice(0, 5)} - {log.actual_end.slice(0, 5)}
                      </span>
                    )}
                    {log && editingLogId === log.id && (
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          className="px-2 py-1 rounded border text-sm"
                          style={{
                            backgroundColor: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        />
                        <input
                          type="time"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          className="px-2 py-1 rounded border text-sm"
                          style={{
                            backgroundColor: 'var(--surface)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        />
                      </div>
                    )}
                    {!log && (
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Не отмечено
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log && editingLogId === log.id ? (
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleEditSave(log.id)}
                          variant="primary"
                          size="sm"
                          disabled={updating}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={handleEditCancel}
                          variant="secondary"
                          size="sm"
                          disabled={updating}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : log && onUpdateActualTime ? (
                      <button
                        onClick={() => handleEditStart(log)}
                        className="p-2 rounded-lg transition-colors hover:bg-blue-50 dark:hover:bg-blue-900"
                        style={{ color: 'var(--primary)' }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    ) : !log && canLog?.allowed ? (
                      <Button
                        onClick={() => openTimeLogModal(schedule)}
                        variant="secondary"
                        size="sm"
                      >
                        Отметить
                      </Button>
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--text-subtle)' }}
                      >
                        —
                      </span>
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
