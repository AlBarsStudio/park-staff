/*
 * =====================================================================
 * AdminDashboard - Панель администратора
 * 
 * Возможности:
 * - Темная тема (авто/светлая/темная)
 * - Адаптивный дизайн для мобильных устройств
 * - Улучшенный UX/UI
 * - Полная интеграция с DatabaseService
 * - Автоматическое логирование всех действий
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
  Menu, Sun, Moon, Monitor, Download, Eye, Clock
} from 'lucide-react';
import {
  format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfDay, addMonths, subMonths, startOfWeek, addDays, isWeekend, getDay
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScheduleGenerator } from './ScheduleGenerator';
import { AttractionsList } from './AttractionsList';

// ============================================================
// БЛОК 2: Типы
// ============================================================
type ViewMode = 'day' | 'week' | 'month';
type ThemeMode = 'light' | 'dark' | 'system';
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
// БЛОК 4: Компонент переключения темы
// ============================================================
function ThemeToggle({ theme, setTheme }: { theme: ThemeMode; setTheme: (theme: ThemeMode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition ${
          theme === 'light' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Светлая тема"
      >
        <Sun className="h-4 w-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition ${
          theme === 'dark' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Темная тема"
      >
        <Moon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition ${
          theme === 'system' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        title="Системная тема"
      >
        <Monitor className="h-4 w-4 text-gray-700 dark:text-gray-300" />
      </button>
    </div>
  );
}

// ============================================================
// БЛОК 5: Основной компонент
// ============================================================
export function AdminDashboard({ profile, isSuperAdmin = false }: AdminDashboardProps) {
  // ============================================================
  // Тема
  // ============================================================
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('admin-theme');
    return (saved as ThemeMode) || 'system';
  });

  useEffect(() => {
    localStorage.setItem('admin-theme', theme);

    const applyTheme = () => {
      const root = document.documentElement;
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', isDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

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
  const [scheduleViewMonth, setScheduleViewMonth] = useState<Date>(new Date());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const scheduleViewRef = useRef<HTMLDivElement>(null);
  const [exportingImage, setExportingImage] = useState(false);

  // ============================================================
  // БЛОК 6: Инициализация
  // ============================================================
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setError(null);

      try {
        const success = await dbService.init(profile.auth_uid!);

        if (!success) {
          setError('Ошибка инициализации данных');
          setLoading(false);
          return;
        }

        setEmployees(dbService.getEmployees());
        setAttractions(dbService.getAttractions());
        setScheduleAssignments(dbService.getScheduleAssignments());
        setShifts(dbService.getEmployeeAvailability());

        console.log('[AdminDashboard] Данные загружены');
      } catch (err: any) {
        console.error('[AdminDashboard] Ошибка:', err);
        setError(err.message || 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [profile.auth_uid]);

  // ============================================================
  // Обновление данных
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
  // БЛОК 7: Управление сменами
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
  // БЛОК 8: Ручное составление
  // ============================================================
  const fetchDayData = useCallback(
    async (date: Date) => {
      if (!date) return;

      setManualDayDataLoading(true);
      setManualError(null);

      try {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Доступность сотрудников
        const availData = dbService.getAvailabilityByDate(date);
        const availableEmpIds = availData.map((a) => a.employee_id);

        // Цели обучения
        const allGoals = dbService.getStudyGoals();
        const goalsForDay = allGoals.filter((g) => availableEmpIds.includes(g.employee_id));
        setGoalsCache(goalsForDay);

        // Приоритеты
        const allPriorities = dbService.getPriorities();
        setPrioritiesCache(allPriorities);

        // График
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

    // Приоритеты: учитываем attraction_ids (массив)
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
// БЛОК 9: Экспорт графика в PNG (простой метод)
// ============================================================
const handleExportScheduleImage = async () => {
  if (!scheduleViewRef.current) return;

  setExportingImage(true);

  try {
    const element = scheduleViewRef.current;
    const scale = 3; // Множитель для высокого разрешения

    // Создаём временный контейнер для рендера
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Не удалось открыть окно для экспорта');
    }

    // Копируем все стили
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          return '';
        }
      })
      .join('\n');

    // HTML для экспорта
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>График ${format(scheduleViewMonth, 'MMMM yyyy', { locale: ru })}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              background: ${theme === 'dark' ? '#1f2937' : '#ffffff'};
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
            }
            ${styles}
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();

    // Ждём загрузки
    await new Promise(resolve => setTimeout(resolve, 500));

    // Используем встроенную функцию печати браузера для сохранения в PDF
    printWindow.print();
    
    // Закрываем окно через 1 секунду
    setTimeout(() => printWindow.close(), 1000);

  } catch (err) {
    console.error('[AdminDashboard] Ошибка экспорта:', err);
    alert('Ошибка при экспорте. Попробуйте использовать скриншот (Ctrl+Shift+S в большинстве браузеров).');
  } finally {
    setExportingImage(false);
  }
};

  // ============================================================
  // БЛОК 10: График смен (вычисления)
  // ============================================================
  const scheduleViewDays = useMemo(() => {
    const start = startOfMonth(scheduleViewMonth);
    const end = endOfMonth(scheduleViewMonth);
    return eachDayOfInterval({ start, end });
  }, [scheduleViewMonth]);

  const scheduleViewData = useMemo(() => {
    const start = format(startOfMonth(scheduleViewMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(scheduleViewMonth), 'yyyy-MM-dd');

    return scheduleAssignments.filter((a) => a.work_date >= start && a.work_date <= end);
  }, [scheduleAssignments, scheduleViewMonth]);

  const filteredEmployeesForScheduleView = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter((e) => e.full_name.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  // ============================================================
  // БЛОК 11: Рендер загрузки и ошибок
  // ============================================================
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 h-12 w-12 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Ошибка загрузки</h3>
            <p className="text-red-700 dark:text-red-300">{error}</p>
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
  // БЛОК 12: Основной рендер
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Шапка */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <Menu className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Панель администратора</h1>
          </div>

          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Мобильное меню */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setMobileMenuOpen(false)}>
            <div className="bg-white dark:bg-gray-800 w-64 h-full p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">Меню</h2>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
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
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Десктоп вкладки */}
          <div className="hidden lg:flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
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
                  <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <span className="text-xl font-semibold capitalize text-gray-900 dark:text-white">{monthLabel}</span>
                  <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-300" />
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
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Неделя
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      viewMode === 'month'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Месяц
                  </button>
                </div>
              </div>

              {viewMode === 'day' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Дата:</span>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {viewMode === 'week' && (
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedWeekStart((prev) => addDays(prev, -7))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <ChevronLeft className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(selectedWeekStart, 'd MMM', { locale: ru })} – {format(addDays(selectedWeekStart, 6), 'd MMM yyyy', { locale: ru })}
                  </span>
                  <button onClick={() => setSelectedWeekStart((prev) => addDays(prev, 7))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" />
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
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

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Дата</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Сотрудник</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Смена</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredShifts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            Нет смен
                          </td>
                        </tr>
                      ) : (
                        filteredShifts.map((shift) => {
                          const editable = canEditShift(shift.work_date);
                          return (
                            <tr key={shift.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{format(parseISO(shift.work_date), 'dd.MM.yyyy')}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{shift.employees?.full_name || '—'}</td>
                              <td className="px-4 py-3 text-sm">
                                {shift.is_full_day ? (
                                  <span className="text-gray-700 dark:text-gray-300">Полный день</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-md text-xs font-medium">
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
                                      className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
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
                                        ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
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
                                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                                        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
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
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Комментарий</h3>
                  <button onClick={() => setViewingComment(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewingComment}</p>
                <button
                  onClick={() => setViewingComment(null)}
                  className="mt-4 w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}

          {/* Модальное окно добавления/редактирования смены */}
          {showAddShiftModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
                <form onSubmit={handleSaveShift} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingShiftId ? 'Редактировать' : 'Новая смена'}</h3>
                    <button type="button" onClick={resetShiftForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {formError && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Сотрудник <span className="text-red-500">*</span>
                    </label>
                    {editingShiftId ? (
                      <input
                        type="text"
                        value={addEmployeeSearch}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                      />
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Начните вводить ФИО..."
                          value={addEmployeeSearch}
                          onChange={(e) => setAddEmployeeSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        {addEmployeeResults.length > 0 && (
                          <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {addEmployeeResults.map((emp) => (
                              <li
                                key={emp.id}
                                onClick={() => {
                                  setSelectedEmployeeId(emp.id);
                                  setAddEmployeeSearch(emp.full_name);
                                  setAddEmployeeResults([]);
                                }}
                                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-900 dark:text-white"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Дата <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    <label htmlFor="isFullDay" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Полный день
                    </label>
                  </div>

                  {!isFullDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Начало</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Конец</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комментарий</label>
                    <textarea
                      value={shiftComment}
                      onChange={(e) => setShiftComment(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                      placeholder="Необязательно"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={resetShiftForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
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
            <div className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Календарь */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Выбор даты
                  </h3>

                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => handleManualMonthChange('prev')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <span className="font-medium text-lg capitalize text-gray-900 dark:text-white">{format(manualMonth, 'LLLL yyyy', { locale: ru })}</span>
                    <button onClick={() => handleManualMonthChange('next')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                      <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: (getDay(startOfMonth(manualMonth)) + 6) % 7 }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-10" />
                    ))}

                    {monthDays.map((day) => {
                      const isWeekendDay = isWeekend(day);
                      const isSelected = manualSelectedDay && isSameDay(day, manualSelectedDay);
                      const hasSchedule = dayHasSchedule(day);

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => handleDaySelect(day)}
                          className={`h-10 rounded-lg flex items-center justify-center relative transition text-sm font-medium ${
                            isWeekendDay
                              ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          } ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
                        >
                          <span>{format(day, 'd')}</span>
                          {hasSchedule && <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-green-500 dark:text-green-400 bg-white dark:bg-gray-800 rounded-full" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" /> — график составлен
                  </div>
                </div>

                {/* Составление */}
                <div className="lg:col-span-2">
                  {!manualSelectedDay ? (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
                      <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50 text-gray-400" />
                      <p className="text-gray-400 dark:text-gray-500">Выберите день</p>
                    </div>
                  ) : manualDayDataLoading ? (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 flex justify-center">
                      <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 h-8 w-8" />
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">График на {format(manualSelectedDay, 'd MMMM yyyy', { locale: ru })}</h3>
                        <button
                          onClick={handleSaveManualSchedule}
                          disabled={manualSaving}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition"
                        >
                          {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Сохранить
                        </button>
                      </div>

                      {manualError && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          <span>{manualError}</span>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                          <Gamepad2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Работающие аттракционы
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {attractions.map((attr) => (
                            <label key={attr.id} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={manualWorkingAttractions.has(attr.id)}
                                onChange={() => toggleAttractionWorking(attr.id)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-900 dark:text-white">{attr.name}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">x{attr.coefficient}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          Доступные сотрудники ({manualEmployeesForDay.length})
                        </h4>
                        {manualEmployeesForDay.length === 0 ? (
                          <p className="text-gray-400 dark:text-gray-500 text-sm">Нет сотрудников с доступностью на эту дату</p>
                        ) : (
                          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-600">
                            {manualEmployeesForDay.map((emp) => (
                              <div key={emp.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="font-medium text-gray-900 dark:text-white">{emp.full_name}</span>
                                    {emp.studyGoal && (
                                      <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">Цель: {emp.studyGoal}</span>
                                    )}
                                    {!emp.availability.isFullDay && (
                                      <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                                        {emp.availability.startTime?.slice(0, 5)}-{emp.availability.endTime?.slice(0, 5)}
                                      </span>
                                    )}
                                  </div>
                                  {emp.availability.comment && (
                                    <button onClick={() => alert(emp.availability.comment)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Комментарий">
                                      <MessageSquare className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-white">Назначения</h4>
                        {Array.from(manualWorkingAttractions).map((attrId) => {
                          const attr = attractions.find((a) => a.id === attrId);
                          if (!attr) return null;

                          const assignedIds = manualAttractionAssignments.get(attrId) || [];
                          const assignedEmployees = manualEmployeesForDay.filter((e) => assignedIds.includes(e.id));

                          return (
                            <div key={attrId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900 dark:text-white">{attr.name}</h5>
                                <button
                                  onClick={() => setManualShowAddModal({ attractionId: attrId, attractionName: attr.name })}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center gap-1"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                  Добавить
                                </button>
                              </div>

                              {assignedEmployees.length === 0 ? (
                                <p className="text-gray-400 dark:text-gray-500 text-sm py-2">Нет назначений</p>
                              ) : (
                                <div className="space-y-1">
                                  {assignedEmployees.map((emp) => (
                                    <div key={emp.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                      <span className="text-sm text-gray-900 dark:text-white">{emp.full_name}</span>
                                      <button onClick={() => removeEmployeeFromAttraction(attrId, emp.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                                        <MinusCircle className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Модальное окно добавления */}
              {manualShowAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Добавить на «{manualShowAddModal.attractionName}»</h3>
                      <button onClick={() => setManualShowAddModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1">
                      {(() => {
                        const available = getAvailableEmployeesForAttraction(manualShowAddModal.attractionId);
                        const allEmpty = !available.priority1.length && !available.priority2.length && !available.priority3.length && !available.goals.length;

                        if (allEmpty) {
                          return <p className="text-gray-500 dark:text-gray-400 text-center py-8">Нет доступных сотрудников</p>;
                        }

                        return (
                          <div className="space-y-4">
                            {available.priority1.length > 0 && (
                              <div>
                                <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">Приоритет 1</h4>
                                <div className="space-y-1">
                                  {available.priority1.map((emp) => (
                                    <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={manualEmployeeSelection.has(emp.id)}
                                        onChange={(e) => {
                                          const newSet = new Set(manualEmployeeSelection);
                                          e.target.checked ? newSet.add(emp.id) : newSet.delete(emp.id);
                                          setManualEmployeeSelection(newSet);
                                        }}
                                        className="rounded text-blue-600"
                                      />
                                      <span className="text-gray-900 dark:text-white">{emp.full_name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {available.priority2.length > 0 && (
                              <div>
                                <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">Приоритет 2</h4>
                                <div className="space-y-1">
                                  {available.priority2.map((emp) => (
                                    <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={manualEmployeeSelection.has(emp.id)}
                                        onChange={(e) => {
                                          const newSet = new Set(manualEmployeeSelection);
                                          e.target.checked ? newSet.add(emp.id) : newSet.delete(emp.id);
                                          setManualEmployeeSelection(newSet);
                                        }}
                                        className="rounded text-blue-600"
                                      />
                                      <span className="text-gray-900 dark:text-white">{emp.full_name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {available.priority3.length > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-700 dark:text-gray-400 mb-2">Приоритет 3</h4>
                                <div className="space-y-1">
                                  {available.priority3.map((emp) => (
                                    <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={manualEmployeeSelection.has(emp.id)}
                                        onChange={(e) => {
                                          const newSet = new Set(manualEmployeeSelection);
                                          e.target.checked ? newSet.add(emp.id) : newSet.delete(emp.id);
                                          setManualEmployeeSelection(newSet);
                                        }}
                                        className="rounded text-blue-600"
                                      />
                                      <span className="text-gray-900 dark:text-white">{emp.full_name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {available.goals.length > 0 && (
                              <div>
                                <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-2">Цель обучения</h4>
                                <div className="space-y-1">
                                  {available.goals.map((emp) => (
                                    <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={manualEmployeeSelection.has(emp.id)}
                                        onChange={(e) => {
                                          const newSet = new Set(manualEmployeeSelection);
                                          e.target.checked ? newSet.add(emp.id) : newSet.delete(emp.id);
                                          setManualEmployeeSelection(newSet);
                                        }}
                                        className="rounded text-blue-600"
                                      />
                                      <span className="text-gray-900 dark:text-white">{emp.full_name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
                      <button onClick={() => setManualShowAddModal(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
                        Отмена
                      </button>
                      <button
                        onClick={() => {
                          const selectedIds = Array.from(manualEmployeeSelection);
                          if (selectedIds.length > 0) {
                            handleAddEmployeesToAttraction(manualShowAddModal.attractionId, selectedIds);
                          }
                        }}
                        disabled={manualEmployeeSelection.size === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Добавить ({manualEmployeeSelection.size})
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* ВКЛАДКА: График смен */}
          {/* ========================================== */}
          {activeTab === 'scheduleView' && (
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => setScheduleViewMonth(subMonths(scheduleViewMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <h3 className="text-xl font-semibold capitalize text-gray-900 dark:text-white">{format(scheduleViewMonth, 'LLLL yyyy', { locale: ru })}</h3>
                  <button onClick={() => setScheduleViewMonth(addMonths(scheduleViewMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>

                <button
                  onClick={handleExportScheduleImage}
                  disabled={exportingImage}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {exportingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Сохранить как PNG
                </button>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск сотрудника..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div ref={scheduleViewRef} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase border-r border-gray-200 dark:border-gray-600">
                          Сотрудник
                        </th>
                        {scheduleViewDays.map((day) => (
                          <th
                            key={day.toISOString()}
                            className={`px-2 py-3 text-center text-xs font-semibold uppercase border-r border-gray-200 dark:border-gray-600 ${
                              isWeekend(day) ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <div>{format(day, 'd')}</div>
                            <div className="text-[10px] font-normal">{format(day, 'EEE', { locale: ru })}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredEmployeesForScheduleView.map((emp) => (
                        <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600 whitespace-nowrap">
                            {emp.full_name}
                          </td>
                          {scheduleViewDays.map((day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const assignments = scheduleViewData.filter((a) => a.work_date === dateStr && a.employee_id === emp.id);

                            return (
                              <td
                                key={day.toISOString()}
                                className={`px-2 py-2 text-xs text-center border-r border-gray-200 dark:border-gray-600 ${
                                  isWeekend(day) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                                }`}
                              >
                                {assignments.length > 0 ? (
                                  <div className="space-y-1">
                                    {assignments.map((a) => (
                                      <div key={a.id} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 py-0.5 rounded text-[10px] truncate">
                                        {a.attractions?.name || '—'}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
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
            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Сотрудники</h3>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">ФИО</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Возраст</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Телефон</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Соцсети</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Последний вход</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                      {employees
                        .filter((emp) => {
                          if (!employeeSearch.trim()) return true;
                          return emp.full_name?.toLowerCase().includes(employeeSearch.toLowerCase());
                        })
                        .map((emp) => (
                          <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{emp.full_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{emp.age || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{emp.phone_number || '—'}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-3">
                                {emp.telegram && (
                                  <a href={emp.telegram.startsWith('http') ? emp.telegram : `https://t.me/${emp.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" title="Telegram">
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.57-1.37-.93-2.22-1.49-.98-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.22-.02-.09.02-1.52.96-4.29 2.84-.41.28-.78.42-1.11.41-.37-.01-1.07-.21-1.59-.38-.64-.21-1.15-.32-1.1-.67.02-.18.27-.37.74-.56 2.88-1.25 4.8-2.08 5.76-2.48 2.74-1.14 3.31-1.34 3.68-1.34.08 0 .26.02.38.12.1.08.13.19.14.27.01.08.02.17 0 .24z" />
                                    </svg>
                                  </a>
                                )}
                                {emp.vk && (
                                  <a href={emp.vk.startsWith('http') ? emp.vk : `https://vk.com/${emp.vk}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="ВКонтакте">
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M21.579 6.855c.14-.465 0-.806-.662-.806h-2.193c-.558 0-.813.295-.953.62 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.558.258-.558.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.743 0-2.551-2.729-3.624-5.853-.209-.607-.42-.853-.98-.853H2.752c-.627 0-.752.295-.752.62 0 .582.743 3.462 3.462 7.271 1.812 2.601 4.363 4.011 6.687 4.011 1.393 0 1.565-.313 1.565-.852v-1.966c0-.626.133-.752.574-.752.324 0 .882.164 2.183 1.417 1.486 1.486 1.732 2.153 2.567 2.153h2.192c.626 0 .939-.313.759-.931-.197-.615-.907-1.51-1.849-2.569-.512-.604-1.277-1.254-1.51-1.579-.325-.419-.232-.604 0-.976.001.001 2.672-3.761 2.95-5.04z" />
                                    </svg>
                                  </a>
                                )}
                                {emp.max && (
                                  <a href={emp.max.startsWith('http') ? emp.max : `https://max.ru/${emp.max}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800" title="Max">
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                      <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor" fontWeight="bold">
                                        M
                                      </text>
                                    </svg>
                                  </a>
                                )}
                                {!emp.telegram && !emp.vk && !emp.max && <span className="text-gray-400 text-xs">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{emp.last_login ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm') : '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
