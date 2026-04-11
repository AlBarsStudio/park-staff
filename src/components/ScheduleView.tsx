/**
 * =====================================================================
 * ScheduleView - Компонент для просмотра графика смен
 * 
 * Возможности:
 * - Просмотр графика в трех режимах: день, неделя, месяц
 * - Современный адаптивный дизайн
 * - Цветовая индикация выходных дней
 * - Отображение частичных смен с временем
 * - Группировка по аттракционам
 * - Экспорт в Excel (опционально)
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
import { Employee, Attraction, ScheduleAssignment } from '../lib/DatabaseService';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { cn } from '../utils/cn';

// ============================================================
// Типы
// ============================================================
type ViewMode = 'day' | 'week' | 'month';

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
  // ============================================================
  // Состояния режима просмотра
  // ============================================================
  const [viewMode, setViewMode] = useState<ViewMode>('month');
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
      return format(currentDate, 'd MMMM yyyy, EEEE', { locale: ru });
    } else if (viewMode === 'week') {
      const weekEnd = addDays(currentWeekStart, 6);
      return `${format(currentWeekStart, 'd MMM', { locale: ru })} – ${format(
        weekEnd,
        'd MMM yyyy',
        { locale: ru }
      )}`;
    } else {
      return format(currentMonth, 'LLLL yyyy', { locale: ru });
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
  // Рендер
  // ============================================================
  return (
    <div className="space-y-6">
      {/* ========================================== */}
      {/* Шапка с навигацией */}
      {/* ========================================== */}
      <Card 
        className="p-6"
        style={{ 
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
          color: 'white',
          border: 'none'
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Навигация */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              icon={<ChevronLeft className="h-5 w-5" />}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
              title="Предыдущий период"
            />

            <div className="flex flex-col items-center min-w-[280px]">
              <h2 className="text-2xl font-bold capitalize">{getPeriodTitle()}</h2>
              <button
                onClick={handleToday}
                className="text-sm hover:underline mt-1 opacity-90"
              >
                Сегодня
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              icon={<ChevronRight className="h-5 w-5" />}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
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
                  'px-4 py-2 rounded-lg text-sm font-medium transition',
                  viewMode === mode
                    ? 'bg-white shadow-md'
                    : 'text-white hover:bg-white/10'
                )}
                style={viewMode === mode ? { color: 'var(--primary)' } : {}}
              >
                {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Calendar, label: 'Всего смен', value: statistics.totalShifts },
            { icon: Users, label: 'Сотрудников', value: statistics.uniqueEmployees },
            { icon: Calendar, label: 'Аттракционов', value: statistics.workingAttractions },
          ].map((stat, index) => (
            <div
              key={index}
              className="rounded-lg p-4 backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm opacity-90">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ========================================== */}
      {/* Панель инструментов */}
      {/* ========================================== */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                style={{ color: 'var(--text-subtle)' }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex items-center gap-2">
            <Button
              variant={hasActiveFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter className="h-4 w-4" />}
            >
              Фильтры
              {hasActiveFilters && (
                <Badge variant="error" className="ml-1">
                  {selectedAttractionIds.size + (employeeSearchQuery ? 1 : 0)}
                </Badge>
              )}
            </Button>

            <Button
              variant="success"
              onClick={handleExport}
              icon={<Download className="h-4 w-4" />}
            >
              Экспорт
            </Button>
          </div>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium" style={{ color: 'var(--text)' }}>
                Фильтр по аттракционам
              </h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Сбросить всё
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {attractions.map((attr) => (
                <label
                  key={attr.id}
                  className={cn(
                    'flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition',
                    selectedAttractionIds.has(attr.id)
                      ? 'bg-primary-light'
                      : 'hover:bg-tertiary'
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
                    <span className="text-sm font-medium truncate block" style={{ color: 'var(--text)' }}>
                      {attr.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
        <Card>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5" style={{ color: 'var(--text-subtle)' }} />
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Выберите дату:
            </label>
            <input
              type="date"
              value={format(currentDate, 'yyyy-MM-dd')}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="input"
            />
          </div>
        </Card>
      )}

      {/* ========================================== */}
      {/* Таблица графика */}
      {/* ========================================== */}
      <Card padding="none">
        <div ref={tableRef} className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: 'var(--border)' }}>
            {/* Заголовок */}
            <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <tr>
                <th 
                  className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider border-r sticky left-0 z-20 shadow-sm"
                  style={{ 
                    color: 'var(--text)',
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)'
                  }}
                >
                  Аттракцион
                </th>
                {displayDays.map((day) => {
                  const isWeekendDay = isWeekend(day);
                  return (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        'px-4 py-4 text-center text-xs font-bold uppercase tracking-wider border-r min-w-[140px]',
                      )}
                      style={{
                        backgroundColor: isWeekendDay ? 'var(--error-light)' : 'var(--bg-tertiary)',
                        color: isWeekendDay ? 'var(--error)' : 'var(--text)',
                        borderColor: 'var(--border)'
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold">{format(day, 'd')}</span>
                        <span className="text-[10px] font-semibold opacity-75">
                          {format(day, 'EEE', { locale: ru }).toUpperCase()}
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
                    className="px-6 py-12 text-center"
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)';
                      }}
                      style={{
                        backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)'
                      }}
                    >
                      {/* Название аттракциона */}
                      <td 
                        className="px-6 py-4 border-r sticky left-0 z-10 shadow-sm"
                        style={{ 
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1 h-12 rounded-full"
                            style={{ 
                              backgroundColor: hasAnySchedule ? 'var(--primary)' : 'var(--border)' 
                            }}
                          />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                              {attraction.name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              Коэффициент: ×{attraction.coefficient}
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
                            className="px-3 py-3 border-r align-top"
                            style={{
                              backgroundColor: isWeekendDay ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                              borderColor: 'var(--border)'
                            }}
                          >
                            {assignments.length > 0 ? (
                              <div className="space-y-2">
                                {assignments.map((assignment) => {
                                  const employee = employees.find(
                                    (e) => e.id === assignment.employee_id
                                  );
                                  const shortName = employee
                                    ? getShortName(employee.full_name)
                                    : '—';
                                  const hasPartialShift = isPartialShift(
                                    assignment.start_time,
                                    assignment.end_time
                                  );

                                  return (
                                    <div
                                      key={assignment.id}
                                      className="rounded-lg px-3 py-2 text-xs font-medium shadow-sm transition hover:shadow-md"
                                      style={{
                                        background: hasPartialShift
                                          ? 'linear-gradient(135deg, var(--warning-light) 0%, var(--warning-light) 100%)'
                                          : 'linear-gradient(135deg, var(--info-light) 0%, var(--info-light) 100%)',
                                        color: hasPartialShift ? 'var(--warning)' : 'var(--info)',
                                        border: `1px solid ${hasPartialShift ? 'var(--warning)' : 'var(--info)'}`,
                                      }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <Users className="h-3 w-3 opacity-70" />
                                        <span className="font-semibold">{shortName}</span>
                                      </div>
                                      {hasPartialShift && (
                                        <div className="flex items-center gap-1 mt-1.5 text-[10px] opacity-90">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {formatTime(assignment.start_time)} –{' '}
                                            {formatTime(assignment.end_time)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-12">
                                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>—</span>
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

      {/* ========================================== */}
      {/* Легенда */}
      {/* ========================================== */}
      <Card>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
          Легенда:
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border"
              style={{ 
                background: 'linear-gradient(135deg, var(--info-light) 0%, var(--info-light) 100%)',
                borderColor: 'var(--info)'
              }}
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              Полная смена (10:00 – 22:00)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border"
              style={{ 
                background: 'linear-gradient(135deg, var(--warning-light) 0%, var(--warning-light) 100%)',
                borderColor: 'var(--warning)'
              }}
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              Частичная смена
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border"
              style={{ 
                backgroundColor: 'var(--error-light)',
                borderColor: 'var(--error)'
              }}
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              Выходной день
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
