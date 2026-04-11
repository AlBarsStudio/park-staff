/*
 * =====================================================================
 * AdminDashboard - Панель администратора
 * 
 * Возможности:
 * - Адаптивный дизайн для мобильных устройств
 * - Улучшенный UX/UI
 * - Полная интеграция с DatabaseService
 * - Автоматическое логирование всех действий
 * - Обновление данных только при изменениях
 * =====================================================================
 */

// ============================================================
// БЛОК 1: Импорты и типы
// ============================================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { dbService, Employee, Attraction, ScheduleAssignment, EmployeeAvailability } from '../lib/DatabaseService';
import { UserProfile } from '../types';
import {
  Loader2, Search, Edit2, Trash2, Plus, ChevronLeft, ChevronRight,
  Calendar, LayoutGrid, CalendarDays, Wand2, X, Users, Gamepad2, UserCheck,
  CheckCircle, AlertCircle, MessageSquare, PlusCircle, MinusCircle, Save,
  Menu, Clock
} from 'lucide-react';
import {
  format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfDay, addMonths, subMonths, startOfWeek, addDays, isWeekend, getDay
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScheduleGenerator } from './ScheduleGenerator';
import { AttractionsList } from './AttractionsList';
import { EmployeesList } from './EmployeesList';
import { ManualScheduleComposer } from './ManualScheduleComposer';
// ============================================================
// БЛОК 2: Типы
// ============================================================
type ViewMode = 'day' | 'week' | 'month';
type TabType = 'shifts' | 'schedule' | 'manual' | 'employees' | 'attractions' | 'scheduleView';

interface AdminDashboardProps {
  profile: UserProfile;
  isSuperAdmin?: boolean;
}

// ============================================================
// БЛОК 3: Вспомогательные функции
// ============================================================
function canEditSchedule(workDate: string): boolean {
  const now = new Date();
  const date = parseISO(workDate);
  const deadline = new Date(date);
  deadline.setHours(23, 0, 0, 0);
  return now < deadline;
}

function canEditShift(workDate: string): boolean {
  const today = startOfDay(new Date());
  const target = startOfDay(parseISO(workDate));
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
}

