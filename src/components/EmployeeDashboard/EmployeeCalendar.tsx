import { format, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, AlertTriangle } from 'lucide-react';
import { Card, Button } from '../ui';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { EmployeeAvailability, EmployeeDataManager } from '../../lib/employeeDatabase';
import type { PendingChanges } from './index';

interface EmployeeCalendarProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  mergedAvailability: EmployeeAvailability[];
  occupiedDates: Set<string>;
  pendingChanges: PendingChanges;
  dataManager: EmployeeDataManager;
  openAddModal: (dateStr: string) => void;
  openViewModal: (shift: EmployeeAvailability) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function EmployeeCalendar({
  currentDate,
  setCurrentDate,
  mergedAvailability,
  occupiedDates,
  pendingChanges,
  dataManager,
  openAddModal,
  openViewModal,
  isSaving,
  onSave,
  onCancel,
}: EmployeeCalendarProps) {
  const isMobile = useIsMobile();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const days = [];

  const currentMonthLabel = format(currentDate, 'LLLL yyyy', { locale: ru });
  const hasChanges = pendingChanges.additions.length > 0 || pendingChanges.deletions.length > 0;
  const changesText = `${pendingChanges.additions.length > 0 ? `+${pendingChanges.additions.length}` : ''}${pendingChanges.deletions.length > 0 ? ` -${pendingChanges.deletions.length}` : ''}`;

  // Empty cells before first day
  for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
    days.push(<div key={`empty-${i}`} />);
  }

  // Days of month
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const shift = mergedAvailability.find(s => s.work_date === dateStr);
    const active = dataManager?.isDateActive(dateStr) && !occupiedDates.has(dateStr);
    const isPending = shift && shift.id < 0;
    const isPendingDeletion = pendingChanges.deletions.some(d => d.shift.work_date === dateStr);

    days.push(
      <button
        key={dateStr}
        onClick={() => {
          if (shift) {
            openViewModal(shift);
          } else if (active) {
            openAddModal(dateStr);
          }
        }}
        disabled={!active && !shift}
        className="relative flex flex-col items-center justify-center rounded-lg border-2 transition-all hover:scale-105 active:scale-95"
        style={{
          aspectRatio: '1',
          backgroundColor: shift 
            ? (shift.is_full_day ? 'var(--success-light)' : 'var(--warning-light)')
            : active 
              ? 'var(--surface)' 
              : 'var(--bg-tertiary)',
          borderColor: isToday 
            ? 'var(--primary)' 
            : shift 
              ? (shift.is_full_day ? 'var(--success)' : 'var(--warning)')
              : 'var(--border)',
          opacity: (!active && !shift) || isPendingDeletion ? 0.4 : 1,
          cursor: (active || shift) ? 'pointer' : 'not-allowed',
          fontSize: 'clamp(0.625rem, 2.5vw, 0.875rem)',
          padding: 'clamp(0.25rem, 1vw, 0.5rem)',
          minWidth: 0,
          width: '100%',
          boxShadow: isPending ? '0 0 0 2px var(--warning)' : 'none',
        }}
      >
        <span 
          className="font-bold leading-none"
          style={{ color: isToday ? 'var(--primary)' : 'var(--text)' }}
        >
          {i}
        </span>
        {shift && (
          <div 
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{ 
              backgroundColor: isPending 
                ? 'var(--warning)' 
                : (shift.is_full_day ? 'var(--success)' : 'var(--warning)'),
              top: '4px',
              right: '4px',
            }}
          />
        )}
        {isPendingDeletion && (
          <div 
            className="absolute w-4 h-0.5 rounded-full"
            style={{ 
              backgroundColor: 'var(--error)',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
            }}
          />
        )}
      </button>
    );
  }

  return (
    <>
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <Button 
          onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
          variant="ghost" 
          size={isMobile ? 'sm' : 'md'}
          icon={<ChevronLeft className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />}
          aria-label="Предыдущий месяц"
        />
        <h3 
          className="font-semibold capitalize text-center" 
          style={{ 
            color: 'var(--text)',
            fontSize: isMobile ? 'clamp(1rem, 4vw, 1.125rem)' : 'clamp(1.125rem, 2vw, 1.25rem)',
            minWidth: isMobile ? '150px' : '200px',
          }}
        >
          {currentMonthLabel}
        </h3>
        <Button 
          onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
          variant="ghost" 
          size={isMobile ? 'sm' : 'md'}
          icon={<ChevronRight className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />}
          aria-label="Следующий месяц"
        />
      </div>

      {/* Optimization Tip */}
      <div 
        className="mb-3 p-3 rounded-lg border"
        style={{
          backgroundColor: 'var(--info-light)',
          borderColor: 'var(--info)',
          fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
          color: 'var(--text-muted)',
        }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--info)' }} />
          <p>
            Для оптимизации запросов к базе данных рекомендуется добавить необходимое количество смен, а затем нажать кнопку "Сохранить".
          </p>
        </div>
      </div>

      {/* Calendar Card */}
      <Card padding={isMobile ? 'sm' : 'md'} className="w-full">
        <div className="space-y-3 w-full">
          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map(day => (
              <div 
                key={day} 
                className="text-center font-semibold py-2"
                style={{ 
                  color: 'var(--text-muted)',
                  fontSize: 'clamp(0.625rem, 2.5vw, 0.75rem)',
                }}
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Days Grid */}
          <div 
            className="grid grid-cols-7 w-full"
            style={{
              gap: 'clamp(2px, 0.5vw, 4px)',
            }}
          >
            {days}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3" style={{ 
            color: 'var(--text-muted)',
            fontSize: 'clamp(0.625rem, 2.5vw, 0.75rem)',
          }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
              <span>Полная</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)' }} />
              <span>Неполная</span>
            </div>
            {hasChanges && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)', boxShadow: '0 0 0 2px var(--warning)' }} />
                <span>Не сохранено</span>
              </div>
            )}
          </div>

          {/* Save Button Section */}
          {hasChanges && (
            <div 
              className="mt-4 p-4 rounded-lg border-2"
              style={{
                background: 'linear-gradient(135deg, var(--warning-light), var(--warning-light))',
                borderColor: 'var(--warning)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="h-5 w-5 animate-pulse" style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                    Несохраненные изменения
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {changesText} операций
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={onCancel}
                  variant="secondary"
                  size={isMobile ? 'sm' : 'md'}
                  className="flex-1"
                >
                  Отменить
                </Button>
                <Button
                  onClick={onSave}
                  variant="primary"
                  size={isMobile ? 'sm' : 'md'}
                  loading={isSaving}
                  icon={<Save className="h-4 w-4" />}
                  className="flex-1"
                  style={{
                    backgroundColor: 'var(--warning)',
                    borderColor: 'var(--warning)',
                  }}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
