/**
 * =====================================================================
 * ShiftsManagement - Компонент для управления сменами сотрудников
 * 
 * Возможности:
 * - Просмотр смен в трех режимах: день, неделя, месяц
 * - Добавление и редактирование смен
 * - Удаление смен с проверкой прав
 * - Поиск по сотрудникам
 * - Фильтрация по типу смены
 * - Комментарии к сменам
 * - Современный адаптивный дизайн
 * =====================================================================
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Edit2,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  X,
  AlertCircle,
  MessageSquare,
  Filter,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  format,
  parseISO,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfDay,
  addMonths,
  subMonths,
  startOfWeek,
  addDays,
  isWeekend,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { dbService, Employee, EmployeeAvailability } from '../lib/DatabaseService';

// ============================================================
// Типы
// ============================================================
type ViewMode = 'day' | 'week' | 'month';
type FilterType = 'all' | 'full' | 'partial';

interface ShiftsManagementProps {
  employees: Employee[];
  shifts: EmployeeAvailability[];
  onRefreshData: () => Promise<void>;
}

// ============================================================
// Вспомогательные функции
// ============================================================

/**
 * Проверяет возможность редактирования смены (не более 2 дней назад)
 */
function canEditShift(workDate: string): boolean {
  const today = startOfDay(new Date());
  const target = startOfDay(parseISO(workDate));
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
}

/**
 * Форматирует время для отображения
 */
function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

