import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { ScheduleAssignment, EmployeeDataManager } from '../../lib/employeeDatabase';

interface EmployeeScheduleTableProps {
  scheduleForMonth: ScheduleAssignment[];
  dataManager: EmployeeDataManager;
  openTimeLogModal: (schedule: ScheduleAssignment) => void;
}

export function EmployeeScheduleTable({
  scheduleForMonth,
  dataManager,
  openTimeLogModal,
}: EmployeeScheduleTableProps) {
  const isMobile = useIsMobile();

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
                  <div>
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
                  </div>
                  {log ? (
                    <Badge variant="success" dot size="sm">
                      Отмечено
                    </Badge>
                  ) : canLog?.allowed ? (
                    <Button
                      onClick={() => openTimeLogModal(schedule)}
                      variant="secondary"
                      size="sm"
                    >
                      Отметить
                    </Button>
                  ) : null}
                </div>
                <div
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Clock className="h-3 w-3" />
                  {schedule.start_time?.slice(0, 5) || '00:00'} –{' '}
                  {schedule.end_time?.slice(0, 5) || '00:00'}
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
                Время
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Статус
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
                    {log ? (
                      <Badge variant="success" dot>
                        Отмечено
                      </Badge>
                    ) : canLog?.allowed ? (
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
                        Недоступно
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
