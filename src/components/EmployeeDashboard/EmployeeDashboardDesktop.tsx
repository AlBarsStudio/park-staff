import { useMemo } from 'react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Calendar, ChevronLeft, ChevronRight, Trash2, Clock, 
  DollarSign, Users, Target, Award, TrendingUp, Zap, 
  BarChart3, FileText, Loader2 
} from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import type { Employee, EmployeeAvailability, ScheduleAssignment, EmployeeDataManager } from '../../lib/employeeDatabase';
import type { PendingChanges } from './index';

interface DesktopProps {
  profile: Employee;
  dataManager: EmployeeDataManager;
  now: Date;
  greeting: string;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  shiftsForMonth: EmployeeAvailability[];
  scheduleForMonth: ScheduleAssignment[];
  occupiedDates: Set<string>;
  mergedAvailability: EmployeeAvailability[];
  pendingChanges: PendingChanges;
  attractions: any[];
  priorities: any[];
  studyGoal: any;
  availableAttractionsForGoal: any[];
  selectedAttractionId: number | null;
  setSelectedAttractionId: (id: number | null) => void;
  handleSetStudyGoal: () => void;
  savingGoal: boolean;
  goalError: string;
  salaryPeriod: 'first' | 'second';
  setSalaryPeriod: (period: 'first' | 'second') => void;
  salaryData: any;
  loadingSalary: boolean;
  openAddModal: (dateStr: string) => void;
  openViewModal: (shift: EmployeeAvailability) => void;
  openTimeLogModal: (schedule: ScheduleAssignment) => void;
}

