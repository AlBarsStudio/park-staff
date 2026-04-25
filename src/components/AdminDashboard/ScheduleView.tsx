/**
 * =====================================================================
 * ScheduleView - Компонент для просмотра графика смен
 * 
 * Возможности:
 * - Просмотр графика в трех режимах: день, неделя, месяц
 * - Адаптивный дизайн для мобильных устройств
 * - Цветовая индикация выходных дней
 * - Отображение частичных смен с временем
 * - Группировка по аттракционам
 * - Swipeable карточки на мобильных
 * =====================================================================
 */

import { useState, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  Filter,
  Search,
  Clock,
  Users,
  X,
  List,
  Grid3x3,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  startOfWeek,
  addDays,
  isWeekend,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { Employee, Attraction, ScheduleAssignment } from '../../lib/DatabaseService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';
import SwipeableList from './ui/SwipeableList';
import MobileModal from './ui/MobileModal';

// ============================================================
// Типы
// ============================================================
type ViewMode = 'day' | 'week' | 'month';
type LayoutMode = 'table' | 'cards'; // Новый режим отображения

interface ScheduleViewProps {
  employees: Employee[];
  attractions: Attraction[];
  scheduleAssignments: ScheduleAssignment[];
}

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * Получает короткое имя сотрудника (Имя Фамилия)
 */
function getShortName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return fullName;
}

