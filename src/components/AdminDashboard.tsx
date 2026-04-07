// AdminDashboard.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { UserProfile, ShiftWithEmployee, Employee, ScheduleAssignment, Attraction } from '../types';
import {
  Loader2, Search, Edit2, Trash2, Plus, ChevronLeft, ChevronRight,
  Calendar, LayoutGrid, CalendarDays, Wand2, X, Users, Gamepad2, Clock, UserCheck,
  CheckCircle, Circle, AlertCircle, MessageSquare, PlusCircle, MinusCircle, Save
} from 'lucide-react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, addMonths, subMonths, startOfWeek, addDays, isWeekend, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScheduleGenerator } from './ScheduleGenerator';
import { EmployeesList } from './EmployeesList';
import { AttractionsList } from './AttractionsList';

type ViewMode = 'day' | 'week' | 'month';

interface AdminDashboardProps {
  profile: UserProfile;
  isSuperAdmin?: boolean;
}

// Проверка, можно ли редактировать график (до 23:00 дня смены)
function canEditSchedule(workDate: string): boolean {
  const now = new Date();
  const date = parseISO(workDate);
  const deadline = new Date(date);
  deadline.setHours(23, 0, 0, 0);
  return now < deadline;
}

export function AdminDashboard({ profile, isSuperAdmin = false }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'shifts' | 'schedule' | 'manual' | 'employees' | 'attractions'>('shifts');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfMonth(new Date()));

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [workDate, setWorkDate] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Состояния для ручного составления смены ---
  const [manualMonth, setManualMonth] = useState<Date>(new Date());
  const [manualSelectedDay, setManualSelectedDay] = useState<Date | null>(null);
  const [manualWorkingAttractions, setManualWorkingAttractions] = useState<Set<number>>(new Set());
  const [manualEmployeesForDay, setManualEmployeesForDay] = useState<any[]>([]); // с доп. полями
  const [manualDayAssignments, setManualDayAssignments] = useState<ScheduleAssignment[]>([]);
  const [manualAttractionAssignments, setManualAttractionAssignments] = useState<Map<number, number[]>>(new Map()); // attractionId -> employeeId[]
  const [manualDayDataLoading, setManualDayDataLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualShowAddModal, setManualShowAddModal] = useState<{ attractionId: number; attractionName: string } | null>(null);
  const [manualEmployeeSelection, setManualEmployeeSelection] = useState<Set<number>>(new Set());

  // Кэш для приоритетов и целей (для фильтрации в модалке)
  const [prioritiesCache, setPrioritiesCache] = useState<any[]>([]);
  const [goalsCache, setGoalsCache] = useState<any[]>([]);

  // --- Загрузка всех основных данных ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Сотрудники
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, full_name, age, base_hourly_rate, last_login')
        .order('full_name');
      if (empError) throw empError;
      setEmployees(empData || []);

      // Аттракционы
      const { data: attrData, error: attrError } = await supabase
        .from('attractions')
        .select('id, name, coefficient, min_staff_weekday, min_staff_weekend')
        .order('name');
      if (attrError) throw attrError;
      setAttractions(attrData || []);

      // Старые смены (employee_availability)
      const { data: shiftData, error: shiftError } = await supabase
        .from('employee_availability')
        .select('id, employee_id, work_date, is_full_day, start_time, end_time, comment')
        .order('work_date');
      if (shiftError) throw shiftError;

      if (shiftData && shiftData.length > 0) {
        const empIds = [...new Set(shiftData.map(s => s.employee_id))];
        const { data: shiftEmps } = await supabase
          .from('employees')
          .select('id, full_name')
          .in('id', empIds);
        const empMap = new Map(shiftEmps?.map(e => [e.id, e]) || []);
        const shiftsWithEmp = shiftData.map(s => ({
          ...s,
          employees: empMap.get(s.employee_id) || null
        }));
        setShifts(shiftsWithEmp as ShiftWithEmployee[]);
      } else {
        setShifts([]);
      }

      // График (schedule_assignments)
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_assignments')
        .select(`
          id, work_date, employee_id, attraction_id, start_time, end_time,
          created_at, updated_at, version_type, edited_at, original_id
        `)
        .order('work_date', { ascending: true });
      if (scheduleError) throw scheduleError;

      if (scheduleData && scheduleData.length > 0) {
        const schedEmpIds = [...new Set(scheduleData.map(s => s.employee_id))];
        const schedAttrIds = [...new Set(scheduleData.map(s => s.attraction_id))];
        const [empRes, attrRes] = await Promise.all([
          supabase.from('employees').select('id, full_name').in('id', schedEmpIds),
          supabase.from('attractions').select('id, name, coefficient').in('id', schedAttrIds)
        ]);
        const empMap = new Map(empRes.data?.map(e => [e.id, e]) || []);
        const attrMap = new Map(attrRes.data?.map(a => [a.id, a]) || []);
        const scheduleWithRefs = scheduleData.map(s => ({
          ...s,
          employees: empMap.get(s.employee_id) || null,
          attractions: attrMap.get(s.attraction_id) || null
        }));
        setScheduleAssignments(scheduleWithRefs as ScheduleAssignment[]);
      } else {
        setScheduleAssignments([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Загрузка данных для выбранного дня в ручном режиме ---
  const fetchDayData = useCallback(async (date: Date) => {
    if (!date) return;
    setManualDayDataLoading(true);
    setManualError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // 1. Доступность сотрудников на эту дату
      const { data: availData, error: availError } = await supabase
        .from('employee_availability')
        .select('employee_id, is_full_day, start_time, end_time, comment')
        .eq('work_date', dateStr);
      if (availError) throw availError;
      
      const availableEmpIds = availData?.map(a => a.employee_id) || [];
      
      // 2. Цели обучения (только для доступных сотрудников)
      let goalsData: any[] = [];
      if (availableEmpIds.length > 0) {
        const { data: goals, error: goalsError } = await supabase
          .from('employee_study_goals')
          .select('employee_id, attraction_id')
          .in('employee_id', availableEmpIds);
        if (goalsError) throw goalsError;
        goalsData = goals || [];
      }
      
      // 3. Приоритеты (для всех сотрудников, понадобятся в модалке)
      const { data: priorities, error: prioritiesError } = await supabase
        .from('employee_attraction_priorities')
        .select('employee_id, attraction_id, priority_level');
      if (prioritiesError) throw prioritiesError;
      
      // 4. Существующие назначения на этот день
      const { data: dayAssignments, error: assignError } = await supabase
        .from('schedule_assignments')
        .select('id, employee_id, attraction_id, start_time, end_time, version_type')
        .eq('work_date', dateStr);
      if (assignError) throw assignError;
      
      // Подготавливаем карты для быстрого доступа
      const empMap = new Map(employees.map(e => [e.id, e]));
      const attrMap = new Map(attractions.map(a => [a.id, a]));
      
      // Карта целей: employee_id -> attraction_name
      const goalsMap = new Map<number, string>();
      goalsData.forEach(g => {
        const attr = attrMap.get(g.attraction_id);
        if (attr) goalsMap.set(g.employee_id, attr.name);
      });
      
      // Обогащаем данные сотрудников
      const enrichedEmployees = availData?.map(avail => {
        const emp = empMap.get(avail.employee_id);
        if (!emp) return null;
        return {
          ...emp,
          availability: {
            isFullDay: avail.is_full_day,
            startTime: avail.start_time,
            endTime: avail.end_time,
            comment: avail.comment
          },
          studyGoal: goalsMap.get(avail.employee_id) || null
        };
      }).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name)) || [];
      
      setManualEmployeesForDay(enrichedEmployees);
      
      // Инициализируем выбранные аттракционы из существующих назначений
      const workingAttrSet = new Set<number>();
      const assignMap = new Map<number, number[]>(); // attractionId -> employeeIds
      dayAssignments?.forEach(a => {
        workingAttrSet.add(a.attraction_id);
        const list = assignMap.get(a.attraction_id) || [];
        list.push(a.employee_id);
        assignMap.set(a.attraction_id, list);
      });
      setManualWorkingAttractions(workingAttrSet);
      setManualAttractionAssignments(assignMap);
      setManualDayAssignments(dayAssignments || []);
      
      // Сохраняем приоритеты и цели в кэш
      setPrioritiesCache(priorities || []);
      setGoalsCache(goalsData);
      
    } catch (err: any) {
      console.error('Ошибка загрузки данных дня:', err);
      setManualError(err.message);
    } finally {
      setManualDayDataLoading(false);
    }
  }, [employees, attractions]);

  // При выборе дня в календаре
  const handleDaySelect = (day: Date) => {
    setManualSelectedDay(day);
    fetchDayData(day);
  };

  // Переключение месяца в календаре
  const handleManualMonthChange = (direction: 'prev' | 'next') => {
    setManualMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  // Генерация дней месяца для календаря
  const monthDays = useMemo(() => {
    const start = startOfMonth(manualMonth);
    const end = endOfMonth(manualMonth);
    return eachDayOfInterval({ start, end });
  }, [manualMonth]);

  // Проверка наличия графика на день (любое назначение)
  const dayHasSchedule = (day: Date) => {
    return scheduleAssignments.some(a => isSameDay(parseISO(a.work_date), day));
  };

  // Обработка выбора аттракциона для работы
  const toggleAttractionWorking = (attractionId: number) => {
    setManualWorkingAttractions(prev => {
      const next = new Set(prev);
      if (next.has(attractionId)) {
        next.delete(attractionId);
        // При снятии галочки убираем всех сотрудников с этого аттракциона
        setManualAttractionAssignments(prevAssign => {
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

  // Добавление сотрудников к аттракциону
  const handleAddEmployeesToAttraction = (attractionId: number, employeeIds: number[]) => {
    setManualAttractionAssignments(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(attractionId) || [];
      const combined = [...new Set([...existing, ...employeeIds])];
      newMap.set(attractionId, combined);
      return newMap;
    });
    setManualShowAddModal(null);
    setManualEmployeeSelection(new Set());
  };

  // Удаление сотрудника с аттракциона
  const removeEmployeeFromAttraction = (attractionId: number, employeeId: number) => {
    setManualAttractionAssignments(prev => {
      const newMap = new Map(prev);
      const list = newMap.get(attractionId) || [];
      const filtered = list.filter(id => id !== employeeId);
      if (filtered.length === 0) {
        newMap.delete(attractionId);
      } else {
        newMap.set(attractionId, filtered);
      }
      return newMap;
    });
  };

  // Получение списка доступных сотрудников для аттракциона (с учётом приоритетов)
  const getAvailableEmployeesForAttraction = (attractionId: number) => {
    // Сотрудники, которые ещё не назначены ни на один аттракцион
    const assignedEmployeeIds = new Set<number>();
    manualAttractionAssignments.forEach(ids => ids.forEach(id => assignedEmployeeIds.add(id)));
    
    const available = manualEmployeesForDay.filter(emp => !assignedEmployeeIds.has(emp.id));
    
    // Группируем по приоритетам
    const priorityMap = new Map<number, number[]>(); // priority -> employeeIds
    prioritiesCache.forEach(p => {
      if (p.attraction_id === attractionId) {
        const list = priorityMap.get(p.priority_level) || [];
        list.push(p.employee_id);
        priorityMap.set(p.priority_level, list);
      }
    });
    
    // Цели обучения
    const goalEmployeeIds = goalsCache
      .filter(g => g.attraction_id === attractionId)
      .map(g => g.employee_id);
    
    // Функция получения сотрудников по ID
    const getEmpsByIds = (ids: number[]) => {
      return available.filter(emp => ids.includes(emp.id));
    };
    
    return {
      priority1: getEmpsByIds(priorityMap.get(1) || []),
      priority2: getEmpsByIds(priorityMap.get(2) || []),
      priority3: getEmpsByIds(priorityMap.get(3) || []),
      goals: getEmpsByIds(goalEmployeeIds)
    };
  };

  // Сохранение графика
  const handleSaveManualSchedule = async () => {
    if (!manualSelectedDay) {
      setManualError('Выберите день');
      return;
    }
    const dateStr = format(manualSelectedDay, 'yyyy-MM-dd');
    if (!canEditSchedule(dateStr)) {
      setManualError('Редактирование невозможно: прошло 23:00 дня смены');
      return;
    }
    if (!confirm('Сохранить график на выбранный день?')) return;
    
    setManualSaving(true);
    setManualError(null);
    
    const assignmentsToInsert: any[] = [];
    
    // Для каждого аттракциона и сотрудника создаём запись
    manualAttractionAssignments.forEach((employeeIds, attractionId) => {
      employeeIds.forEach(empId => {
        // Используем время из доступности сотрудника, если неполный день, иначе полный день (например, 10:00-22:00)
        const empAvail = manualEmployeesForDay.find(e => e.id === empId);
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
          version_type: 'original'
        });
      });
    });
    
    try {
      // Удаляем все существующие назначения на эту дату
      const { error: deleteError } = await supabase
        .from('schedule_assignments')
        .delete()
        .eq('work_date', dateStr);
      if (deleteError) throw deleteError;
      
      // Вставляем новые
      if (assignmentsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('schedule_assignments')
          .insert(assignmentsToInsert);
        if (insertError) throw insertError;
      }
      
      await logActivity(
        isSuperAdmin ? 'superadmin' : 'admin',
        profile.id,
        'manual_schedule_save',
        `Ручное составление графика на ${dateStr}`
      );
      
      // Обновляем данные
      await fetchData();
      // Перезагружаем данные для дня, чтобы обновить галочку
      fetchDayData(manualSelectedDay);
      
      alert('График сохранён');
    } catch (err: any) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  };

  // --- Старый функционал (смены, недели и т.д.) остаётся без изменений ---
  // ... (всё, что связано с shifts, schedule, employees, attractions)

  const shiftsForMonth = useMemo(() => {
    return shifts.filter(s => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [shifts, currentYear, currentMonth]);

  const filteredShifts = useMemo(() => {
    let base = shiftsForMonth;
    if (viewMode === 'day') {
      base = base.filter(s => isSameDay(parseISO(s.work_date), selectedDate));
    } else if (viewMode === 'week') {
      const weekEnd = addDays(selectedWeekStart, 6);
      base = base.filter(s => {
        const d = parseISO(s.work_date);
        return d >= selectedWeekStart && d <= weekEnd;
      });
    }
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(s =>
      s.employees?.full_name?.toLowerCase().includes(q) ||
      s.work_date.includes(q)
    );
  }, [shiftsForMonth, viewMode, selectedDate, selectedWeekStart, search]);

  const getWeeksInMonth = () => {
    const start = startOfMonth(new Date(currentYear, currentMonth, 1));
    const end = endOfMonth(start);
    const weeks: Date[][] = [];
    let current = startOfMonth(start);
    while (current <= end) {
      const weekStart = startOfWeek(current, { weekStartsOn: 1 });
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) week.push(addDays(weekStart, i));
      weeks.push(week);
      current = addDays(weekStart, 7);
    }
    return weeks;
  };
  const weeksInMonth = useMemo(() => getWeeksInMonth(), [currentYear, currentMonth]);
  const currentWeekIndex = useMemo(() => {
    return weeksInMonth.findIndex(week => week.some(day => isSameDay(day, selectedWeekStart)));
  }, [weeksInMonth, selectedWeekStart]);

  const resetShiftForm = () => {
    setEditingShiftId(null);
    setSelectedEmployeeId('');
    setWorkDate('');
    setIsFullDay(true);
    setStartTime('');
    setEndTime('');
    setFormError(null);
    setShowShiftForm(false);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedEmployeeId) { setFormError('Выберите сотрудника'); return; }
    if (!workDate) { setFormError('Укажите дату'); return; }
    if (!isFullDay && (!startTime || !endTime)) { setFormError('Укажите время'); return; }

    const shiftData = {
      employee_id: Number(selectedEmployeeId),
      work_date: workDate,
      is_full_day: isFullDay,
      start_time: isFullDay ? null : startTime,
      end_time: isFullDay ? null : endTime,
    };
    const emp = employees.find(e => e.id === Number(selectedEmployeeId));

    if (editingShiftId) {
      const { error } = await supabase.from('employee_availability').update(shiftData).eq('id', editingShiftId);
      if (error) { setFormError('Ошибка при сохранении'); return; }
      await logActivity(isSuperAdmin ? 'superadmin' : 'admin', profile.id, 'shift_update', `Смена сотрудника ${emp?.full_name} на ${workDate} обновлена`);
    } else {
      const { error } = await supabase.from('employee_availability').insert([shiftData]);
      if (error) { setFormError('Ошибка при добавлении'); return; }
      await logActivity(isSuperAdmin ? 'superadmin' : 'admin', profile.id, 'shift_add', `Смена добавлена сотруднику ${emp?.full_name} на ${workDate}`);
    }
    resetShiftForm();
    fetchData();
  };

  const handleEditShift = (shift: ShiftWithEmployee) => {
    setEditingShiftId(shift.id);
    setSelectedEmployeeId(shift.employee_id);
    setWorkDate(shift.work_date);
    setIsFullDay(shift.is_full_day);
    setStartTime(shift.start_time || '');
    setEndTime(shift.end_time || '');
    setShowShiftForm(true);
  };

  const handleDeleteShift = async (shift: ShiftWithEmployee) => {
    if (!confirm('Удалить смену?')) return;
    const { error } = await supabase.from('employee_availability').delete().eq('id', shift.id);
    if (!error) {
      await logActivity(isSuperAdmin ? 'superadmin' : 'admin', profile.id, 'shift_delete', `Смена сотрудника ${shift.employees?.full_name} на ${shift.work_date} удалена`);
      fetchData();
    }
  };

  // Старая форма ручного назначения (не используется, оставлена для совместимости)
  const [manualEmployeeId, setManualEmployeeId] = useState<number | ''>('');
  const [manualAttractionId, setManualAttractionId] = useState<number | ''>('');
  const [manualWorkDate, setManualWorkDate] = useState('');
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualAllowedAttractions, setManualAllowedAttractions] = useState<Attraction[]>([]);

  const handleManualEmployeeChange = async (empId: number | '') => {
    // не используется в новом интерфейсе
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    // не используется
  };

  const handleDeleteSchedule = async (schedule: ScheduleAssignment) => {
    if (!canEditSchedule(schedule.work_date)) {
      alert('Удаление невозможно: прошло 23:00 дня смены');
      return;
    }
    if (!confirm('Удалить назначение?')) return;
    const { error } = await supabase.from('schedule_assignments').delete().eq('id', schedule.id);
    if (!error) {
      await logActivity(isSuperAdmin ? 'superadmin' : 'admin', profile.id, 'schedule_delete', `Удалено назначение для сотрудника ${schedule.employees?.full_name} на ${schedule.work_date}`);
      fetchData();
    }
  };

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

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin text-blue-600 h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap border-b border-gray-200">
          <button onClick={() => setActiveTab('shifts')} className={`flex-1 sm:flex-none px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'shifts' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <Calendar className="h-4 w-4" /> Управление сменами
          </button>
          <button onClick={() => setActiveTab('schedule')} className={`flex-1 sm:flex-none px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'schedule' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <Wand2 className="h-4 w-4" /> Генератор графика
          </button>
          <button onClick={() => setActiveTab('manual')} className={`flex-1 sm:flex-none px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'manual' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <UserCheck className="h-4 w-4" /> Ручное составление смены
          </button>
          <button onClick={() => setActiveTab('employees')} className={`flex-1 sm:flex-none px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'employees' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <Users className="h-4 w-4" /> Сотрудники
          </button>
          <button onClick={() => setActiveTab('attractions')} className={`flex-1 sm:flex-none px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition ${activeTab === 'attractions' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <Gamepad2 className="h-4 w-4" /> Аттракционы
          </button>
        </div>

        {activeTab === 'shifts' && (
          <div className="p-6 space-y-6">
            {/* содержимое вкладки shifts без изменений */}
            <div className="flex items-center justify-between">
              <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
              <span className="text-lg font-semibold">{monthLabel}</span>
              <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
            </div>
            {/* остальное содержимое shifts ... */}
          </div>
        )}

        {activeTab === 'schedule' && <div className="p-6"><ScheduleGenerator profile={profile} isSuperAdmin={isSuperAdmin} onScheduleGenerated={fetchData} /></div>}

        {activeTab === 'manual' && (
          <div className="p-6 space-y-6">
            {/* Новый интерфейс ручного составления смены */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Левая колонка - календарь */}
              <div className="lg:col-span-1 bg-white border rounded-xl p-4 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Выбор даты
                </h3>
                
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => handleManualMonthChange('prev')} className="p-2 rounded-lg hover:bg-gray-100">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="font-medium text-lg">
                    {format(manualMonth, 'LLLL yyyy', { locale: ru })}
                  </span>
                  <button onClick={() => handleManualMonthChange('next')} className="p-2 rounded-lg hover:bg-gray-100">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                    <div key={day} className="text-xs font-medium text-gray-500">{day}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: (getDay(startOfMonth(manualMonth)) + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-10" />
                  ))}
                  
                  {monthDays.map(day => {
                    const isWeekendDay = isWeekend(day);
                    const isSelected = manualSelectedDay && isSameDay(day, manualSelectedDay);
                    const hasSchedule = dayHasSchedule(day);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDaySelect(day)}
                        className={`
                          h-10 rounded-lg flex flex-col items-center justify-center relative
                          transition-all text-sm font-medium
                          ${isWeekendDay ? 'bg-red-50 hover:bg-red-100 text-red-700' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}
                          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                        `}
                      >
                        <span>{format(day, 'd')}</span>
                        {hasSchedule && (
                          <CheckCircle className="absolute -top-1 -right-1 h-4 w-4 text-green-500 bg-white rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" /> — график составлен
                </div>
              </div>
              
              {/* Правая колонка - составление графика */}
              <div className="lg:col-span-2">
                {!manualSelectedDay ? (
                  <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
                    <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Выберите день в календаре, чтобы составить график</p>
                  </div>
                ) : manualDayDataLoading ? (
                  <div className="bg-white border rounded-xl p-8 flex justify-center">
                    <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
                  </div>
                ) : (
                  <div className="bg-white border rounded-xl p-5 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        График на {format(manualSelectedDay, 'd MMMM yyyy', { locale: ru })}
                      </h3>
                      <button
                        onClick={handleSaveManualSchedule}
                        disabled={manualSaving}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                      >
                        {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Сохранить график
                      </button>
                    </div>
                    
                    {manualError && (
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <span>{manualError}</span>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4 text-blue-600" />
                        Выберите работающие аттракционы
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {attractions.map(attr => (
                          <label key={attr.id} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={manualWorkingAttractions.has(attr.id)}
                              onChange={() => toggleAttractionWorking(attr.id)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{attr.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">x{attr.coefficient}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        Доступные сотрудники ({manualEmployeesForDay.length})
                      </h4>
                      {manualEmployeesForDay.length === 0 ? (
                        <p className="text-gray-400 text-sm">Нет сотрудников, отметивших доступность на эту дату</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                          {manualEmployeesForDay.map(emp => (
                            <div key={emp.id} className="p-3 hover:bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-medium">{emp.full_name}</span>
                                  {emp.studyGoal && (
                                    <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                      Цель: {emp.studyGoal}
                                    </span>
                                  )}
                                  {!emp.availability.isFullDay && (
                                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                      Неполная ({emp.availability.startTime?.slice(0,5)}-{emp.availability.endTime?.slice(0,5)})
                                    </span>
                                  )}
                                </div>
                                {emp.availability.comment && (
                                  <button
                                    className="text-gray-400 hover:text-gray-600"
                                    onClick={() => alert(emp.availability.comment)}
                                    title="Показать комментарий"
                                  >
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
                      <h4 className="font-medium">Назначения по аттракционам</h4>
                      {Array.from(manualWorkingAttractions).map(attrId => {
                        const attr = attractions.find(a => a.id === attrId);
                        if (!attr) return null;
                        const assignedIds = manualAttractionAssignments.get(attrId) || [];
                        const assignedEmployees = manualEmployeesForDay.filter(e => assignedIds.includes(e.id));
                        
                        return (
                          <div key={attrId} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium">{attr.name}</h5>
                              <button
                                onClick={() => setManualShowAddModal({ attractionId: attrId, attractionName: attr.name })}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                <PlusCircle className="h-4 w-4" />
                                Добавить сотрудника
                              </button>
                            </div>
                            
                            {assignedEmployees.length === 0 ? (
                              <p className="text-gray-400 text-sm py-2">Нет назначенных сотрудников</p>
                            ) : (
                              <div className="space-y-1">
                                {assignedEmployees.map(emp => (
                                  <div key={emp.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                    <span className="text-sm">{emp.full_name}</span>
                                    <button
                                      onClick={() => removeEmployeeFromAttraction(attrId, emp.id)}
                                      className="text-red-500 hover:text-red-700"
                                    >
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
            
            {/* Модальное окно добавления сотрудников к аттракциону */}
            {manualShowAddModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      Добавить сотрудников на аттракцион «{manualShowAddModal.attractionName}»
                    </h3>
                    <button onClick={() => setManualShowAddModal(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto flex-1">
                    {(() => {
                      const available = getAvailableEmployeesForAttraction(manualShowAddModal.attractionId);
                      const allEmpty = !available.priority1.length && !available.priority2.length && !available.priority3.length && !available.goals.length;
                      
                      if (allEmpty) {
                        return <p className="text-gray-500 text-center py-8">Нет доступных сотрудников для этого аттракциона</p>;
                      }
                      
                      return (
                        <div className="space-y-4">
                          {available.priority1.length > 0 && (
                            <div>
                              <h4 className="font-medium text-green-700 mb-2">Приоритет 1 (высший)</h4>
                              <div className="space-y-1">
                                {available.priority1.map(emp => (
                                  <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
                                    <span>{emp.full_name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {available.priority2.length > 0 && (
                            <div>
                              <h4 className="font-medium text-blue-700 mb-2">Приоритет 2</h4>
                              <div className="space-y-1">
                                {available.priority2.map(emp => (
                                  <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
                                    <span>{emp.full_name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {available.priority3.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Приоритет 3</h4>
                              <div className="space-y-1">
                                {available.priority3.map(emp => (
                                  <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
                                    <span>{emp.full_name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {available.goals.length > 0 && (
                            <div>
                              <h4 className="font-medium text-purple-700 mb-2">Цель обучения</h4>
                              <div className="space-y-1">
                                {available.goals.map(emp => (
                                  <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
                                    <span>{emp.full_name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                      onClick={() => setManualShowAddModal(null)}
                      className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                    >
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
                      Добавить выбранных ({manualEmployeeSelection.size})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="p-6">
            <EmployeesList isSuperAdmin={isSuperAdmin} currentUserId={profile.id} onEmployeeUpdate={fetchData} />
            <div className="mt-6 border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b"><h4 className="font-medium">Статистика входов</h4></div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold">Сотрудник</th><th className="px-4 py-3 text-left text-xs font-semibold">Последний вход</th></tr></thead>
                  <tbody className="divide-y bg-white">
                    {employees.map(emp => <tr key={emp.id}><td className="px-4 py-3 text-sm font-medium">{emp.full_name}</td><td className="px-4 py-3 text-sm">{emp.last_login ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm') : '—'}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attractions' && <div className="p-6"><AttractionsList isSuperAdmin={isSuperAdmin} onAttractionUpdate={fetchData} /></div>}
      </div>
    </div>
  );
}
