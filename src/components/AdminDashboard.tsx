/*
 * =====================================================================
 * ВНИМАНИЕ! Этот файл разбит на логические блоки с комментариями.
 * Каждый блок начинается с // ===== БЛОК N: ... =====
 * 
 * ПРАВИЛА ЗАМЕНЫ БЛОКОВ:
 * 1. Если нужно изменить код только в определённых блоках (например, блок 10),
 *    вы должны полностью заменить содержимое этих блоков, включая комментарии.
 * 2. Не удаляйте и не изменяйте комментарии-разделители блоков без необходимости.
 * 3. Если изменяете несколько блоков, заменяйте каждый целиком, сохраняя их порядок.
 * 4. Остальные блоки (не упомянутые в задании) должны оставаться нетронутыми.
 * 5. В ответе укажите, какие именно блоки были изменены.
 * =====================================================================
 */
// ============================================================
// БЛОК 1: Импорты и типы
// Описание: Импорт всех зависимостей, компонентов, утилит и типов.
// При изменении: заменять целиком, если добавляются новые импорты.
// ============================================================
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

// ============================================================
// БЛОК 2: Вспомогательные функции и интерфейс пропсов
// Описание: Проверка возможности редактирования, типы пропсов компонента.
// При изменении: если меняется логика canEditSchedule или добавляются пропсы.
// ============================================================
type ViewMode = 'day' | 'week' | 'month';

interface AdminDashboardProps {
  profile: UserProfile;
  isSuperAdmin?: boolean;
}

function canEditSchedule(workDate: string): boolean {
  const now = new Date();
  const date = parseISO(workDate);
  const deadline = new Date(date);
  deadline.setHours(23, 0, 0, 0);
  return now < deadline;
}

