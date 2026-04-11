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
      // month
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      return eachDayOfInterval({ start, end });
    }
  }, [viewMode, currentDate, currentMonth, currentWeekStart]);

  // ============================================================
  // Фильтрация назначений по датам
  // ============================================================
  const filteredAssignments = useMemo(() => {
    const startDate = format(displayDays[0], 'yyyy-MM-dd');
    const endDate = format(displayDays[displayDays.length - 1], 'yyyy-MM-dd');

    let filtered = scheduleAssignments.filter(
      (a) => a.work_date >= startDate && a.work_date <= endDate
    );

    // Фильтр по выбранным аттракционам
    if (selectedAttractionIds.size > 0) {
      filtered = filtered.filter((a) => selectedAttractionIds.has(a.attraction_id));
    }

    // Фильтр по поиску сотрудника
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
  // Группировка данных по аттракционам и датам
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
  // Формирование заголовка периода
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

  // ============================================================
  // Получение аттракционов для отображения
  // ============================================================
  const displayAttractions = useMemo(() => {
    // Если есть фильтр, показываем только выбранные
    if (selectedAttractionIds.size > 0) {
      return attractions.filter((attr) => selectedAttractionIds.has(attr.id));
    }
    // Иначе показываем все аттракционы
    return attractions;
  }, [attractions, selectedAttractionIds]);

  // ============================================================
  // Экспорт данных (заглушка для будущей реализации)
  // ============================================================
  const handleExport = () => {
    // TODO: Реализовать экспорт в Excel
    alert('Функция экспорта будет добавлена в следующей версии');
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <div className="space-y-6">
      {/* ========================================== */}
      {/* Шапка с навигацией и статистикой */}
      {/* ========================================== */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Навигация */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              title="Предыдущий период"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center min-w-[280px]">
              <h2 className="text-2xl font-bold capitalize">{getPeriodTitle()}</h2>
              <button
                onClick={handleToday}
                className="text-sm text-blue-100 hover:text-white transition mt-1"
              >
                Сегодня
              </button>
            </div>

            <button
              onClick={handleNext}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              title="Следующий период"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Кнопки режимов */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setViewMode('day');
                setCurrentDate(new Date());
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'day'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              День
            </button>
            <button
              onClick={() => {
                setViewMode('week');
                setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'week'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => {
                setViewMode('month');
                setCurrentMonth(new Date());
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'month'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              Месяц
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Всего смен</p>
                <p className="text-2xl font-bold">{statistics.totalShifts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Сотрудников</p>
                <p className="text-2xl font-bold">{statistics.uniqueEmployees}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Аттракционов</p>
                <p className="text-2xl font-bold">{statistics.workingAttractions}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* Панель инструментов */}
      {/* ========================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Поиск по сотрудникам */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск сотрудника..."
              value={employeeSearchQuery}
              onChange={(e) => setEmployeeSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {employeeSearchQuery && (
              <button
                onClick={() => setEmployeeSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                hasActiveFilters
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              <Filter className="h-4 w-4" />
              Фильтры
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">
                  {selectedAttractionIds.size + (employeeSearchQuery ? 1 : 0)}
                </span>
              )}
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              <Download className="h-4 w-4" />
              Экспорт
            </button>
          </div>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Фильтр по аттракционам</h4>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Сбросить всё
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {attractions.map((attr) => (
                <label
                  key={attr.id}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                    selectedAttractionIds.has(attr.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAttractionIds.has(attr.id)}
                    onChange={() => toggleAttractionFilter(attr.id)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate block">
                      {attr.name}
                    </span>
                    <span className="text-xs text-gray-500">×{attr.coefficient}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* Выбор даты для режима "День" */}
      {/* ========================================== */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <label className="text-sm font-medium text-gray-700">Выберите дату:</label>
            <input
              type="date"
              value={format(currentDate, 'yyyy-MM-dd')}
              onChange={(e) => setCurrentDate(new Date(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Таблица графика */}
      {/* ========================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div ref={tableRef} className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Заголовок таблицы */}
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 bg-white sticky left-0 z-20 shadow-sm">
                  Аттракцион
                </th>
                {displayDays.map((day) => {
                  const isWeekendDay = isWeekend(day);
                  return (
                    <th
                      key={day.toISOString()}
                      className={`px-4 py-4 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-200 min-w-[140px] ${
                        isWeekendDay
                          ? 'bg-red-50 text-red-700'
                          : 'text-gray-700'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold">
                          {format(day, 'd')}
                        </span>
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
            <tbody className="divide-y divide-gray-100">
              {displayAttractions.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayDays.length + 1}
                    className="px-6 py-12 text-center text-gray-500"
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
                      className={`hover:bg-gray-50 transition ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      {/* Название аттракциона */}
                      <td className="px-6 py-4 border-r border-gray-200 bg-white sticky left-0 z-10 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-1 h-12 rounded-full ${
                              hasAnySchedule ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {attraction.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Коэффициент: ×{attraction.coefficient}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Ячейки с назначениями по дням */}
                      {displayDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const assignments = attractionSchedule?.get(dateStr) || [];
                        const isWeekendDay = isWeekend(day);

                        return (
                          <td
                            key={day.toISOString()}
                            className={`px-3 py-3 border-r border-gray-200 align-top ${
                              isWeekendDay ? 'bg-red-50/30' : ''
                            }`}
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
                                      className={`rounded-lg px-3 py-2 text-xs font-medium shadow-sm transition hover:shadow-md ${
                                        hasPartialShift
                                          ? 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-800 border border-orange-200'
                                          : 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200'
                                      }`}
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
                                <span className="text-gray-300 text-xs">—</span>
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
      </div>

      {/* ========================================== */}
      {/* Легенда */}
      {/* ========================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Легенда:</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-100 to-blue-50 border border-blue-200 rounded"></div>
            <span className="text-sm text-gray-700">Полная смена (10:00 – 22:00)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-orange-100 to-orange-50 border border-orange-200 rounded"></div>
            <span className="text-sm text-gray-700">Частичная смена</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span className="text-sm text-gray-700">Выходной день</span>
          </div>
        </div>
      </div>
    </div>
  );
}