// ============================================================
// Основной компонент
// ============================================================
export function ShiftsManagement({
  employees,
  shifts,
  onRefreshData,
}: ShiftsManagementProps) {
  // ============================================================
  // Состояния навигации
  // ============================================================
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    startOfMonth(new Date())
  );

  // ============================================================
  // Состояния фильтрации и поиска
  // ============================================================
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ============================================================
  // Состояния модального окна
  // ============================================================
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [workDate, setWorkDate] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shiftComment, setShiftComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // ============================================================
  // Состояния поиска сотрудника
  // ============================================================
  const [addEmployeeSearch, setAddEmployeeSearch] = useState('');
  const [addEmployeeResults, setAddEmployeeResults] = useState<Employee[]>([]);

  // ============================================================
  // Модальное окно комментария
  // ============================================================
  const [viewingComment, setViewingComment] = useState<string | null>(null);

  // ============================================================
  // Поиск сотрудников с дебаунсом
  // ============================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!addEmployeeSearch.trim()) {
        setAddEmployeeResults([]);
        return;
      }
      const filtered = employees.filter((emp) =>
        emp.full_name.toLowerCase().includes(addEmployeeSearch.toLowerCase())
      );
      setAddEmployeeResults(filtered.slice(0, 10));
    }, 300);
    return () => clearTimeout(timer);
  }, [addEmployeeSearch, employees]);

  // ============================================================
  // Фильтрация смен
  // ============================================================
  const shiftsForMonth = useMemo(() => {
    return shifts.filter((s) => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [shifts, currentYear, currentMonth]);

  const filteredShifts = useMemo(() => {
    let base = shiftsForMonth;

    // Фильтр по режиму просмотра
    if (viewMode === 'day') {
      base = base.filter((s) => isSameDay(parseISO(s.work_date), selectedDate));
    } else if (viewMode === 'week') {
      const weekEnd = addDays(selectedWeekStart, 6);
      base = base.filter((s) => {
        const d = parseISO(s.work_date);
        return d >= selectedWeekStart && d <= weekEnd;
      });
    }

    // Фильтр по типу смены
    if (filterType === 'full') {
      base = base.filter((s) => s.is_full_day);
    } else if (filterType === 'partial') {
      base = base.filter((s) => !s.is_full_day);
    }

    // Поиск по сотруднику
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (s) =>
        s.employees?.full_name?.toLowerCase().includes(q) || s.work_date.includes(q)
    );
  }, [shiftsForMonth, viewMode, selectedDate, selectedWeekStart, search, filterType]);

  // ============================================================
  // Статистика
  // ============================================================
  const statistics = useMemo(() => {
    const total = filteredShifts.length;
    const fullDay = filteredShifts.filter((s) => s.is_full_day).length;
    const partial = filteredShifts.filter((s) => !s.is_full_day).length;
    const uniqueEmployees = new Set(filteredShifts.map((s) => s.employee_id)).size;

    return { total, fullDay, partial, uniqueEmployees };
  }, [filteredShifts]);

  // ============================================================
  // Обработчики навигации
  // ============================================================
  const handlePrevMonth = () => {
    const newDate = subMonths(new Date(currentYear, currentMonth, 1), 1);
    setCurrentYear(newDate.getFullYear());
    setCurrentMonth(newDate.getMonth());
  };

  const handleNextMonth = () => {
    const newDate = addMonths(new Date(currentYear, currentMonth, 1), 1);
    setCurrentYear(newDate.getFullYear());
    setCurrentMonth(newDate.getMonth());
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(today);
  };

  const monthLabel = format(new Date(currentYear, currentMonth, 1), 'LLLL yyyy', {
    locale: ru,
  });

  // ============================================================
  // Сброс формы
  // ============================================================
  const resetShiftForm = useCallback(() => {
    setEditingShiftId(null);
    setSelectedEmployeeId('');
    setWorkDate('');
    setIsFullDay(true);
    setStartTime('');
    setEndTime('');
    setShiftComment('');
    setAddEmployeeSearch('');
    setAddEmployeeResults([]);
    setFormError(null);
    setShowAddShiftModal(false);
  }, []);

  // ============================================================
  // Сохранение смены
  // ============================================================
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Валидация
    if (!selectedEmployeeId) {
      setFormError('Выберите сотрудника');
      return;
    }
    if (!workDate) {
      setFormError('Укажите дату');
      return;
    }
    if (!isFullDay && (!startTime || !endTime)) {
      setFormError('Укажите время начала и окончания смены');
      return;
    }

    // Проверка на дубликат
    const existingShift = shifts.find(
      (s) =>
        s.employee_id === Number(selectedEmployeeId) &&
        s.work_date === workDate &&
        s.id !== editingShiftId
    );
    if (existingShift) {
      setFormError('У сотрудника уже есть смена на эту дату');
      return;
    }

    try {
      if (editingShiftId) {
        // Редактирование
        const success = await dbService.updateAvailability(editingShiftId, {
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          comment: shiftComment || null,
        });

        if (!success) {
          setFormError('Ошибка сохранения изменений');
          return;
        }
      } else {
        // Создание
        const result = await dbService.createAvailability({
          employee_id: Number(selectedEmployeeId),
          work_date: workDate,
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          comment: shiftComment || null,
        });

        if (!result) {
          setFormError('Ошибка добавления смены');
          return;
        }
      }

      await onRefreshData();
      resetShiftForm();
    } catch (err: any) {
      setFormError(err.message || 'Произошла ошибка');
    }
  };

  // ============================================================
  // Редактирование смены
  // ============================================================
  const handleEditShift = (shift: EmployeeAvailability) => {
    if (!canEditShift(shift.work_date)) {
      alert('Редактирование запрещено: прошло более 2 дней с даты смены');
      return;
    }

    setEditingShiftId(shift.id);
    setSelectedEmployeeId(shift.employee_id);
    setWorkDate(shift.work_date);
    setIsFullDay(shift.is_full_day);
    setStartTime(shift.start_time || '');
    setEndTime(shift.end_time || '');
    setShiftComment(shift.comment || '');

    const emp = employees.find((e) => e.id === shift.employee_id);
    setAddEmployeeSearch(emp?.full_name || '');
    setShowAddShiftModal(true);
  };

  // ============================================================
  // Удаление смены
  // ============================================================
  const handleDeleteShift = async (shift: EmployeeAvailability) => {
    if (!canEditShift(shift.work_date)) {
      alert('Удаление запрещено: прошло более 2 дней с даты смены');
      return;
    }

    if (!confirm(`Удалить смену для ${shift.employees?.full_name}?`)) return;

    const success = await dbService.deleteAvailability(shift.id);
    if (success) {
      await onRefreshData();
    } else {
      alert('Ошибка удаления смены');
    }
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <div className="space-y-6">
      {/* ========================================== */}
      {/* Шапка с навигацией и статистикой */}
      {/* ========================================== */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Навигация по месяцам */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center min-w-[200px]">
              <h2 className="text-2xl font-bold capitalize">{monthLabel}</h2>
              <button
                onClick={handleToday}
                className="text-sm text-indigo-100 hover:text-white transition mt-1"
              >
                Текущий месяц
              </button>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              title="Следующий месяц"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Кнопки режимов просмотра */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setViewMode('day');
                setSelectedDate(new Date(currentYear, currentMonth, 1));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'day'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              День
            </button>
            <button
              onClick={() => {
                setViewMode('week');
                setSelectedWeekStart(
                  startOfWeek(new Date(currentYear, currentMonth, 1), { weekStartsOn: 1 })
                );
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'week'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                viewMode === 'month'
                  ? 'bg-white text-indigo-600 shadow-md'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              Месяц
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-indigo-100">Всего смен</p>
                <p className="text-2xl font-bold">{statistics.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-indigo-100">Полный день</p>
                <p className="text-2xl font-bold">{statistics.fullDay}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-indigo-100">Частичный</p>
                <p className="text-2xl font-bold">{statistics.partial}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-indigo-100">Сотрудников</p>
                <p className="text-2xl font-bold">{statistics.uniqueEmployees}</p>
              </div>
            </div>
          </div>
        </div>
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
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Выбор недели для режима "Неделя" */}
      {/* ========================================== */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedWeekStart((prev) => addDays(prev, -7))}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronLeft className="h-4 w-4 text-gray-700" />
            </button>
            <span className="text-sm font-medium text-gray-900">
              {format(selectedWeekStart, 'd MMM', { locale: ru })} –{' '}
              {format(addDays(selectedWeekStart, 6), 'd MMM yyyy', { locale: ru })}
            </span>
            <button
              onClick={() => setSelectedWeekStart((prev) => addDays(prev, 7))}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronRight className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Панель инструментов */}
      {/* ========================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск сотрудника или даты..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
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
                filterType !== 'all'
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              <Filter className="h-4 w-4" />
              Фильтры
              {filterType !== 'all' && (
                <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white rounded-full text-xs">
                  1
                </span>
              )}
            </button>

            <button
              onClick={() => {
                resetShiftForm();
                setWorkDate(format(new Date(), 'yyyy-MM-dd'));
                setShowAddShiftModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Добавить смену
            </button>
          </div>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Тип смены</h4>
              {filterType !== 'all' && (
                <button
                  onClick={() => setFilterType('all')}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Сбросить
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                  filterType === 'all'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Все смены</span>
                </div>
              </button>

              <button
                onClick={() => setFilterType('full')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                  filterType === 'full'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Полный день</span>
                </div>
              </button>

              <button
                onClick={() => setFilterType('partial')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                  filterType === 'partial'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Частичный день</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* Таблица смен */}
      {/* ========================================== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Заголовок */}
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Сотрудник
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Тип смены
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Время
                </th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>

            {/* Тело таблицы */}
            <tbody className="divide-y divide-gray-100">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Calendar className="h-12 w-12 text-gray-300" />
                      <p className="text-gray-500 font-medium">
                        {search || filterType !== 'all'
                          ? 'Нет смен, соответствующих фильтрам'
                          : 'Нет смен на выбранный период'}
                      </p>
                      {!search && filterType === 'all' && (
                        <button
                          onClick={() => {
                            resetShiftForm();
                            setWorkDate(format(new Date(), 'yyyy-MM-dd'));
                            setShowAddShiftModal(true);
                          }}
                          className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                        >
                          <Plus className="h-4 w-4" />
                          Добавить первую смену
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift, index) => {
                  const editable = canEditShift(shift.work_date);
                  const shiftDate = parseISO(shift.work_date);
                  const isWeekendDay = isWeekend(shiftDate);

                  return (
                    <tr
                      key={shift.id}
                      className={`hover:bg-gray-50 transition ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      {/* Дата */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-1 h-12 rounded-full ${
                              isWeekendDay ? 'bg-red-400' : 'bg-indigo-400'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {format(shiftDate, 'dd.MM.yyyy')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(shiftDate, 'EEEE', { locale: ru })}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Сотрудник */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {shift.employees?.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {shift.employees?.full_name || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Тип смены */}
                      <td className="px-6 py-4">
                        {shift.is_full_day ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Полный день
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            Частичный день
                          </span>
                        )}
                      </td>

                      {/* Время */}
                      <td className="px-6 py-4">
                        {shift.is_full_day ? (
                          <span className="text-sm text-gray-500">10:00 – 22:00</span>
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                          </span>
                        )}
                      </td>

                      {/* Действия */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {shift.comment && (
                            <button
                              onClick={() => setViewingComment(shift.comment)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                              title="Просмотреть комментарий"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditShift(shift)}
                            disabled={!editable}
                            className={`p-2 rounded-lg transition ${
                              editable
                                ? 'text-indigo-600 hover:bg-indigo-50'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}
                            title={editable ? 'Редактировать' : 'Редактирование запрещено'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteShift(shift)}
                            disabled={!editable}
                            className={`p-2 rounded-lg transition ${
                              editable
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}
                            title={editable ? 'Удалить' : 'Удаление запрещено'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* Модальное окно просмотра комментария */}
      {/* ========================================== */}
      {viewingComment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingComment(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-600" />
                Комментарий к смене
              </h3>
              <button
                onClick={() => setViewingComment(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-gray-700 whitespace-pre-wrap">{viewingComment}</p>
            </div>
            <button
              onClick={() => setViewingComment(null)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* Модальное окно добавления/редактирования смены */}
      {/* ========================================== */}
      {showAddShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-scale-in">
            <form onSubmit={handleSaveShift} className="p-6 space-y-4">
              {/* Заголовок */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  {editingShiftId ? 'Редактировать смену' : 'Новая смена'}
                </h3>
                <button
                  type="button"
                  onClick={resetShiftForm}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Ошибка */}
              {formError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Поле: Сотрудник */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сотрудник <span className="text-red-500">*</span>
                </label>
                {editingShiftId ? (
                  <input
                    type="text"
                    value={addEmployeeSearch}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 rounded-lg"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Начните вводить ФИО..."
                      value={addEmployeeSearch}
                      onChange={(e) => setAddEmployeeSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    {addEmployeeResults.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {addEmployeeResults.map((emp) => (
                          <li
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmployeeId(emp.id);
                              setAddEmployeeSearch(emp.full_name);
                              setAddEmployeeResults([]);
                            }}
                            className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-900 transition"
                          >
                            {emp.full_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Поле: Дата */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={!!editingShiftId}
                  required
                />
              </div>

              {/* Поле: Полный день */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isFullDay"
                  checked={isFullDay}
                  onChange={(e) => setIsFullDay(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                />
                <label htmlFor="isFullDay" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Полный день (10:00 – 22:00)
                </label>
              </div>

              {/* Поля: Время начала и окончания */}
              {!isFullDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Начало <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Конец <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Поле: Комментарий */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Комментарий
                </label>
                <textarea
                  value={shiftComment}
                  onChange={(e) => setShiftComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Необязательно"
                />
              </div>

              {/* Кнопки действий */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetShiftForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm hover:shadow-md"
                >
                  {editingShiftId ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSS для анимаций */}
      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