export function EmployeeDashboardDesktop({
  profile,
  dataManager,
  now,
  greeting,
  currentDate,
  setCurrentDate,
  shiftsForMonth,
  scheduleForMonth,
  occupiedDates,
  mergedAvailability,
  pendingChanges,
  attractions,
  priorities,
  studyGoal,
  availableAttractionsForGoal,
  selectedAttractionId,
  setSelectedAttractionId,
  handleSetStudyGoal,
  savingGoal,
  goalError,
  salaryPeriod,
  setSalaryPeriod,
  salaryData,
  loadingSalary,
  openAddModal,
  openViewModal,
  openTimeLogModal,
}: DesktopProps) {
  
  const currentMonthLabel = format(currentDate, 'LLLL yyyy', { locale: ru });

  // ======================== RENDER CALENDAR ========================
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const days = [];

    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(<div key={`empty-${i}`} />);
    }

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
      <div className="space-y-3 w-full">
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
        
        <div 
          className="grid grid-cols-7 w-full"
          style={{
            gap: 'clamp(2px, 0.5vw, 4px)',
          }}
        >
          {days}
        </div>
        
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
          {(pendingChanges.additions.length > 0 || pendingChanges.deletions.length > 0) && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)', boxShadow: '0 0 0 2px var(--warning)' }} />
              <span>Не сохранено</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ======================== RENDER SHIFTS TABLE ========================
  const renderShiftsTable = () => {
    if (shiftsForMonth.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="mx-auto mb-3 opacity-30 h-12 w-12" style={{ color: 'var(--text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Смен в этом месяце пока нет
          </p>
        </div>
      );
    }

    return (
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
    );
  };

  // ======================== RENDER SCHEDULE TABLE ========================
  const renderScheduleTable = () => {
    if (scheduleForMonth.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="mx-auto mb-3 opacity-30 h-12 w-12" style={{ color: 'var(--text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            График не найден
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Аттракцион</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Статус</th>
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
                    backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                  }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(schedule.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {attraction?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {schedule.start_time?.slice(0, 5) || '00:00'} – {schedule.end_time?.slice(0, 5) || '00:00'}
                  </td>
                  <td className="px-4 py-3">
                    {log ? (
                      <Badge variant="success" dot>Отмечено</Badge>
                    ) : canLog?.allowed ? (
                      <Button onClick={() => openTimeLogModal(schedule)} variant="secondary" size="sm">
                        Отметить
                      </Button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Недоступно</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ======================== RENDER SALARY ========================
  const renderSalary = () => {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={() => setSalaryPeriod('first')} 
            variant={salaryPeriod === 'first' ? 'primary' : 'secondary'} 
            size="sm"
          >
            7–21
          </Button>
          <Button 
            onClick={() => setSalaryPeriod('second')} 
            variant={salaryPeriod === 'second' ? 'primary' : 'secondary'} 
            size="sm"
          >
            22–6
          </Button>
        </div>

        {loadingSalary && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}

        {!loadingSalary && salaryData && (
          <div>
            {salaryData.days.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                Нет данных
              </div>
            ) : (
              <div className="space-y-2">
                {salaryData.days.map((day: any, index: number) => (
                  <Card 
                    key={day.date} 
                    padding="sm"
                    style={{
                      backgroundColor: index % 2 === 0 
                        ? 'rgba(var(--success-rgb, 16, 185, 129), 0.05)' 
                        : 'rgba(var(--success-rgb, 16, 185, 129), 0.02)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="font-semibold mb-2 text-sm" style={{ color: 'var(--text)' }}>
                      {format(parseISO(day.date), 'dd.MM.yyyy (EEEE)', { locale: ru })}
                    </div>
                    <div className="space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {day.attractions.map((a: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>{a.name}</span>
                          <span className="font-medium">{Math.round(a.earn)}₽</span>
                        </div>
                      ))}
                    </div>
                    <div 
                      className="mt-2 pt-2 border-t flex justify-between font-bold text-sm"
                      style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                    >
                      <span>Итого:</span>
                      <span>{Math.round(day.total)} ₽</span>
                    </div>
                  </Card>
                ))}
                <Card 
                  padding="md"
                  style={{
                    background: 'linear-gradient(135deg, var(--success-light), var(--success))',
                    border: 'none',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg" style={{ color: 'white' }}>
                      Всего:
                    </span>
                    <span className="font-bold text-3xl" style={{ color: 'white' }}>
                      {Math.round(salaryData.total)} ₽
                    </span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ======================== MAIN RENDER ========================
  return (
    <div className="hidden md:block space-y-6 p-6">
      {/* Header cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card padding="lg" className="lg:col-span-2 card-hover">
          <div className="flex items-start justify-between">
            <div>
              <h2 
                className="font-bold mb-2" 
                style={{ 
                  color: 'var(--text)',
                  fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
                }}
              >
                {greeting || `Здравствуйте, ${profile.full_name?.split(' ')[0]}!`}
              </h2>
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>Возраст: {profile.age ?? 'Не указан'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  <span>Ставка: {profile.base_hourly_rate || 250}₽/ч</span>
                </div>
              </div>
            </div>
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                color: 'white',
              }}
            >
              {profile.full_name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </Card>

        <Card padding="md" className="card-hover">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
              </div>
              <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{shiftsForMonth.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" style={{ color: 'var(--success)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>По графику</span>
              </div>
              <span className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{scheduleForMonth.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-center gap-4">
            <Button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
              variant="ghost" 
              icon={<ChevronLeft className="h-5 w-5" />}
              aria-label="Предыдущий месяц"
            />
            <h3 
              className="font-semibold capitalize min-w-[200px] text-center" 
              style={{ 
                color: 'var(--text)',
                fontSize: 'clamp(1.125rem, 2vw, 1.25rem)',
              }}
            >
              {currentMonthLabel}
            </h3>
            <Button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
              variant="ghost" 
              icon={<ChevronRight className="h-5 w-5" />}
              aria-label="Следующий месяц"
            />
          </div>

          <Card padding="md" className="w-full">
            {renderCalendar()}
          </Card>

          <Card padding="md" className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Мои смены</h3>
            </div>
            {renderShiftsTable()}
          </Card>

          <Card padding="md" className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5" style={{ color: 'var(--info)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>График от администратора</h3>
            </div>
            {renderScheduleTable()}
          </Card>

          <Card padding="md" className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5" style={{ color: 'var(--success)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Зарплата</h3>
            </div>
            {renderSalary()}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Приоритеты</h3>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(level => {
                const priority = priorities.find(p => p.priority_level === level);
                const attractionIds = Array.isArray(priority?.attraction_ids) 
                  ? priority.attraction_ids 
                  : (priority?.attraction_ids ? [priority.attraction_ids] : []);
                
                const attractionNames = attractionIds
                  .map(id => {
                    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
                    return attractions.find(a => a.id === numId)?.name || 'Неизвестный';
                  })
                  .join(', ') || 'Не задан';

                const colors = {
                  1: { bg: 'var(--success-light)', text: 'var(--success)', icon: Zap },
                  2: { bg: 'var(--warning-light)', text: 'var(--warning)', icon: TrendingUp },
                  3: { bg: 'var(--info-light)', text: 'var(--info)', icon: Award },
                };

                const { bg, text, icon: Icon } = colors[level as 1 | 2 | 3];

                return (
                  <div 
                    key={level} 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: bg }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4" style={{ color: text }} />
                      <span className="text-xs font-semibold" style={{ color: text }}>
                        {level === 1 ? 'Высокий' : level === 2 ? 'Средний' : 'Низкий'}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {attractionNames}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Цель изучения</h3>
            </div>
            {goalError && (
              <div className="mb-3 p-3 rounded-lg text-sm animate-shake" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
                {goalError}
              </div>
            )}
            <select 
              value={selectedAttractionId || ''} 
              onChange={e => setSelectedAttractionId(Number(e.target.value))} 
              className="input mb-3"
              style={{
                borderRadius: '12px',
                padding: '0.75rem 1rem',
              }}
            >
              <option value="">-- Выберите аттракцион --</option>
              {availableAttractionsForGoal.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Button
              onClick={handleSetStudyGoal}
              disabled={savingGoal || !selectedAttractionId}
              variant="primary"
              size="sm"
              loading={savingGoal}
              className="w-full"
            >
              Сохранить цель
            </Button>
            {studyGoal && studyGoal.attraction && (
              <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
                  <strong>Текущая:</strong> {studyGoal.attraction.name}
                </p>
              </div>
            )}
          </Card>

          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Опрос</h3>
            </div>
            <div className="relative h-[400px] overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                title="Google Form"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