// ============================================================
// БЛОК 4: Основной компонент
// ============================================================
export function AdminDashboard({ profile, isSuperAdmin = false }: AdminDashboardProps) {
  // ============================================================
  // Состояния UI
  // ============================================================
  const [activeTab, setActiveTab] = useState<TabType>('shifts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ============================================================
  // Данные
  // ============================================================
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [shifts, setShifts] = useState<EmployeeAvailability[]>([]);

  // ============================================================
  // Управление сменами
  // ============================================================
  const [search, setSearch] = useState('');
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfMonth(new Date()));

  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [workDate, setWorkDate] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [shiftComment, setShiftComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [addEmployeeSearch, setAddEmployeeSearch] = useState('');
  const [addEmployeeResults, setAddEmployeeResults] = useState<Employee[]>([]);

  // Модальное окно комментария
  const [viewingComment, setViewingComment] = useState<string | null>(null);

  // ============================================================
  // Ручное составление
  // ============================================================
  const [manualMonth, setManualMonth] = useState<Date>(new Date());
  const [manualSelectedDay, setManualSelectedDay] = useState<Date | null>(null);
  const [manualWorkingAttractions, setManualWorkingAttractions] = useState<Set<number>>(new Set());
  const [manualEmployeesForDay, setManualEmployeesForDay] = useState<any[]>([]);
  const [manualAttractionAssignments, setManualAttractionAssignments] = useState<Map<number, number[]>>(new Map());
  const [manualDayDataLoading, setManualDayDataLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualShowAddModal, setManualShowAddModal] = useState<{ attractionId: number; attractionName: string } | null>(null);
  const [manualEmployeeSelection, setManualEmployeeSelection] = useState<Set<number>>(new Set());

  const [prioritiesCache, setPrioritiesCache] = useState<any[]>([]);
  const [goalsCache, setGoalsCache] = useState<any[]>([]);

  // ============================================================
  // График смен
  // ============================================================
  const [scheduleViewMode, setScheduleViewMode] = useState<ViewMode>('month');
  const [scheduleViewDate, setScheduleViewDate] = useState<Date>(new Date());
  const [scheduleViewMonth, setScheduleViewMonth] = useState<Date>(new Date());
  const [scheduleViewWeekStart, setScheduleViewWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const scheduleViewRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // БЛОК 5: Инициализация
  // ============================================================
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!profile?.auth_uid) {
          throw new Error('auth_uid отсутствует в профиле');
        }

        console.log('[AdminDashboard] Инициализация для:', profile.full_name, 'auth_uid:', profile.auth_uid);

        const success = await dbService.init(profile.auth_uid);

        if (!success) {
          throw new Error('Не удалось инициализировать базу данных');
        }

        setEmployees(dbService.getEmployees());
        setAttractions(dbService.getAttractions());
        setScheduleAssignments(dbService.getScheduleAssignments());
        setShifts(dbService.getEmployeeAvailability());

        console.log('[AdminDashboard] Данные успешно загружены');
      } catch (err: any) {
        console.error('[AdminDashboard] Ошибка инициализации:', err);
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [profile]);

  // ============================================================
  // Обновление данных (только при действиях)
  // ============================================================
  const refreshData = useCallback(async () => {
    try {
      const success = await dbService.refresh();
      if (success) {
        setEmployees(dbService.getEmployees());
        setAttractions(dbService.getAttractions());
        setScheduleAssignments(dbService.getScheduleAssignments());
        setShifts(dbService.getEmployeeAvailability());
      }
    } catch (err) {
      console.error('[AdminDashboard] Ошибка обновления:', err);
    }
  }, []);

  // ============================================================
  // БЛОК 6: Управление сменами
  // ============================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!addEmployeeSearch.trim()) {
        setAddEmployeeResults([]);
        return;
      }
      const filtered = employees.filter((emp) => emp.full_name.toLowerCase().includes(addEmployeeSearch.toLowerCase()));
      setAddEmployeeResults(filtered.slice(0, 10));
    }, 300);
    return () => clearTimeout(timer);
  }, [addEmployeeSearch, employees]);

  const resetShiftForm = () => {
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
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedEmployeeId) {
      setFormError('Выберите сотрудника');
      return;
    }
    if (!workDate) {
      setFormError('Укажите дату');
      return;
    }
    if (!isFullDay && (!startTime || !endTime)) {
      setFormError('Укажите время');
      return;
    }

    const existingShift = shifts.find((s) => s.employee_id === Number(selectedEmployeeId) && s.work_date === workDate && s.id !== editingShiftId);
    if (existingShift) {
      setFormError('У сотрудника уже есть смена на эту дату');
      return;
    }

    try {
      if (editingShiftId) {
        const success = await dbService.updateAvailability(editingShiftId, {
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          comment: shiftComment || null,
        });

        if (!success) {
          setFormError('Ошибка сохранения');
          return;
        }
      } else {
        const result = await dbService.createAvailability({
          employee_id: Number(selectedEmployeeId),
          work_date: workDate,
          is_full_day: isFullDay,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
          comment: shiftComment || null,
        });

        if (!result) {
          setFormError('Ошибка добавления');
          return;
        }
      }

      await refreshData();
      resetShiftForm();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка');
    }
  };

  const handleEditShift = (shift: EmployeeAvailability) => {
    if (!canEditShift(shift.work_date)) {
      alert('Редактирование запрещено (прошло более 2 дней)');
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

  const handleDeleteShift = async (shift: EmployeeAvailability) => {
    if (!canEditShift(shift.work_date)) {
      alert('Удаление запрещено (прошло более 2 дней)');
      return;
    }

    if (!confirm(`Удалить смену для ${shift.employees?.full_name}?`)) return;

    const success = await dbService.deleteAvailability(shift.id);
    if (success) {
      await refreshData();
    } else {
      alert('Ошибка удаления');
    }
  };

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

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((s) => s.employees?.full_name?.toLowerCase().includes(q) || s.work_date.includes(q));
  }, [shiftsForMonth, viewMode, selectedDate, selectedWeekStart, search]);

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

  const monthLabel = format(new Date(currentYear, currentMonth, 1), 'LLLL yyyy', { locale: ru });

  // ============================================================
  // БЛОК 7: Ручное составление
  // ============================================================
  const fetchDayData = useCallback(
    async (date: Date) => {
      if (!date) return;

      setManualDayDataLoading(true);
      setManualError(null);

      try {
        const dateStr = format(date, 'yyyy-MM-dd');

        const availData = dbService.getAvailabilityByDate(date);
        const availableEmpIds = availData.map((a) => a.employee_id);

        const allGoals = dbService.getStudyGoals();
        const goalsForDay = allGoals.filter((g) => availableEmpIds.includes(g.employee_id));
        setGoalsCache(goalsForDay);

        const allPriorities = dbService.getPriorities();
        setPrioritiesCache(allPriorities);

        const daySchedule = dbService.getScheduleByDate(date);

        const goalsMap = new Map<number, string>();
        goalsForDay.forEach((g) => {
          const attr = attractions.find((a) => a.id === g.attraction_id);
          if (attr) goalsMap.set(g.employee_id, attr.name);
        });

        const enrichedEmployees = availData
          .map((avail) => {
            const emp = employees.find((e) => e.id === avail.employee_id);
            if (!emp) return null;

            return {
              ...emp,
              availability: {
                isFullDay: avail.is_full_day,
                startTime: avail.start_time,
                endTime: avail.end_time,
                comment: avail.comment,
              },
              studyGoal: goalsMap.get(avail.employee_id) || null,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a!.full_name.localeCompare(b!.full_name));

        setManualEmployeesForDay(enrichedEmployees);

        const workingAttrSet = new Set<number>();
        const assignMap = new Map<number, number[]>();

        daySchedule.forEach((a) => {
          workingAttrSet.add(a.attraction_id);
          const list = assignMap.get(a.attraction_id) || [];
          list.push(a.employee_id);
          assignMap.set(a.attraction_id, list);
        });

        setManualWorkingAttractions(workingAttrSet);
        setManualAttractionAssignments(assignMap);
      } catch (err: any) {
        console.error('[AdminDashboard] Ошибка загрузки данных дня:', err);
        setManualError(err.message || 'Ошибка загрузки');
      } finally {
        setManualDayDataLoading(false);
      }
    },
    [employees, attractions]
  );

  const handleDaySelect = (day: Date) => {
    setManualSelectedDay(day);
    fetchDayData(day);
  };

  const handleManualMonthChange = (direction: 'prev' | 'next') => {
    setManualMonth((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const monthDays = useMemo(() => {
    const start = startOfMonth(manualMonth);
    const end = endOfMonth(manualMonth);
    return eachDayOfInterval({ start, end });
  }, [manualMonth]);

  const dayHasSchedule = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return scheduleAssignments.some((a) => a.work_date === dateStr);
  };

  const toggleAttractionWorking = (attractionId: number) => {
    setManualWorkingAttractions((prev) => {
      const next = new Set(prev);
      if (next.has(attractionId)) {
        next.delete(attractionId);
        setManualAttractionAssignments((prevAssign) => {
          const newAssign = new Map(prevAssign);
          newAssign.delete(attractionId);
          return newAssign;
        });
      } else {
        next.add(attractionId);
      }
      return next;
    });
  };

  const handleAddEmployeesToAttraction = (attractionId: number, employeeIds: number[]) => {
    setManualAttractionAssignments((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(attractionId) || [];
      const combined = [...new Set([...existing, ...employeeIds])];
      newMap.set(attractionId, combined);
      return newMap;
    });
    setManualShowAddModal(null);
    setManualEmployeeSelection(new Set());
  };

  const removeEmployeeFromAttraction = (attractionId: number, employeeId: number) => {
    setManualAttractionAssignments((prev) => {
      const newMap = new Map(prev);
      const list = newMap.get(attractionId) || [];
      const filtered = list.filter((id) => id !== employeeId);
      if (filtered.length === 0) {
        newMap.delete(attractionId);
      } else {
        newMap.set(attractionId, filtered);
      }
      return newMap;
    });
  };

  const getAvailableEmployeesForAttraction = (attractionId: number) => {
    const assignedEmployeeIds = new Set<number>();
    manualAttractionAssignments.forEach((ids) => ids.forEach((id) => assignedEmployeeIds.add(id)));

    const available = manualEmployeesForDay.filter((emp) => !assignedEmployeeIds.has(emp.id));

    const priorityMap = new Map<number, number[]>();
    prioritiesCache.forEach((p) => {
      if (p.attraction_ids && Array.isArray(p.attraction_ids) && p.attraction_ids.includes(attractionId)) {
        const list = priorityMap.get(p.priority_level) || [];
        list.push(p.employee_id);
        priorityMap.set(p.priority_level, list);
      }
    });

    const goalEmployeeIds = goalsCache.filter((g) => g.attraction_id === attractionId).map((g) => g.employee_id);

    const getEmpsByIds = (ids: number[]) => {
      return available.filter((emp) => ids.includes(emp.id));
    };

    return {
      priority1: getEmpsByIds(priorityMap.get(1) || []),
      priority2: getEmpsByIds(priorityMap.get(2) || []),
      priority3: getEmpsByIds(priorityMap.get(3) || []),
      goals: getEmpsByIds(goalEmployeeIds),
    };
  };

  const handleSaveManualSchedule = async () => {
    if (!manualSelectedDay) {
      setManualError('Выберите день');
      return;
    }

    const dateStr = format(manualSelectedDay, 'yyyy-MM-dd');

    if (!canEditSchedule(dateStr)) {
      setManualError('Редактирование невозможно: прошло 23:00');
      return;
    }

    if (!confirm(`Сохранить график на ${format(manualSelectedDay, 'dd.MM.yyyy', { locale: ru })}?`)) return;

    setManualSaving(true);
    setManualError(null);

    try {
      const assignmentsToInsert: Array<{
        employee_id: number;
        attraction_id: number;
        work_date: string;
        start_time: string;
        end_time: string | null;
      }> = [];

      manualAttractionAssignments.forEach((employeeIds, attractionId) => {
        employeeIds.forEach((empId) => {
          const empAvail = manualEmployeesForDay.find((e) => e.id === empId);
          let startTime = '10:00';
          let endTime = '22:00';

          if (empAvail && !empAvail.availability.isFullDay) {
            startTime = empAvail.availability.startTime || '10:00';
            endTime = empAvail.availability.endTime || '22:00';
          }

          assignmentsToInsert.push({
            employee_id: empId,
            attraction_id: attractionId,
            work_date: dateStr,
            start_time: startTime,
            end_time: endTime,
          });
        });
      });

      await dbService.deleteScheduleByDate(dateStr);

      if (assignmentsToInsert.length > 0) {
        const success = await dbService.bulkCreateScheduleAssignments(assignmentsToInsert);
        if (!success) throw new Error('Ошибка сохранения');
      }

      await refreshData();
      fetchDayData(manualSelectedDay);

      alert('График сохранён!');
    } catch (err: any) {
      console.error('[AdminDashboard] Ошибка сохранения:', err);
      setManualError(err.message || 'Ошибка');
    } finally {
      setManualSaving(false);
    }
  };

  // ============================================================
  // БЛОК 8: График смен (вычисления)
  // ============================================================
  const scheduleViewDays = useMemo(() => {
    if (scheduleViewMode === 'day') {
      return [scheduleViewDate];
    } else if (scheduleViewMode === 'week') {
      return eachDayOfInterval({ start: scheduleViewWeekStart, end: addDays(scheduleViewWeekStart, 6) });
    } else {
      const start = startOfMonth(scheduleViewMonth);
      const end = endOfMonth(scheduleViewMonth);
      return eachDayOfInterval({ start, end });
    }
  }, [scheduleViewMode, scheduleViewDate, scheduleViewMonth, scheduleViewWeekStart]);

  const scheduleViewData = useMemo(() => {
    const startDate = format(scheduleViewDays[0], 'yyyy-MM-dd');
    const endDate = format(scheduleViewDays[scheduleViewDays.length - 1], 'yyyy-MM-dd');

    return scheduleAssignments.filter((a) => a.work_date >= startDate && a.work_date <= endDate);
  }, [scheduleAssignments, scheduleViewDays]);

  // Группировка по аттракционам и датам
  const scheduleByAttractionAndDate = useMemo(() => {
    const grouped = new Map<number, Map<string, ScheduleAssignment[]>>();

    scheduleViewData.forEach((assignment) => {
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
  }, [scheduleViewData]);

  // Получение имени и фамилии сотрудника
  const getShortName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    return fullName;
  };

  // ============================================================
  // БЛОК 9: Рендер загрузки и ошибок
  // ============================================================
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 h-12 w-12 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Ошибка загрузки</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Список вкладок
  // ============================================================
  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'shifts', label: 'Управление сменами', icon: Calendar },
    { id: 'schedule', label: 'Генератор графика', icon: Wand2 },
    { id: 'manual', label: 'Ручное составление', icon: UserCheck },
    { id: 'scheduleView', label: 'График смен', icon: LayoutGrid },
    { id: 'employees', label: 'Сотрудники', icon: Users },
    { id: 'attractions', label: 'Аттракционы', icon: Gamepad2 },
  ];

  // ============================================================
  // БЛОК 10: Основной рендер
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 transition-colors">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Панель администратора</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Мобильное меню */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setMobileMenuOpen(false)}>
            <div className="bg-white w-64 h-full p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Меню</h2>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-700" />
                </button>
              </div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Основной контент */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Десктоп вкладки */}
          <div className="hidden lg:flex border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ========================================== */}
          {/* ВКЛАДКА: Управление сменами */}
          {/* ========================================== */}
          {activeTab === 'shifts' && (
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </button>
                  <span className="text-xl font-semibold capitalize text-gray-900">{monthLabel}</span>
                  <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ChevronRight className="h-5 w-5 text-gray-700" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setViewMode('day');
                      setSelectedDate(new Date(currentYear, currentMonth, 1));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      viewMode === 'day'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    День
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('week');
                      setSelectedWeekStart(startOfWeek(new Date(currentYear, currentMonth, 1), { weekStartsOn: 1 }));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      viewMode === 'week'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Неделя
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      viewMode === 'month'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Месяц
                  </button>
                </div>
              </div>

              {viewMode === 'day' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Дата:</span>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {viewMode === 'week' && (
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedWeekStart((prev) => addDays(prev, -7))} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="h-4 w-4 text-gray-700" />
                  </button>
                  <span className="text-sm font-medium text-gray-900">
                    {format(selectedWeekStart, 'd MMM', { locale: ru })} – {format(addDays(selectedWeekStart, 6), 'd MMM yyyy', { locale: ru })}
                  </span>
                  <button onClick={() => setSelectedWeekStart((prev) => addDays(prev, 7))} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronRight className="h-4 w-4 text-gray-700" />
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    resetShiftForm();
                    setWorkDate(format(new Date(), 'yyyy-MM-dd'));
                    setShowAddShiftModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Добавить смену
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Дата</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Сотрудник</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Смена</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filteredShifts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                            Нет смен
                          </td>
                        </tr>
                      ) : (
                        filteredShifts.map((shift) => {
                          const editable = canEditShift(shift.work_date);
                          return (
                            <tr key={shift.id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-sm text-gray-900">{format(parseISO(shift.work_date), 'dd.MM.yyyy')}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{shift.employees?.full_name || '—'}</td>
                              <td className="px-4 py-3 text-sm">
                                {shift.is_full_day ? (
                                  <span className="text-gray-700">Полный день</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-medium">
                                    <Clock className="h-3 w-3" />
                                    {shift.start_time?.slice(0, 5)} – {shift.end_time?.slice(0, 5)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  {shift.comment && (
                                    <button
                                      onClick={() => setViewingComment(shift.comment)}
                                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                                      title="Просмотреть комментарий"
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEditShift(shift)}
                                    disabled={!editable}
                                    className={`p-1.5 rounded-lg transition ${
                                      editable
                                        ? 'text-blue-600 hover:bg-blue-50'
                                        : 'text-gray-300 cursor-not-allowed'
                                    }`}
                                    title={editable ? 'Редактировать' : 'Редактирование запрещено'}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteShift(shift)}
                                    disabled={!editable}
                                    className={`p-1.5 rounded-lg transition ${
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
            </div>
          )}

          {/* Модальное окно комментария */}
          {viewingComment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setViewingComment(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Комментарий</h3>
                  <button onClick={() => setViewingComment(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{viewingComment}</p>
                <button
                  onClick={() => setViewingComment(null)}
                  className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}

          {/* Модальное окно добавления/редактирования смены */}
          {showAddShiftModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <form onSubmit={handleSaveShift} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{editingShiftId ? 'Редактировать' : 'Новая смена'}</h3>
                    <button type="button" onClick={resetShiftForm} className="text-gray-400 hover:text-gray-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {formError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

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
                          className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-900"
                              >
                                {emp.full_name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Дата <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={!!editingShiftId}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isFullDay"
                      checked={isFullDay}
                      onChange={(e) => setIsFullDay(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isFullDay" className="text-sm font-medium text-gray-700">
                      Полный день
                    </label>
                  </div>

                  {!isFullDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Начало</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Конец</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
                    <textarea
                      value={shiftComment}
                      onChange={(e) => setShiftComment(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg"
                      placeholder="Необязательно"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={resetShiftForm} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                      Отмена
                    </button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {editingShiftId ? 'Сохранить' : 'Добавить'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* ВКЛАДКА: Генератор графика */}
          {/* ========================================== */}
          {activeTab === 'schedule' && (
            <div className="p-4 sm:p-6">
              <ScheduleGenerator profile={profile} isSuperAdmin={isSuperAdmin} onScheduleGenerated={refreshData} />
            </div>
          )}

          {/* ========================================== */}
          {/* ВКЛАДКА: Ручное составление */}
          {/* ========================================== */}
          {activeTab === 'manual' && (
            <div className="p-4 sm:p-6">
              <ManualScheduleComposer
                employees={employees}
                attractions={attractions}
                scheduleAssignments={scheduleAssignments}
                onRefreshData={refreshData}
              />
            </div>
          )}
          
          {/* ========================================== */}
          {/* ВКЛАДКА: График смен */}
          {/* ========================================== */}
          {activeTab === 'scheduleView' && (
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {scheduleViewMode === 'month' && (
                    <>
                      <button onClick={() => setScheduleViewMonth(subMonths(scheduleViewMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100">
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                      </button>
                      <h3 className="text-xl font-semibold capitalize text-gray-900">{format(scheduleViewMonth, 'LLLL yyyy', { locale: ru })}</h3>
                      <button onClick={() => setScheduleViewMonth(addMonths(scheduleViewMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100">
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                      </button>
                    </>
                  )}

                  {scheduleViewMode === 'week' && (
                    <>
                      <button onClick={() => setScheduleViewWeekStart(addDays(scheduleViewWeekStart, -7))} className="p-2 rounded-lg hover:bg-gray-100">
                        <ChevronLeft className="h-5 w-5 text-gray-700" />
                      </button>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {format(scheduleViewWeekStart, 'd MMM', { locale: ru })} – {format(addDays(scheduleViewWeekStart, 6), 'd MMM yyyy', { locale: ru })}
                      </h3>
                      <button onClick={() => setScheduleViewWeekStart(addDays(scheduleViewWeekStart, 7))} className="p-2 rounded-lg hover:bg-gray-100">
                        <ChevronRight className="h-5 w-5 text-gray-700" />
                      </button>
                    </>
                  )}

                  {scheduleViewMode === 'day' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Дата:</span>
                      <input
                        type="date"
                        value={format(scheduleViewDate, 'yyyy-MM-dd')}
                        onChange={(e) => setScheduleViewDate(new Date(e.target.value))}
                        className="border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setScheduleViewMode('day');
                      setScheduleViewDate(new Date());
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleViewMode === 'day'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    День
                  </button>
                  <button
                    onClick={() => {
                      setScheduleViewMode('week');
                      setScheduleViewWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleViewMode === 'week'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Неделя
                  </button>
                  <button
                    onClick={() => {
                      setScheduleViewMode('month');
                      setScheduleViewMonth(new Date());
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      scheduleViewMode === 'month'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Месяц
                  </button>
                </div>
              </div>

              <div ref={scheduleViewRef} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">
                          Аттракцион
                        </th>
                        {scheduleViewDays.map((day) => (
                          <th
                            key={day.toISOString()}
                            className={`px-2 py-3 text-center text-xs font-semibold uppercase border-r border-gray-200 ${
                              isWeekend(day) ? 'bg-red-50 text-red-700' : 'text-gray-600'
                            }`}
                          >
                            <div>{format(day, 'd')}</div>
                            <div className="text-[10px] font-normal">{format(day, 'EEE', { locale: ru })}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {attractions.map((attraction) => {
                        const attractionSchedule = scheduleByAttractionAndDate.get(attraction.id);
                        
                        return (
                          <tr key={attraction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 whitespace-nowrap">
                              {attraction.name}
                            </td>
                            {scheduleViewDays.map((day) => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const assignments = attractionSchedule?.get(dateStr) || [];

                              return (
                                <td
                                  key={day.toISOString()}
                                  className={`px-2 py-2 text-xs border-r border-gray-200 align-top ${
                                    isWeekend(day) ? 'bg-red-50/50' : ''
                                  }`}
                                  style={{ minHeight: assignments.length > 0 ? `${assignments.length * 2}rem` : 'auto' }}
                                >
                                  {assignments.length > 0 ? (
                                    <div className="space-y-1">
                                      {assignments.map((assignment) => {
                                        const employee = employees.find(e => e.id === assignment.employee_id);
                                        const shortName = employee ? getShortName(employee.full_name) : '—';
                                        const isPartialShift = assignment.start_time !== '10:00' || assignment.end_time !== '22:00';

                                        return (
                                          <div key={assignment.id} className="bg-blue-100 text-blue-700 px-1.5 py-1 rounded text-[11px] leading-tight">
                                            <div>{shortName}</div>
                                            {isPartialShift && (
                                              <div className="text-[9px] opacity-75 mt-0.5">
                                                {assignment.start_time?.slice(0, 5)}-{assignment.end_time?.slice(0, 5)}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 block text-center">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* ВКЛАДКА: Сотрудники */}
          {/* ========================================== */}
          {activeTab === 'employees' && (
            <div className="p-4 sm:p-6">
              <EmployeesList employees={employees} />
            </div>
          )}

          {/* ========================================== */}
          {/* ВКЛАДКА: Аттракционы */}
          {/* ========================================== */}
          {activeTab === 'attractions' && (
            <div className="p-4 sm:p-6">
              <AttractionsList isSuperAdmin={isSuperAdmin} onAttractionUpdate={refreshData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