// ============================================================
// БЛОК 3: Состояния компонента (useState)
// Описание: Все локальные состояния для управления данными и UI.
// При изменении: заменять целиком при добавлении/удалении состояний.
// ============================================================
export function AdminDashboard({ profile, isSuperAdmin = false }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'shifts' | 'schedule' | 'manual' | 'employees' | 'attractions'>('shifts');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

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
  const [shiftComment, setShiftComment] = useState('');
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Новые состояния для поиска сотрудника в форме добавления смены
  const [addEmployeeSearch, setAddEmployeeSearch] = useState('');
  const [addEmployeeResults, setAddEmployeeResults] = useState<Employee[]>([]);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);

  // Состояния для ручного составления смены
  const [manualMonth, setManualMonth] = useState<Date>(new Date());
  const [manualSelectedDay, setManualSelectedDay] = useState<Date | null>(null);
  const [manualWorkingAttractions, setManualWorkingAttractions] = useState<Set<number>>(new Set());
  const [manualEmployeesForDay, setManualEmployeesForDay] = useState<any[]>([]);
  const [manualDayAssignments, setManualDayAssignments] = useState<ScheduleAssignment[]>([]);
  const [manualAttractionAssignments, setManualAttractionAssignments] = useState<Map<number, number[]>>(new Map());
  const [manualDayDataLoading, setManualDayDataLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualShowAddModal, setManualShowAddModal] = useState<{ attractionId: number; attractionName: string } | null>(null);
  const [manualEmployeeSelection, setManualEmployeeSelection] = useState<Set<number>>(new Set());

  const [prioritiesCache, setPrioritiesCache] = useState<any[]>([]);
  const [goalsCache, setGoalsCache] = useState<any[]>([]);

  // ============================================================
  // БЛОК 4: Загрузка данных (fetchData и useEffect)
  // Описание: Основная функция получения данных из БД. Обновлена для загрузки доп. полей сотрудников.
  // При изменении: заменять целиком при изменении запросов или логики обновления.
  // ============================================================
  const fetchData = async () => {
    setLoading(true);
    try {
      // Сотрудники — добавлены phone_number, telegram, vk, max
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, full_name, age, base_hourly_rate, last_login, phone_number, telegram, vk, max')
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

  // ============================================================
  // БЛОК 5: Вспомогательные функции для ручного составления смены
  // Описание: Загрузка данных дня, календарь, проверка наличия графика.
  // При изменении: заменять целиком при модификации ручного режима.
  // ============================================================
  const fetchDayData = useCallback(async (date: Date) => {
    if (!date) return;
    setManualDayDataLoading(true);
    setManualError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data: availData, error: availError } = await supabase
        .from('employee_availability')
        .select('employee_id, is_full_day, start_time, end_time, comment')
        .eq('work_date', dateStr);
      if (availError) throw availError;
      
      const availableEmpIds = availData?.map(a => a.employee_id) || [];
      
      let goalsData: any[] = [];
      if (availableEmpIds.length > 0) {
        const { data: goals, error: goalsError } = await supabase
          .from('employee_study_goals')
          .select('employee_id, attraction_id')
          .in('employee_id', availableEmpIds);
        if (goalsError) throw goalsError;
        goalsData = goals || [];
      }
      
      const { data: priorities, error: prioritiesError } = await supabase
        .from('employee_attraction_priorities')
        .select('employee_id, attraction_id, priority_level');
      if (prioritiesError) throw prioritiesError;
      
      const { data: dayAssignments, error: assignError } = await supabase
        .from('schedule_assignments')
        .select('id, employee_id, attraction_id, start_time, end_time, version_type')
        .eq('work_date', dateStr);
      if (assignError) throw assignError;
      
      const empMap = new Map(employees.map(e => [e.id, e]));
      const attrMap = new Map(attractions.map(a => [a.id, a]));
      
      const goalsMap = new Map<number, string>();
      goalsData.forEach(g => {
        const attr = attrMap.get(g.attraction_id);
        if (attr) goalsMap.set(g.employee_id, attr.name);
      });
      
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
      
      const workingAttrSet = new Set<number>();
      const assignMap = new Map<number, number[]>();
      dayAssignments?.forEach(a => {
        workingAttrSet.add(a.attraction_id);
        const list = assignMap.get(a.attraction_id) || [];
        list.push(a.employee_id);
        assignMap.set(a.attraction_id, list);
      });
      setManualWorkingAttractions(workingAttrSet);
      setManualAttractionAssignments(assignMap);
      setManualDayAssignments(dayAssignments || []);
      
      setPrioritiesCache(priorities || []);
      setGoalsCache(goalsData);
      
    } catch (err: any) {
      console.error('Ошибка загрузки данных дня:', err);
      setManualError(err.message);
    } finally {
      setManualDayDataLoading(false);
    }
  }, [employees, attractions]);

  const handleDaySelect = (day: Date) => {
    setManualSelectedDay(day);
    fetchDayData(day);
  };

  const handleManualMonthChange = (direction: 'prev' | 'next') => {
    setManualMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const monthDays = useMemo(() => {
    const start = startOfMonth(manualMonth);
    const end = endOfMonth(manualMonth);
    return eachDayOfInterval({ start, end });
  }, [manualMonth]);

  const dayHasSchedule = (day: Date) => {
    return scheduleAssignments.some(a => isSameDay(parseISO(a.work_date), day));
  };

  // ============================================================
  // БЛОК 6: Обработчики для ручного составления
  // Описание: Управление аттракционами, добавление/удаление сотрудников, сохранение.
  // При изменении: заменять целиком при правках ручного режима.
  // ============================================================
  const toggleAttractionWorking = (attractionId: number) => {
    setManualWorkingAttractions(prev => {
      const next = new Set(prev);
      if (next.has(attractionId)) {
        next.delete(attractionId);
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

  const getAvailableEmployeesForAttraction = (attractionId: number) => {
    const assignedEmployeeIds = new Set<number>();
    manualAttractionAssignments.forEach(ids => ids.forEach(id => assignedEmployeeIds.add(id)));
    
    const available = manualEmployeesForDay.filter(emp => !assignedEmployeeIds.has(emp.id));
    
    const priorityMap = new Map<number, number[]>();
    prioritiesCache.forEach(p => {
      if (p.attraction_id === attractionId) {
        const list = priorityMap.get(p.priority_level) || [];
        list.push(p.employee_id);
        priorityMap.set(p.priority_level, list);
      }
    });
    
    const goalEmployeeIds = goalsCache
      .filter(g => g.attraction_id === attractionId)
      .map(g => g.employee_id);
    
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
    
    manualAttractionAssignments.forEach((employeeIds, attractionId) => {
      employeeIds.forEach(empId => {
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
      const { error: deleteError } = await supabase
        .from('schedule_assignments')
        .delete()
        .eq('work_date', dateStr);
      if (deleteError) throw deleteError;
      
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
      
      await fetchData();
      fetchDayData(manualSelectedDay);
      
      alert('График сохранён');
    } catch (err: any) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  };

 // ============================================================
// БЛОК 7: Обработчики для старых смен (shifts)
// Описание: Логика работы с вкладкой "Управление сменами".
// При изменении: заменять целиком при правках этой вкладки.
// ============================================================
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

// Проверка возможности редактирования смены (можно только если дата >= сегодня - 2 дня)
const canEditShift = (workDate: string): boolean => {
  const today = startOfDay(new Date());
  const target = startOfDay(parseISO(workDate));
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
};

// Debounced поиск сотрудников для формы добавления
useEffect(() => {
  const timer = setTimeout(() => {
    if (!addEmployeeSearch.trim()) {
      setAddEmployeeResults([]);
      return;
    }
    const filtered = employees.filter(emp =>
      emp.full_name.toLowerCase().includes(addEmployeeSearch.toLowerCase())
    );
    setAddEmployeeResults(filtered.slice(0, 10));
  }, 300);
  return () => clearTimeout(timer);
}, [addEmployeeSearch, employees]);

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
  setShiftComment('');
  setAddEmployeeSearch('');
  setAddEmployeeResults([]);
  setFormError(null);
  setShowShiftForm(false);
  setShowAddShiftModal(false);
};

const handleSaveShift = async (e: React.FormEvent) => {
  e.preventDefault();
  setFormError(null);
  if (!selectedEmployeeId) { setFormError('Выберите сотрудника'); return; }
  if (!workDate) { setFormError('Укажите дату'); return; }
  if (!isFullDay && (!startTime || !endTime)) { setFormError('Укажите время'); return; }

  // Проверка дубликата
  const { data: existing, error: checkError } = await supabase
    .from('employee_availability')
    .select('id')
    .eq('employee_id', Number(selectedEmployeeId))
    .eq('work_date', workDate);
  
  if (checkError) {
    setFormError('Ошибка проверки дубликата');
    return;
  }
  // Если редактируем существующую запись, исключаем её из проверки
  const duplicate = existing?.some(s => s.id !== editingShiftId);
  if (duplicate) {
    setFormError('У сотрудника уже есть смена на эту дату');
    return;
  }

  const shiftData = {
    employee_id: Number(selectedEmployeeId),
    work_date: workDate,
    is_full_day: isFullDay,
    start_time: isFullDay ? null : startTime,
    end_time: isFullDay ? null : endTime,
    comment: shiftComment || null,
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
  if (!canEditShift(shift.work_date)) {
    alert('Редактирование этой смены запрещено (прошло более 2 дней)');
    return;
  }
  setEditingShiftId(shift.id);
  setSelectedEmployeeId(shift.employee_id);
  setWorkDate(shift.work_date);
  setIsFullDay(shift.is_full_day);
  setStartTime(shift.start_time || '');
  setEndTime(shift.end_time || '');
  setShiftComment(shift.comment || '');
  // Для формы редактирования предзаполняем поиск именем сотрудника
  const emp = employees.find(e => e.id === shift.employee_id);
  setAddEmployeeSearch(emp?.full_name || '');
  setShowAddShiftModal(true);
};

const handleDeleteShift = async (shift: ShiftWithEmployee) => {
  if (!canEditShift(shift.work_date)) {
    alert('Удаление этой смены запрещено (прошло более 2 дней)');
    return;
  }
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
  // не используется
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

  // ============================================================
  // БЛОК 8: Вычисляемые значения и рендер календаря (общие)
  // Описание: Вспомогательные функции для календаря вкладки "Управление сменами".
  // При изменении: заменять целиком при изменении календаря смен.
  // ============================================================
  // (Весь код выше уже содержит вычисления)

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin text-blue-600 h-8 w-8" /></div>;

// ============================================================
// БЛОК 9: Рендер основного компонента (вкладки)
// Описание: Верхняя панель вкладок и условный рендер содержимого.
// При изменении: заменять только обёртку вкладок, не трогая внутренние блоки.
// ============================================================
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

      {/* ===== ВКЛАДКА "УПРАВЛЕНИЕ СМЕНАМИ" ===== */}
      {activeTab === 'shifts' && (
        <div className="p-6 space-y-6">
          {/* Заголовок и выбор месяца */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xl font-semibold capitalize">{monthLabel}</span>
              <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setViewMode('day');
                  setSelectedDate(new Date(currentYear, currentMonth, 1));
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  viewMode === 'day' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                День
              </button>
              <button
                onClick={() => {
                  setViewMode('week');
                  setSelectedWeekStart(startOfWeek(new Date(currentYear, currentMonth, 1), { weekStartsOn: 1 }));
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  viewMode === 'week' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  viewMode === 'month' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Месяц
              </button>
            </div>
          </div>

          {/* Дополнительный выбор даты/недели */}
          {viewMode === 'day' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Дата:</span>
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
          {viewMode === 'week' && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedWeekStart(prev => addDays(prev, -7))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {format(selectedWeekStart, 'd MMM')} – {format(addDays(selectedWeekStart, 6), 'd MMM yyyy')}
              </span>
              <button
                onClick={() => setSelectedWeekStart(prev => addDays(prev, 7))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Панель поиска и добавления */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по сотруднику или дате..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => {
                resetShiftForm();
                setWorkDate(format(new Date(), 'yyyy-MM-dd'));
                setShowAddShiftModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Добавить смену
            </button>
          </div>

          {/* Таблица смен */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Сотрудник</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Тип смены</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Время</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Комментарий</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Нет смен за выбранный период
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map(shift => {
                      const editable = canEditShift(shift.work_date);
                      return (
                        <tr key={shift.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {format(parseISO(shift.work_date), 'dd.MM.yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {shift.employees?.full_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {shift.is_full_day ? 'Полный день' : 'Неполный день'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {!shift.is_full_day && shift.start_time && shift.end_time
                              ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                            {shift.comment || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditShift(shift)}
                                disabled={!editable}
                                className={`p-1.5 rounded-lg ${
                                  editable ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title={editable ? 'Редактировать' : 'Редактирование запрещено (прошло более 2 дней)'}
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteShift(shift)}
                                disabled={!editable}
                                className={`p-1.5 rounded-lg ${
                                  editable ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'
                                }`}
                                title={editable ? 'Удалить' : 'Удаление запрещено (прошло более 2 дней)'}
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

          {/* Модальное окно добавления/редактирования смены */}
          {showAddShiftModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <form onSubmit={handleSaveShift} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {editingShiftId ? 'Редактировать смену' : 'Новая смена'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        resetShiftForm();
                        setShowAddShiftModal(false);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {formError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Поиск сотрудника (для добавления) или заблокированное поле (для редактирования) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Сотрудник <span className="text-red-500">*</span>
                    </label>
                    {editingShiftId ? (
                      <input
                        type="text"
                        value={addEmployeeSearch}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                      />
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Начните вводить ФИО..."
                          value={addEmployeeSearch}
                          onChange={(e) => setAddEmployeeSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        {addEmployeeResults.length > 0 && (
                          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {addEmployeeResults.map(emp => (
                              <li
                                key={emp.id}
                                onClick={() => {
                                  setSelectedEmployeeId(emp.id);
                                  setAddEmployeeSearch(emp.full_name);
                                  setAddEmployeeResults([]);
                                }}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Дата <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!!editingShiftId}
                      required
                    />
                  </div>

                  {/* Тип смены */}
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

                  {/* Время для неполного дня */}
                  {!isFullDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Начало</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Конец</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {/* Комментарий */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
                    <textarea
                      value={shiftComment}
                      onChange={(e) => setShiftComment(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Необязательно"
                    />
                  </div>

                  {/* Кнопки */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetShiftForm();
                        setShowAddShiftModal(false);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {editingShiftId ? 'Сохранить' : 'Добавить'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ВКЛАДКА "ГЕНЕРАТОР ГРАФИКА" ===== */}
      {activeTab === 'schedule' && (
        <div className="p-6">
          <ScheduleGenerator profile={profile} isSuperAdmin={isSuperAdmin} onScheduleGenerated={fetchData} />
        </div>
      )}

      {/* ===== ВКЛАДКА "РУЧНОЕ СОСТАВЛЕНИЕ СМЕНЫ" ===== */}
      {activeTab === 'manual' && (
        <div className="p-6 space-y-6">
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

      {/* ===== ВКЛАДКА "СОТРУДНИКИ" ===== */}
      {activeTab === 'employees' && (
        <div className="p-6 space-y-6">
          {/* Заголовок и поиск */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-xl font-semibold">Сотрудники</h3>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по имени, фамилии или отчеству..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Таблица сотрудников */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ФИО</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Возраст</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Телефон</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Соцсети</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Последний вход</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {employees
                    .filter(emp => {
                      if (!employeeSearch.trim()) return true;
                      const query = employeeSearch.toLowerCase();
                      return emp.full_name?.toLowerCase().includes(query) || false;
                    })
                    .map(emp => (
                      <tr key={emp.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.full_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{emp.age || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{emp.phone_number || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            {emp.telegram && (
                              <a
                                href={emp.telegram.startsWith('http') ? emp.telegram : `https://t.me/${emp.telegram.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700"
                                title="Telegram"
                              >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.57-1.37-.93-2.22-1.49-.98-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.22-.02-.09.02-1.52.96-4.29 2.84-.41.28-.78.42-1.11.41-.37-.01-1.07-.21-1.59-.38-.64-.21-1.15-.32-1.1-.67.02-.18.27-.37.74-.56 2.88-1.25 4.8-2.08 5.76-2.48 2.74-1.14 3.31-1.34 3.68-1.34.08 0 .26.02.38.12.1.08.13.19.14.27.01.08.02.17 0 .24z"/>
                                </svg>
                              </a>
                            )}
                            {emp.vk && (
                              <a
                                href={emp.vk.startsWith('http') ? emp.vk : `https://vk.com/${emp.vk}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                title="ВКонтакте"
                              >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M21.579 6.855c.14-.465 0-.806-.662-.806h-2.193c-.558 0-.813.295-.953.62 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.558.258-.558.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.743 0-2.551-2.729-3.624-5.853-.209-.607-.42-.853-.98-.853H2.752c-.627 0-.752.295-.752.62 0 .582.743 3.462 3.462 7.271 1.812 2.601 4.363 4.011 6.687 4.011 1.393 0 1.565-.313 1.565-.852v-1.966c0-.626.133-.752.574-.752.324 0 .882.164 2.183 1.417 1.486 1.486 1.732 2.153 2.567 2.153h2.192c.626 0 .939-.313.759-.931-.197-.615-.907-1.51-1.849-2.569-.512-.604-1.277-1.254-1.51-1.579-.325-.419-.232-.604 0-.976.001.001 2.672-3.761 2.95-5.04z"/>
                                </svg>
                              </a>
                            )}
                            {emp.max && (
                              <a
                                href={emp.max.startsWith('http') ? emp.max : `https://max.ru/${emp.max}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-800"
                                title="Max"
                              >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                                  <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor" fontWeight="bold">M</text>
                                </svg>
                              </a>
                            )}
                            {!emp.telegram && !emp.vk && !emp.max && <span className="text-gray-400 text-xs">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {emp.last_login
                            ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {employees.length === 0 && (
              <div className="p-8 text-center text-gray-500">Нет сотрудников</div>
            )}
            {employees.length > 0 && employees.filter(emp => emp.full_name?.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
              <div className="p-8 text-center text-gray-500">По запросу «{employeeSearch}» ничего не найдено</div>
            )}
          </div>

          {/* Статистика входов */}
          <div className="border rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h4 className="font-medium">Статистика входов</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Сотрудник</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Последний вход</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td className="px-4 py-3 text-sm font-medium">{emp.full_name}</td>
                      <td className="px-4 py-3 text-sm">
                        {emp.last_login ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== ВКЛАДКА "АТТРАКЦИОНЫ" ===== */}
      {activeTab === 'attractions' && (
        <div className="p-6">
          <AttractionsList isSuperAdmin={isSuperAdmin} onAttractionUpdate={fetchData} />
        </div>
      )}
    </div>
  </div>
);
        {/* ============================================================ */}
        {/* БЛОК 10: Вкладка "Сотрудники" (ПОЛНОСТЬЮ ПЕРЕРАБОТАН)        */}
        {/* Описание: Отображает список сотрудников с поиском по ФИО,    */}
        {/*            возрастом, телефоном, соцсетями и последним входом.*/}
        {/* При изменении: ЗАМЕНЯТЬ ВЕСЬ ЭТОТ БЛОК ЦЕЛИКОМ.              */}
        {/* ============================================================ */}
        {activeTab === 'employees' && (
          <div className="p-6 space-y-6">
            {/* Заголовок и поиск */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-semibold">Сотрудники</h3>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени, фамилии или отчеству..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Таблица сотрудников */}
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ФИО</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Возраст</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Телефон</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Соцсети</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Последний вход</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {employees
                      .filter(emp => {
                        if (!employeeSearch.trim()) return true;
                        const query = employeeSearch.toLowerCase();
                        return emp.full_name?.toLowerCase().includes(query) || false;
                      })
                      .map(emp => (
                        <tr key={emp.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.full_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{emp.age || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{emp.phone_number || '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              {emp.telegram && (
                                <a
                                  href={emp.telegram.startsWith('http') ? emp.telegram : `https://t.me/${emp.telegram.replace('@', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700"
                                  title="Telegram"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.57-1.37-.93-2.22-1.49-.98-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.22-.02-.09.02-1.52.96-4.29 2.84-.41.28-.78.42-1.11.41-.37-.01-1.07-.21-1.59-.38-.64-.21-1.15-.32-1.1-.67.02-.18.27-.37.74-.56 2.88-1.25 4.8-2.08 5.76-2.48 2.74-1.14 3.31-1.34 3.68-1.34.08 0 .26.02.38.12.1.08.13.19.14.27.01.08.02.17 0 .24z"/>
                                  </svg>
                                </a>
                              )}
                              {emp.vk && (
                                <a
                                  href={emp.vk.startsWith('http') ? emp.vk : `https://vk.com/${emp.vk}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  title="ВКонтакте"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M21.579 6.855c.14-.465 0-.806-.662-.806h-2.193c-.558 0-.813.295-.953.62 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.558.258-.558.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.743 0-2.551-2.729-3.624-5.853-.209-.607-.42-.853-.98-.853H2.752c-.627 0-.752.295-.752.62 0 .582.743 3.462 3.462 7.271 1.812 2.601 4.363 4.011 6.687 4.011 1.393 0 1.565-.313 1.565-.852v-1.966c0-.626.133-.752.574-.752.324 0 .882.164 2.183 1.417 1.486 1.486 1.732 2.153 2.567 2.153h2.192c.626 0 .939-.313.759-.931-.197-.615-.907-1.51-1.849-2.569-.512-.604-1.277-1.254-1.51-1.579-.325-.419-.232-.604 0-.976.001.001 2.672-3.761 2.95-5.04z"/>
                                  </svg>
                                </a>
                              )}
                              {emp.max && (
                                <a
                                  href={emp.max.startsWith('http') ? emp.max : `https://max.ru/${emp.max}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-800"
                                  title="Max"
                                >
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                                    <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor" fontWeight="bold">M</text>
                                  </svg>
                                </a>
                              )}
                              {!emp.telegram && !emp.vk && !emp.max && <span className="text-gray-400 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {emp.last_login
                              ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {employees.length === 0 && (
                <div className="p-8 text-center text-gray-500">Нет сотрудников</div>
              )}
              {employees.length > 0 && employees.filter(emp => emp.full_name?.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                <div className="p-8 text-center text-gray-500">По запросу «{employeeSearch}» ничего не найдено</div>
              )}
            </div>

            {/* Статистика входов (сохранена для обратной совместимости) */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h4 className="font-medium">Статистика входов</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold">Сотрудник</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold">Последний вход</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td className="px-4 py-3 text-sm font-medium">{emp.full_name}</td>
                        <td className="px-4 py-3 text-sm">
                          {emp.last_login ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* КОНЕЦ БЛОКА 10 */}

        {/* ============================================================ */}
        {/* БЛОК 11: Вкладка "Аттракционы" (без изменений)               */}
        {/* Описание: Отображает список аттракционов через компонент.    */}
        {/* При изменении: заменять целиком при правках аттракционов.    */}
        {/* ============================================================ */}
        {activeTab === 'attractions' && (
          <div className="p-6">
            <AttractionsList isSuperAdmin={isSuperAdmin} onAttractionUpdate={fetchData} />
          </div>
        )}
      </div>
    </div>
  );
}