/**
 * Получает инициалы сотрудника для мобильных (И.Ф.)
 */
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}.${parts[1][0]}.`;
  }
  return fullName[0] || '?';
}

/**
 * Проверяет, является ли смена частичной (не полный день)
 */
function isPartialShift(startTime: string | null, endTime: string | null): boolean {
  return startTime !== '10:00' || endTime !== '22:00';
}

/**
 * Форматирует время для отображения (убирает секунды)
 */
function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

// ============================================================
// Основной компонент
// ============================================================
export function ScheduleView({
  employees,
  attractions,
  scheduleAssignments,
}: ScheduleViewProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // ============================================================
  // Состояния режима просмотра
  // ============================================================
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'day' : 'month');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(isMobile ? 'cards' : 'table');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // ============================================================
  // Состояния фильтров
  // ============================================================
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<Set<number>>(new Set());
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ============================================================
  // Refs
  // ============================================================
  const tableRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Вычисление дней для отображения
  // ============================================================
  const displayDays = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      return eachDayOfInterval({
        start: currentWeekStart,
        end: addDays(currentWeekStart, 6),
      });
    } else {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      return eachDayOfInterval({ start, end });
    }
  }, [viewMode, currentDate, currentMonth, currentWeekStart]);

  // ============================================================
  // Фильтрация назначений
  // ============================================================
  const filteredAssignments = useMemo(() => {
    const startDate = format(displayDays[0], 'yyyy-MM-dd');
    const endDate = format(displayDays[displayDays.length - 1], 'yyyy-MM-dd');

    let filtered = scheduleAssignments.filter(
      (a) => a.work_date >= startDate && a.work_date <= endDate
    );

    if (selectedAttractionIds.size > 0) {
      filtered = filtered.filter((a) => selectedAttractionIds.has(a.attraction_id));
    }

    if (employeeSearchQuery.trim()) {
      const query = employeeSearchQuery.toLowerCase();
      const matchingEmployeeIds = employees
        .filter((emp) => emp.full_name.toLowerCase().includes(query))
        .map((emp) => emp.id);

      filtered = filtered.filter((a) => matchingEmployeeIds.includes(a.employee_id));
    }

    return filtered;
  }, [
    scheduleAssignments,
    displayDays,
    selectedAttractionIds,
    employeeSearchQuery,
    employees,
  ]);

  // ============================================================
  // Группировка данных
  // ============================================================
  const scheduleByAttractionAndDate = useMemo(() => {
    const grouped = new Map<number, Map<string, ScheduleAssignment[]>>();

    filteredAssignments.forEach((assignment) => {
      if (!grouped.has(assignment.attraction_id)) {
        grouped.set(assignment.attraction_id, new Map());
      }

      const dateMap = grouped.get(assignment.attraction_id)!;

      if (!dateMap.has(assignment.work_date)) {
        dateMap.set(assignment.work_date, []);
      }

      dateMap.get(assignment.work_date)!.push(assignment);
    });

    return grouped;
  }, [filteredAssignments]);

  // ============================================================
  // Группировка по дням для карточного режима
  // ============================================================
  const scheduleByDate = useMemo(() => {
    const grouped = new Map<string, Map<number, ScheduleAssignment[]>>();

    filteredAssignments.forEach((assignment) => {
      if (!grouped.has(assignment.work_date)) {
        grouped.set(assignment.work_date, new Map());
      }

      const attractionMap = grouped.get(assignment.work_date)!;

      if (!attractionMap.has(assignment.attraction_id)) {
        attractionMap.set(assignment.attraction_id, []);
      }

      attractionMap.get(assignment.attraction_id)!.push(assignment);
    });

    return grouped;
  }, [filteredAssignments]);

  // ============================================================
  // Статистика
  // ============================================================
  const statistics = useMemo(() => {
    const totalShifts = filteredAssignments.length;
    const uniqueEmployees = new Set(filteredAssignments.map((a) => a.employee_id)).size;
    const workingAttractions = new Set(filteredAssignments.map((a) => a.attraction_id)).size;

    return {
      totalShifts,
      uniqueEmployees,
      workingAttractions,
    };
  }, [filteredAssignments]);

  // ============================================================
  // Обработчики навигации
  // ============================================================
  const handlePrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate((prev) => addDays(prev, -1));
    } else if (viewMode === 'week') {
      setCurrentWeekStart((prev) => addDays(prev, -7));
    } else {
      setCurrentMonth((prev) => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      setCurrentDate((prev) => addDays(prev, 1));
    } else if (viewMode === 'week') {
      setCurrentWeekStart((prev) => addDays(prev, 7));
    } else {
      setCurrentMonth((prev) => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setCurrentMonth(today);
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  // ============================================================
  // Обработчики фильтров
  // ============================================================
  const toggleAttractionFilter = (attractionId: number) => {
    setSelectedAttractionIds((prev) => {
      const next = new Set(prev);
      if (next.has(attractionId)) {
        next.delete(attractionId);
      } else {
        next.add(attractionId);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedAttractionIds(new Set());
    setEmployeeSearchQuery('');
  };

  const hasActiveFilters = selectedAttractionIds.size > 0 || employeeSearchQuery.trim() !== '';

  // ============================================================
  // Формирование заголовка
  // ============================================================
  const getPeriodTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, isMobile ? 'd MMM yyyy' : 'd MMMM yyyy, EEEE', { locale: ru });
    } else if (viewMode === 'week') {
      const weekEnd = addDays(currentWeekStart, 6);
      return `${format(currentWeekStart, 'd MMM', { locale: ru })} – ${format(
        weekEnd,
        'd MMM yyyy',
        { locale: ru }
      )}`;
    } else {
      return format(currentMonth, isMobile ? 'LLLL yy' : 'LLLL yyyy', { locale: ru });
    }
  };

  const displayAttractions = useMemo(() => {
    if (selectedAttractionIds.size > 0) {
      return attractions.filter((attr) => selectedAttractionIds.has(attr.id));
    }
    return attractions;
  }, [attractions, selectedAttractionIds]);

  const handleExport = () => {
    alert('Функция экспорта будет добавлена в следующей версии');
  };

  // ============================================================
  // Рендер карточного режима (для мобильных)
  // ============================================================
  const renderCardsLayout = () => {
    return (
      <div className="space-y-4">
        {displayDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const daySchedule = scheduleByDate.get(dateStr);
          const isWeekendDay = isWeekend(day);

          return (
            <Card 
              key={dateStr} 
              padding="none"
              className={cn(
                'overflow-hidden',
                isWeekendDay && 'border-2'
              )}
              style={isWeekendDay ? { borderColor: 'var(--error)' } : {}}
            >
              {/* День заголовок */}
              <div 
                className="p-4 border-b"
                style={{ 
                  backgroundColor: isWeekendDay ? 'var(--error-light)' : 'var(--bg-tertiary)',
                  borderColor: 'var(--border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: isWeekendDay ? 'var(--error)' : 'var(--text)' }}
                    >
                      {format(day, 'd MMMM', { locale: ru })}
                    </h3>
                    <p 
                      className="text-sm"
                      style={{ color: isWeekendDay ? 'var(--error)' : 'var(--text-muted)' }}
                    >
                      {format(day, 'EEEE', { locale: ru })}
                    </p>
                  </div>
                  {daySchedule && (
                    <Badge variant={isWeekendDay ? 'error' : 'primary'}>
                      {Array.from(daySchedule.values()).reduce((acc, arr) => acc + arr.length, 0)} смен
                    </Badge>
                  )}
                </div>
              </div>

              {/* Список смен */}
              {daySchedule && daySchedule.size > 0 ? (
                <div className="p-4 space-y-3">
                  {Array.from(daySchedule.entries()).map(([attractionId, assignments]) => {
                    const attraction = attractions.find(a => a.id === attractionId);
                    if (!attraction) return null;

                    return (
                      <div 
                        key={attractionId}
                        className="p-3 rounded-lg border"
                        style={{ 
                          backgroundColor: 'var(--bg-tertiary)',
                          borderColor: 'var(--border)'
                        }}
                      >
                        {/* Название аттракциона */}
                        <div className="flex items-center justify-between mb-2">
                          <h4 
                            className="font-semibold text-sm"
                            style={{ color: 'var(--text)' }}
                          >
                            {attraction.name}
                          </h4>
                          <Badge variant="neutral" className="text-xs">
                            ×{attraction.coefficient}
                          </Badge>
                        </div>

                        {/* Сотрудники */}
                        <div className="space-y-2">
                          {assignments.map((assignment) => {
                            const employee = employees.find(e => e.id === assignment.employee_id);
                            const hasPartialShift = isPartialShift(
                              assignment.start_time,
                              assignment.end_time
                            );

                            return (
                              <div
                                key={assignment.id}
                                className="flex items-center justify-between p-2 rounded-lg"
                                style={{ backgroundColor: 'var(--surface)' }}
                              >
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ 
                                      backgroundColor: hasPartialShift ? 'var(--warning-light)' : 'var(--info-light)',
                                      color: hasPartialShift ? 'var(--warning)' : 'var(--info)'
                                    }}
                                  >
                                    {employee ? getInitials(employee.full_name) : '?'}
                                  </div>
                                  <div>
                                    <p 
                                      className="text-sm font-medium"
                                      style={{ color: 'var(--text)' }}
                                    >
                                      {employee ? getShortName(employee.full_name) : '—'}
                                    </p>
                                    {hasPartialShift && (
                                      <p 
                                        className="text-xs flex items-center gap-1"
                                        style={{ color: 'var(--warning)' }}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {formatTime(assignment.start_time)} – {formatTime(assignment.end_time)}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {hasPartialShift && (
                                  <Badge variant="warning" className="text-xs">
                                    Частичная
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div 
                  className="p-8 text-center"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Нет запланированных смен</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  // ============================================================
  // Рендер табличного режима (для десктопа)
  // ============================================================
  const renderTableLayout = () => {
    return (
      <Card padding="none">
        <div ref={tableRef} className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: 'var(--border)' }}>
            {/* Заголовок */}
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <tr>
                <th 
                  className={cn(
                    'text-left text-xs font-bold uppercase tracking-wider border-r sticky left-0 z-20 shadow-sm',
                    isMobile ? 'px-3 py-3' : 'px-6 py-4'
                  )}
                  style={{ 
                    color: 'var(--text)',
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)'
                  }}
                >
                  {isMobile ? 'Атр.' : 'Аттракцион'}
                </th>
                {displayDays.map((day) => {
                  const isWeekendDay = isWeekend(day);
                  return (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        'text-center text-xs font-bold uppercase tracking-wider border-r',
                        isMobile ? 'px-2 py-3 min-w-[100px]' : 'px-4 py-4 min-w-[140px]'
                      )}
                      style={{
                        backgroundColor: isWeekendDay ? 'var(--error-light)' : 'var(--bg-tertiary)',
                        color: isWeekendDay ? 'var(--error)' : 'var(--text)',
                        borderColor: 'var(--border)'
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className={isMobile ? 'text-base font-bold' : 'text-lg font-bold'}>
                          {format(day, 'd')}
                        </span>
                        <span className="text-[10px] font-semibold opacity-75">
                          {format(day, isMobile ? 'EE' : 'EEE', { locale: ru }).toUpperCase()}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Тело таблицы */}
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {displayAttractions.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayDays.length + 1}
                    className={cn(
                      'text-center',
                      isMobile ? 'px-3 py-8' : 'px-6 py-12'
                    )}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {hasActiveFilters
                      ? 'Нет данных, соответствующих фильтрам'
                      : 'Нет данных для отображения'}
                  </td>
                </tr>
              ) : (
                displayAttractions.map((attraction, index) => {
                  const attractionSchedule = scheduleByAttractionAndDate.get(attraction.id);
                  const hasAnySchedule = attractionSchedule && attractionSchedule.size > 0;

                  return (
                    <tr
                      key={attraction.id}
                      className="transition"
                      style={{
                        backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)'
                      }}
                    >
                      {/* Название аттракциона */}
                      <td 
                        className={cn(
                          'border-r sticky left-0 z-10 shadow-sm',
                          isMobile ? 'px-3 py-3' : 'px-6 py-4'
                        )}
                        style={{ 
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'rounded-full',
                              isMobile ? 'w-0.5 h-8' : 'w-1 h-12'
                            )}
                            style={{ 
                              backgroundColor: hasAnySchedule ? 'var(--primary)' : 'var(--border)' 
                            }}
                          />
                          <div>
                            <p 
                              className={cn(
                                'font-semibold',
                                isMobile ? 'text-xs' : 'text-sm'
                              )}
                              style={{ color: 'var(--text)' }}
                            >
                              {isMobile && attraction.name.length > 15 
                                ? attraction.name.slice(0, 15) + '...' 
                                : attraction.name
                              }
                            </p>
                            <p 
                              className={cn(
                                'mt-0.5',
                                isMobile ? 'text-[10px]' : 'text-xs'
                              )}
                              style={{ color: 'var(--text-muted)' }}
                            >
                              ×{attraction.coefficient}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Ячейки с назначениями */}
                      {displayDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const assignments = attractionSchedule?.get(dateStr) || [];
                        const isWeekendDay = isWeekend(day);

                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              'border-r align-top',
                              isMobile ? 'px-2 py-2' : 'px-3 py-3'
                            )}
                            style={{
                              backgroundColor: isWeekendDay ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                              borderColor: 'var(--border)'
                            }}
                          >
                            {assignments.length > 0 ? (
                              <div className={isMobile ? 'space-y-1' : 'space-y-2'}>
                                {assignments.map((assignment) => {
                                  const employee = employees.find(
                                    (e) => e.id === assignment.employee_id
                                  );
                                  const displayName = isMobile 
                                    ? (employee ? getInitials(employee.full_name) : '?')
                                    : (employee ? getShortName(employee.full_name) : '—');
                                  const hasPartialShift = isPartialShift(
                                    assignment.start_time,
                                    assignment.end_time
                                  );

                                  return (
                                    <div
                                      key={assignment.id}
                                      className={cn(
                                        'rounded-lg shadow-sm transition active:scale-95',
                                        isMobile ? 'px-2 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'
                                      )}
                                      style={{
                                        background: hasPartialShift
                                          ? 'linear-gradient(135deg, var(--warning-light) 0%, var(--warning-light) 100%)'
                                          : 'linear-gradient(135deg, var(--info-light) 0%, var(--info-light) 100%)',
                                        color: hasPartialShift ? 'var(--warning)' : 'var(--info)',
                                        border: `1px solid ${hasPartialShift ? 'var(--warning)' : 'var(--info)'}`,
                                      }}
                                    >
                                      <div className="flex items-center gap-1">
                                        <Users className={cn('opacity-70', isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                                        <span className="font-semibold">{displayName}</span>
                                      </div>
                                      {hasPartialShift && (
                                        <div 
                                          className={cn(
                                            'flex items-center gap-1 opacity-90',
                                            isMobile ? 'mt-0.5 text-[9px]' : 'mt-1.5 text-[10px]'
                                          )}
                                        >
                                          <Clock className={isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                                          <span>
                                            {formatTime(assignment.start_time)} – {formatTime(assignment.end_time)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className={cn('flex items-center justify-center', isMobile ? 'h-8' : 'h-12')}>
                                <span 
                                  className={isMobile ? 'text-[10px]' : 'text-xs'}
                                  style={{ color: 'var(--text-subtle)' }}
                                >
                                  —
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <div className="space-y-4 md:space-y-6">
      {/* ========================================== */}
      {/* Шапка с навигацией */}
      {/* ========================================== */}
      <Card 
        className={isMobile ? 'p-4' : 'p-6'}
        style={{ 
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
          color: 'white',
          border: 'none'
        }}
      >
        <div className="flex flex-col gap-4 mb-4 md:mb-6">
          {/* Навигация */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              icon={<ChevronLeft className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />}
              className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border-none min-w-[40px]"
              title="Предыдущий период"
            />

            <div className="flex flex-col items-center flex-1 min-w-0">
              <h2 className={cn(
                'font-bold capitalize truncate max-w-full text-center',
                isMobile ? 'text-lg' : 'text-2xl'
              )}>
                {getPeriodTitle()}
              </h2>
              <button
                onClick={handleToday}
                className={cn(
                  'hover:underline active:underline mt-1 opacity-90',
                  isMobile ? 'text-xs' : 'text-sm'
                )}
              >
                Сегодня
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              icon={<ChevronRight className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />}
              className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border-none min-w-[40px]"
              title="Следующий период"
            />
          </div>

          {/* Кнопки режимов */}
          <div className="flex items-center gap-2 p-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if (mode === 'day') setCurrentDate(new Date());
                  if (mode === 'week') setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                  if (mode === 'month') setCurrentMonth(new Date());
                }}
                className={cn(
                  'rounded-lg font-medium transition flex-1',
                  isMobile ? 'px-2 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                  viewMode === mode
                    ? 'bg-white shadow-md'
                    : 'text-white active:bg-white/10'
                )}
                style={viewMode === mode ? { color: 'var(--primary)' } : {}}
              >
                {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {[
            { icon: Calendar, label: isMobile ? 'Смен' : 'Всего смен', value: statistics.totalShifts },
            { icon: Users, label: isMobile ? 'Люди' : 'Сотрудников', value: statistics.uniqueEmployees },
            { icon: Calendar, label: isMobile ? 'Атр.' : 'Аттракционов', value: statistics.workingAttractions },
          ].map((stat, index) => (
            <div
              key={index}
              className={cn(
                'rounded-lg backdrop-blur-sm',
                isMobile ? 'p-3' : 'p-4'
              )}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <div 
                  className={cn(
                    'p-2 rounded-lg',
                    isMobile && 'p-1.5'
                  )}
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <stat.icon className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    'opacity-90',
                    isMobile ? 'text-[10px]' : 'text-sm'
                  )}>
                    {stat.label}
                  </p>
                  <p className={cn(
                    'font-bold',
                    isMobile ? 'text-lg' : 'text-2xl'
                  )}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ========================================== */}
      {/* Панель инструментов */}
      {/* ========================================== */}
      <Card padding={isMobile ? 'sm' : 'md'}>
        <div className="flex flex-col gap-3">
          {/* Первая строка: Поиск */}
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Поиск сотрудника..."
              value={employeeSearchQuery}
              onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" style={{ color: 'var(--text-subtle)' }} />}
            />
            {employeeSearchQuery && (
              <button
                onClick={() => setEmployeeSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition active:scale-90"
                style={{ color: 'var(--text-subtle)' }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Вторая строка: Кнопки */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={hasActiveFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter className="h-4 w-4" />}
              size={isMobile ? 'sm' : 'md'}
              className="flex-1 sm:flex-none"
            >
              {isMobile ? 'Фильтры' : 'Фильтры'}
              {hasActiveFilters && (
                <Badge variant="error" className="ml-1">
                  {selectedAttractionIds.size + (employeeSearchQuery ? 1 : 0)}
                </Badge>
              )}
            </Button>

            {!isMobile && (
              <>
                <Button
                  variant={layoutMode === 'cards' ? 'primary' : 'secondary'}
                  onClick={() => setLayoutMode('cards')}
                  icon={<List className="h-4 w-4" />}
                  size="md"
                  title="Режим карточек"
                />

                <Button
                  variant={layoutMode === 'table' ? 'primary' : 'secondary'}
                  onClick={() => setLayoutMode('table')}
                  icon={<Grid3x3 className="h-4 w-4" />}
                  size="md"
                  title="Режим таблицы"
                />
              </>
            )}

            <Button
              variant="success"
              onClick={handleExport}
              icon={<Download className="h-4 w-4" />}
              size={isMobile ? 'sm' : 'md'}
              className="flex-1 sm:flex-none"
            >
              {isMobile ? 'Экспорт' : 'Экспорт'}
            </Button>
          </div>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 
                className={cn(
                  'font-medium',
                  isMobile ? 'text-sm' : 'text-base'
                )}
                style={{ color: 'var(--text)' }}
              >
                Фильтр по аттракционам
              </h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Сбросить
                </Button>
              )}
            </div>

            <div className={cn(
              'grid gap-2',
              isMobile ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            )}>
              {attractions.map((attr) => (
                <label
                  key={attr.id}
                  className={cn(
                    'flex items-center gap-2 border-2 rounded-lg cursor-pointer transition active:scale-98',
                    isMobile ? 'p-2.5' : 'p-3',
                    selectedAttractionIds.has(attr.id) && 'bg-primary-light'
                  )}
                  style={{
                    borderColor: selectedAttractionIds.has(attr.id) ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAttractionIds.has(attr.id)}
                    onChange={() => toggleAttractionFilter(attr.id)}
                    className="rounded"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <span 
                      className={cn(
                        'font-medium truncate block',
                        isMobile ? 'text-sm' : 'text-sm'
                      )}
                      style={{ color: 'var(--text)' }}
                    >
                      {attr.name}
                    </span>
                    <span 
                      className={isMobile ? 'text-xs' : 'text-xs'}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ×{attr.coefficient}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ========================================== */}
      {/* Выбор даты для режима "День" */}
      {/* ========================================== */}
      {viewMode === 'day' && (
        <Card padding={isMobile ? 'sm' : 'md'}>
          <div className="flex items-center gap-3">
            <Calendar 
              className={isMobile ? 'h-4 w-4' : 'h-5 w-5'}
              style={{ color: 'var(--text-subtle)' }}
            />
            <label 
              className={cn(
                'font-medium',
                isMobile ? 'text-sm' : 'text-sm'
              )}
              style={{ color: 'var(--text)' }}
            >
              Выберите дату:
            </label>
            <input
              type="date"
              value={format(currentDate, 'yyyy-MM-dd')}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="input flex-1"
            />
          </div>
        </Card>
      )}

      {/* ========================================== */}
      {/* График - Карточки или Таблица */}
      {/* ========================================== */}
      {isMobile || layoutMode === 'cards' ? renderCardsLayout() : renderTableLayout()}

      {/* ========================================== */}
      {/* Легенда */}
      {/* ========================================== */}
      <Card padding={isMobile ? 'sm' : 'md'}>
        <h4 
          className={cn(
            'font-semibold mb-3',
            isMobile ? 'text-sm' : 'text-sm'
          )}
          style={{ color: 'var(--text)' }}
        >
          Легенда:
        </h4>
        <div className={cn(
          'grid gap-2',
          isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        )}>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border flex-shrink-0"
              style={{ 
                background: 'linear-gradient(135deg, var(--info-light) 0%, var(--info-light) 100%)',
                borderColor: 'var(--info)'
              }}
            />
            <span 
              className={isMobile ? 'text-xs' : 'text-sm'}
              style={{ color: 'var(--text)' }}
            >
              Полная смена (10:00 – 22:00)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border flex-shrink-0"
              style={{ 
                background: 'linear-gradient(135deg, var(--warning-light) 0%, var(--warning-light) 100%)',
                borderColor: 'var(--warning)'
              }}
            />
            <span 
              className={isMobile ? 'text-xs' : 'text-sm'}
              style={{ color: 'var(--text)' }}
            >
              Частичная смена
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border flex-shrink-0"
              style={{ 
                backgroundColor: 'var(--error-light)',
                borderColor: 'var(--error)'
              }}
            />
            <span 
              className={isMobile ? 'text-xs' : 'text-sm'}
              style={{ color: 'var(--text)' }}
            >
              Выходной день
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
