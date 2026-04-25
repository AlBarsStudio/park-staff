/**
 * AdminShiftsManagement — обёртка над ShiftsManagement для AdminDashboard.
 * Весь логика хранится здесь, чтобы не дублировать код.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Edit2, Trash2, Plus, ChevronLeft, ChevronRight,
  Calendar, Clock, X, AlertCircle, MessageSquare, Filter,
  Users, CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import {
  format, parseISO, isSameDay, startOfDay, addMonths, subMonths,
  startOfWeek, addDays, isWeekend,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { dbService, Employee, EmployeeAvailability } from '../../lib/DatabaseService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';

// ============================================================
// Типы
// ============================================================
type ViewMode = 'day' | 'week' | 'month';
type FilterType = 'all' | 'full' | 'partial';

interface AdminShiftsManagementProps {
  employees: Employee[];
  shifts: EmployeeAvailability[];
  onRefreshData: () => Promise<void>;
}

// ============================================================
// Вспомогательные функции
// ============================================================
function canEditShift(workDate: string): boolean {
  const today = startOfDay(new Date());
  const target = startOfDay(parseISO(workDate));
  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 2;
}

function formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

// ============================================================
// Основной компонент
// ============================================================
export function AdminShiftsManagement({
  employees,
  shifts,
  onRefreshData,
}: AdminShiftsManagementProps) {
  // Навигация
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Фильтры
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Форма добавления/редактирования
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [workDate, setWorkDate] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shiftComment, setShiftComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Поиск сотрудника в форме
  const [addEmployeeSearch, setAddEmployeeSearch] = useState('');
  const [addEmployeeResults, setAddEmployeeResults] = useState<Employee[]>([]);

  // Просмотр комментария
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

    if (viewMode === 'day') {
      base = base.filter((s) => isSameDay(parseISO(s.work_date), selectedDate));
    } else if (viewMode === 'week') {
      const weekEnd = addDays(selectedWeekStart, 6);
      base = base.filter((s) => {
        const d = parseISO(s.work_date);
        return d >= selectedWeekStart && d <= weekEnd;
      });
    }

    if (filterType === 'full') base = base.filter((s) => s.is_full_day);
    else if (filterType === 'partial') base = base.filter((s) => !s.is_full_day);

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
  const statistics = useMemo(() => ({
    total: filteredShifts.length,
    fullDay: filteredShifts.filter((s) => s.is_full_day).length,
    partial: filteredShifts.filter((s) => !s.is_full_day).length,
    uniqueEmployees: new Set(filteredShifts.map((s) => s.employee_id)).size,
  }), [filteredShifts]);

  // ============================================================
  // Навигация по месяцам
  // ============================================================
  const handlePrevMonth = () => {
    const d = subMonths(new Date(currentYear, currentMonth, 1), 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  const handleNextMonth = () => {
    const d = addMonths(new Date(currentYear, currentMonth, 1), 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
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

    if (!selectedEmployeeId) return setFormError('Выберите сотрудника');
    if (!workDate) return setFormError('Укажите дату');
    if (!isFullDay && (!startTime || !endTime))
      return setFormError('Укажите время начала и окончания смены');

    const existingShift = shifts.find(
      (s) =>
        s.employee_id === Number(selectedEmployeeId) &&
        s.work_date === workDate &&
        s.id !== editingShiftId
    );
    if (existingShift) return setFormError('У сотрудника уже есть смена на эту дату');

    try {
      if (editingShiftId) {
        const success = await dbService.updateAvailability(editingShiftId, {
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          comment: shiftComment || null,
        });
        if (!success) return setFormError('Ошибка сохранения изменений');
      } else {
        const result = await dbService.createAvailability({
          employee_id: Number(selectedEmployeeId),
          work_date: workDate,
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          comment: shiftComment || null,
        });
        if (!result) return setFormError('Ошибка добавления смены');
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
      {/* Шапка со статистикой */}
      <Card
        className="p-6"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
          color: 'white',
          border: 'none',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          {/* Навигация по месяцам */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              icon={<ChevronLeft className="h-5 w-5" />}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
              title="Предыдущий месяц"
            />
            <div className="flex flex-col items-center min-w-[200px]">
              <h2 className="text-2xl font-bold capitalize">{monthLabel}</h2>
              <button onClick={handleToday} className="text-sm hover:underline mt-1 opacity-90">
                Текущий месяц
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              icon={<ChevronRight className="h-5 w-5" />}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
              title="Следующий месяц"
            />
          </div>

          {/* Переключатель режима */}
          <div
            className="flex items-center gap-2 p-1 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if (mode === 'day') setSelectedDate(new Date(currentYear, currentMonth, 1));
                  if (mode === 'week')
                    setSelectedWeekStart(
                      startOfWeek(new Date(currentYear, currentMonth, 1), { weekStartsOn: 1 })
                    );
                }}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition',
                  viewMode === mode ? 'bg-white shadow-md' : 'text-white hover:bg-white/10'
                )}
                style={viewMode === mode ? { color: 'var(--primary)' } : {}}
              >
                {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Calendar, label: 'Всего смен', value: statistics.total },
            { icon: CheckCircle, label: 'Полный день', value: statistics.fullDay },
            { icon: Clock, label: 'Частичный', value: statistics.partial },
            { icon: Users, label: 'Сотрудников', value: statistics.uniqueEmployees },
          ].map((stat, index) => (
            <div
              key={index}
              className="rounded-lg p-4 backdrop-blur-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
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

      {/* Выбор даты (режим "День") */}
      {viewMode === 'day' && (
        <Card>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5" style={{ color: 'var(--text-subtle)' }} />
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Выберите дату:
            </label>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="input"
            />
          </div>
        </Card>
      )}

      {/* Выбор недели (режим "Неделя") */}
      {viewMode === 'week' && (
        <Card>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedWeekStart((prev) => addDays(prev, -7))}
              icon={<ChevronLeft className="h-4 w-4" />}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {format(selectedWeekStart, 'd MMM', { locale: ru })} –{' '}
              {format(addDays(selectedWeekStart, 6), 'd MMM yyyy', { locale: ru })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedWeekStart((prev) => addDays(prev, 7))}
              icon={<ChevronRight className="h-4 w-4" />}
            />
          </div>
        </Card>
      )}

      {/* Панель инструментов */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Поиск сотрудника или даты..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" style={{ color: 'var(--text-subtle)' }} />}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                style={{ color: 'var(--text-subtle)' }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={filterType !== 'all' ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
              icon={<Filter className="h-4 w-4" />}
            >
              Фильтры
              {filterType !== 'all' && (
                <Badge variant="error" className="ml-1">1</Badge>
              )}
            </Button>
            <Button
              onClick={() => {
                resetShiftForm();
                setWorkDate(format(new Date(), 'yyyy-MM-dd'));
                setShowAddShiftModal(true);
              }}
              icon={<Plus className="h-4 w-4" />}
            >
              Добавить смену
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium" style={{ color: 'var(--text)' }}>
                Тип смены
              </h4>
              {filterType !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setFilterType('all')}>
                  Сбросить
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {[
                { type: 'all' as const, icon: Calendar, label: 'Все смены' },
                { type: 'full' as const, icon: CheckCircle, label: 'Полный день' },
                { type: 'partial' as const, icon: Clock, label: 'Частичный день' },
              ].map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-lg border-2 transition',
                    filterType === type ? 'bg-primary-light' : 'hover:bg-tertiary'
                  )}
                  style={{
                    borderColor: filterType === type ? 'var(--primary)' : 'var(--border)',
                    color: filterType === type ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Таблица смен */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: 'var(--border)' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                {['Дата', 'Сотрудник', 'Тип смены', 'Время', 'Действия'].map((header) => (
                  <th
                    key={header}
                    className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text)' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Calendar className="h-12 w-12" style={{ color: 'var(--text-subtle)' }} />
                      <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
                        {search || filterType !== 'all'
                          ? 'Нет смен, соответствующих фильтрам'
                          : 'Нет смен на выбранный период'}
                      </p>
                      {!search && filterType === 'all' && (
                        <Button
                          onClick={() => {
                            resetShiftForm();
                            setWorkDate(format(new Date(), 'yyyy-MM-dd'));
                            setShowAddShiftModal(true);
                          }}
                          icon={<Plus className="h-4 w-4" />}
                          className="mt-2"
                        >
                          Добавить первую смену
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => {
                  const editable = canEditShift(shift.work_date);
                  const shiftDate = parseISO(shift.work_date);
                  const isWeekendDay = isWeekend(shiftDate);

                  return (
                    <tr
                      key={shift.id}
                      className="transition"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1 h-12 rounded-full"
                            style={{
                              backgroundColor: isWeekendDay
                                ? 'var(--error)'
                                : 'var(--primary)',
                            }}
                          />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                              {format(shiftDate, 'dd.MM.yyyy')}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {format(shiftDate, 'EEEE', { locale: ru })}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                            style={{
                              background:
                                'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                            }}
                          >
                            {shift.employees?.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            {shift.employees?.full_name || '—'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {shift.is_full_day ? (
                          <Badge variant="success" dot>Полный день</Badge>
                        ) : (
                          <Badge variant="warning" dot>Частичный день</Badge>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {shift.is_full_day ? (
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            10:00 – 22:00
                          </span>
                        ) : (
                          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {shift.comment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingComment(shift.comment)}
                              icon={
                                <MessageSquare
                                  className="h-4 w-4"
                                  style={{ color: 'var(--info)' }}
                                />
                              }
                              title="Просмотреть комментарий"
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditShift(shift)}
                            disabled={!editable}
                            icon={
                              <Edit2
                                className="h-4 w-4"
                                style={{
                                  color: editable ? 'var(--primary)' : 'var(--text-subtle)',
                                }}
                              />
                            }
                            title={editable ? 'Редактировать' : 'Редактирование запрещено'}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteShift(shift)}
                            disabled={!editable}
                            icon={
                              <Trash2
                                className="h-4 w-4"
                                style={{
                                  color: editable ? 'var(--error)' : 'var(--text-subtle)',
                                }}
                              />
                            }
                            title={editable ? 'Удалить' : 'Удаление запрещено'}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Модал просмотра комментария */}
      <Modal
        isOpen={!!viewingComment}
        onClose={() => setViewingComment(null)}
        title="Комментарий к смене"
        size="sm"
      >
        <div className="p-6">
          <div
            className="rounded-lg p-4 mb-4"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <p style={{ color: 'var(--text)' }} className="whitespace-pre-wrap">
              {viewingComment}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setViewingComment(null)} className="w-full">
            Закрыть
          </Button>
        </div>
      </Modal>

      {/* Модал добавления/редактирования смены */}
      <Modal
        isOpen={showAddShiftModal}
        onClose={resetShiftForm}
        title={editingShiftId ? 'Редактировать смену' : 'Новая смена'}
        size="md"
      >
        <form onSubmit={handleSaveShift} className="p-6 space-y-4">
          {formError && (
            <div
              className="p-3 rounded-lg text-sm flex items-start gap-2"
              style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Сотрудник */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              Сотрудник <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            {editingShiftId ? (
              <Input type="text" value={addEmployeeSearch} disabled className="bg-tertiary" />
            ) : (
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Начните вводить ФИО..."
                  value={addEmployeeSearch}
                  onChange={(e) => setAddEmployeeSearch(e.target.value)}
                  autoFocus
                />
                {addEmployeeResults.length > 0 && (
                  <ul
                    className="absolute z-10 mt-1 w-full rounded-lg shadow-lg max-h-60 overflow-auto"
                    style={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {addEmployeeResults.map((emp) => (
                      <li
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setAddEmployeeSearch(emp.full_name);
                          setAddEmployeeResults([]);
                        }}
                        className="px-4 py-2 cursor-pointer text-sm transition"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {emp.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Дата */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              Дата <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="input w-full"
              disabled={!!editingShiftId}
              required
            />
          </div>

          {/* Полный день */}
          <div
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <input
              type="checkbox"
              id="isFullDay"
              checked={isFullDay}
              onChange={(e) => setIsFullDay(e.target.checked)}
              className="rounded w-5 h-5"
              style={{ accentColor: 'var(--primary)' }}
            />
            <label
              htmlFor="isFullDay"
              className="text-sm font-medium cursor-pointer"
              style={{ color: 'var(--text)' }}
            >
              Полный день (10:00 – 22:00)
            </label>
          </div>

          {/* Время */}
          {!isFullDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                  Начало <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                  Конец <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
            </div>
          )}

          {/* Комментарий */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              Комментарий
            </label>
            <textarea
              value={shiftComment}
              onChange={(e) => setShiftComment(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="Необязательно"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={resetShiftForm}>
              Отмена
            </Button>
            <Button type="submit">
              {editingShiftId ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
