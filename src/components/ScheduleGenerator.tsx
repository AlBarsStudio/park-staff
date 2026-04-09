/*
 * =====================================================================
 * ГЕНЕРАТОР ГРАФИКА - ВЕРСИЯ 2.0
 * Интеграция с DatabaseService, улучшенные алгоритмы, современный UI
 * =====================================================================
 */

// ============================================================
// БЛОК 1: Импорты и типы
// ============================================================
import { useState, useEffect } from 'react';
import { dbService } from '../lib/DatabaseService';
import type { Employee, Attraction } from '../lib/DatabaseService';
import { UserProfile } from '../types';
import {
  Loader2, Wand2, Save, GripVertical,
  Plus, X, CheckSquare, Square, AlertCircle, Calendar,
  Users, Filter, Clock, Sparkles, TrendingUp
} from 'lucide-react';
import { format, addDays, parseISO, isWeekend } from 'date-fns';
import { ru } from 'date-fns/locale';

// Типы данных для генератора
interface AttractionWithStaff {
  id: number;
  name: string;
  minStaffWeekday: number;
  minStaffWeekend: number;
}

interface EmployeeWithPriority {
  id: number;
  name: string;
  priorityMap: Map<number, number>;
  studyGoalAttractionId?: number;
}

interface Availability {
  employeeId: number;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  comment?: string;
}

interface ScheduleEntry {
  employeeId: number;
  employeeName: string;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  isManuallyAdded?: boolean;
}

interface ScheduleAttractionRow {
  attractionId: number;
  attractionName: string;
  minStaffRequired: number;
  employees: ScheduleEntry[];
}

interface ScheduleDay {
  date: string;
  rows: ScheduleAttractionRow[];
}

type AlgorithmType = 'combined' | 'timeslot';

// ============================================================
// БЛОК 2: Вспомогательные функции
// ============================================================

const WORK_START_MIN = 0;
const WORK_END_MIN = 780;
const HOURS = Array.from({ length: 13 }, (_, i) => i);

function minutesFrom10(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h - 10) * 60 + m;
}

function formatTimeFromMinutes(minutesFrom10: number): string {
  const totalMinutes = 10 * 60 + minutesFrom10;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Покрытие дня неполными сменами
function findCoverForAttraction(
  neededCount: number,
  partialEmployees: ScheduleEntry[],
  attractionId: number,
  priorityMapCache: Map<number, Map<number, number>>
): ScheduleEntry[] | null {
  const candidates = partialEmployees.filter(emp => {
    const priorities = priorityMapCache.get(emp.employeeId);
    return priorities?.has(attractionId);
  });
  
  if (candidates.length < neededCount) return null;
  if (neededCount === 1) return null;

  if (neededCount === 2) {
    const intervals = candidates.map(emp => ({
      emp,
      start: emp.startTime ? minutesFrom10(emp.startTime) : WORK_START_MIN,
      end: emp.endTime ? minutesFrom10(emp.endTime) : WORK_END_MIN
    }));
    
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i];
        const b = intervals[j];
        const start = Math.min(a.start, b.start);
        const end = Math.max(a.end, b.end);
        if (start <= WORK_START_MIN && end >= WORK_END_MIN) {
          return [a.emp, b.emp];
        }
      }
    }
  }

  return null;
}

// Min-cost flow для назначения
function solveAssignment(
  employees: EmployeeWithPriority[],
  slots: { attractionId: number }[]
): (number | null)[] {
  const nEmp = employees.length;
  const nSlot = slots.length;
  if (nEmp === 0 || nSlot === 0) return new Array(nSlot).fill(null);

  const INF = 1e9;
  const cost: number[][] = Array(nEmp).fill(null).map(() => Array(nSlot).fill(INF));
  
  for (let i = 0; i < nEmp; i++) {
    const emp = employees[i];
    for (let j = 0; j < nSlot; j++) {
      const attractionId = slots[j].attractionId;
      const priority = emp.priorityMap.get(attractionId);
      if (priority !== undefined) {
        // Улучшение: добавляем бонус для study goals
        let baseCost = priority * 10;
        if (emp.studyGoalAttractionId === attractionId) {
          baseCost -= 5; // Приоритет для обучения
        }
        cost[i][j] = baseCost;
      }
    }
  }

  const N = 2 + nEmp + nSlot;
  const source = 0;
  const sink = N - 1;
  const empOffset = 1;
  const slotOffset = 1 + nEmp;

  interface Edge {
    to: number;
    rev: number;
    cap: number;
    cost: number;
  }
  const graph: Edge[][] = Array(N).fill(null).map(() => []);

  const addEdge = (from: number, to: number, cap: number, cost: number) => {
    graph[from].push({ to, rev: graph[to].length, cap, cost });
    graph[to].push({ to: from, rev: graph[from].length - 1, cap: 0, cost: -cost });
  };

  for (let i = 0; i < nEmp; i++) addEdge(source, empOffset + i, 1, 0);
  for (let i = 0; i < nEmp; i++) {
    for (let j = 0; j < nSlot; j++) {
      if (cost[i][j] < INF) addEdge(empOffset + i, slotOffset + j, 1, cost[i][j]);
    }
  }
  for (let j = 0; j < nSlot; j++) addEdge(slotOffset + j, sink, 1, 0);

  let totalFlow = 0;
  const maxFlow = Math.min(nEmp, nSlot);
  const dist = new Array(N);
  const prevv = new Array(N);
  const preve = new Array(N);
  const inqueue = new Array(N);

  while (totalFlow < maxFlow) {
    for (let i = 0; i < N; i++) dist[i] = INF;
    dist[source] = 0;
    const queue: number[] = [source];
    inqueue[source] = true;
    
    while (queue.length) {
      const v = queue.shift()!;
      inqueue[v] = false;
      for (let i = 0; i < graph[v].length; i++) {
        const e = graph[v][i];
        if (e.cap > 0 && dist[e.to] > dist[v] + e.cost) {
          dist[e.to] = dist[v] + e.cost;
          prevv[e.to] = v;
          preve[e.to] = i;
          if (!inqueue[e.to]) {
            queue.push(e.to);
            inqueue[e.to] = true;
          }
        }
      }
    }
    
    if (dist[sink] === INF) break;
    
    let d = maxFlow - totalFlow;
    for (let v = sink; v !== source; v = prevv[v]) {
      d = Math.min(d, graph[prevv[v]][preve[v]].cap);
    }
    totalFlow += d;
    for (let v = sink; v !== source; v = prevv[v]) {
      const e = graph[prevv[v]][preve[v]];
      e.cap -= d;
      graph[v][e.rev].cap += d;
    }
  }

  const assignment: (number | null)[] = new Array(nSlot).fill(null);
  for (let i = 0; i < nEmp; i++) {
    const empNode = empOffset + i;
    for (const e of graph[empNode]) {
      if (e.to >= slotOffset && e.to < slotOffset + nSlot && e.cap === 0) {
        const slotIdx = e.to - slotOffset;
        assignment[slotIdx] = employees[i].id;
        break;
      }
    }
  }
  return assignment;
}

// ============================================================
// БЛОК 3: Компонент ScheduleGenerator
// ============================================================

export function ScheduleGenerator({ profile, isSuperAdmin = false }: { profile: UserProfile; isSuperAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<AttractionWithStaff[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Параметры генерации
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysCount, setDaysCount] = useState<number>(1);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<Set<number>>(new Set());
  const [minStaffPerAttraction, setMinStaffPerAttraction] = useState<number>(1);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('combined');

  // Результат
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [unassigned, setUnassigned] = useState<ScheduleEntry[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Кэши
  const [priorityMapCache, setPriorityMapCache] = useState<Map<number, Map<number, number>>>(new Map());
  const [studyGoalCache, setStudyGoalCache] = useState<Map<number, number>>(new Map());

  // ============================================================
  // Инициализация и загрузка данных через DatabaseService
  // ============================================================
  
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    
    try {
      // Проверяем готовность DatabaseService
      if (!dbService.isReady()) {
        console.error('[ScheduleGenerator] DatabaseService не готов');
        alert('Ошибка: Сервис базы данных не инициализирован');
        setLoading(false);
        return;
      }

      // Загружаем аттракционы из DatabaseService
      const attractionsData = dbService.getAttractions();
      const mapped = attractionsData.map(a => ({
        id: a.id,
        name: a.name,
        minStaffWeekday: a.min_staff_weekday ?? 1,
        minStaffWeekend: a.min_staff_weekend ?? 1,
      }));
      setAttractions(mapped);
      setSelectedAttractionIds(new Set(mapped.map(a => a.id)));

      // Загружаем сотрудников
      const employeesData = dbService.getEmployees();
      setEmployees(employeesData);

      // Загружаем приоритеты
      const priorities = dbService.getPriorities();
      const priorityMap = new Map<number, Map<number, number>>();
      
      for (const p of priorities) {
        if (!priorityMap.has(p.employee_id)) {
          priorityMap.set(p.employee_id, new Map());
        }
        const empMap = priorityMap.get(p.employee_id)!;
        for (const attrId of p.attraction_ids) {
          empMap.set(attrId, p.priority_level);
        }
      }
      setPriorityMapCache(priorityMap);

      // Загружаем цели обучения
      const goals = dbService.getStudyGoals();
      const goalMap = new Map<number, number>();
      for (const g of goals) {
        goalMap.set(g.employee_id, g.attraction_id);
      }
      setStudyGoalCache(goalMap);

      console.log('[ScheduleGenerator] Данные загружены:', {
        attractions: mapped.length,
        employees: employeesData.length,
        priorities: priorities.length,
        goals: goals.length
      });

    } catch (error) {
      console.error('[ScheduleGenerator] Ошибка загрузки:', error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Получение доступности через DatabaseService
  // ============================================================
  
  const fetchAvailabilityForDate = async (date: string): Promise<Availability[]> => {
    const availData = dbService.getAvailabilityByDate(parseISO(date));
    
    return availData.map(row => ({
      employeeId: row.employee_id,
      isFullDay: row.is_full_day,
      startTime: row.start_time,
      endTime: row.end_time,
      comment: row.comment || undefined,
    }));
  };

  // ============================================================
  // БЛОК 4: Генерация для одного дня (комбинированный алгоритм)
  // ============================================================
  
  const generateForDayCombined = async (date: string): Promise<{ rows: ScheduleAttractionRow[]; unassigned: ScheduleEntry[] }> => {
    const activeAttractions = attractions.filter(a => selectedAttractionIds.has(a.id));
    const isWeekendDay = isWeekend(parseISO(date));

    const attractionRequirements = activeAttractions.map(attr => ({
      attractionId: attr.id,
      attractionName: attr.name,
      requiredCount: Math.max(
        isWeekendDay ? attr.minStaffWeekend : attr.minStaffWeekday,
        minStaffPerAttraction
      )
    }));

    const availabilities = await fetchAvailabilityForDate(date);
    const fullDayAvail = availabilities.filter(a => a.isFullDay);
    const partialAvail = availabilities.filter(a => !a.isFullDay);

    // Сотрудники с полными сменами
    const fullEmployees: EmployeeWithPriority[] = [];
    for (const av of fullDayAvail) {
      const emp = employees.find(e => e.id === av.employeeId);
      if (!emp) continue;
      const priorityMap = priorityMapCache.get(av.employeeId) || new Map();
      fullEmployees.push({
        id: emp.id,
        name: emp.full_name,
        priorityMap,
        studyGoalAttractionId: studyGoalCache.get(av.employeeId),
      });
    }

    // Создаём слоты
    const slots: { attractionId: number }[] = [];
    for (const req of attractionRequirements) {
      for (let i = 0; i < req.requiredCount; i++) {
        slots.push({ attractionId: req.attractionId });
      }
    }

    // Назначаем полные смены
    const assignment = solveAssignment(fullEmployees, slots);

    const rows: ScheduleAttractionRow[] = attractionRequirements.map(req => ({
      attractionId: req.attractionId,
      attractionName: req.attractionName,
      minStaffRequired: req.requiredCount,
      employees: []
    }));

    const assignedFullIds: number[] = [];
    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
      const slot = slots[slotIdx];
      const empId = assignment[slotIdx];
      if (empId !== null) {
        const emp = fullEmployees.find(e => e.id === empId);
        if (emp) {
          const row = rows.find(r => r.attractionId === slot.attractionId);
          if (row) {
            row.employees.push({
              employeeId: emp.id,
              employeeName: emp.name,
              isFullDay: true,
              startTime: null,
              endTime: null,
              isManuallyAdded: false,
            });
            assignedFullIds.push(emp.id);
          }
        }
      }
    }

    const unassignedFull = fullEmployees.filter(emp => !assignedFullIds.includes(emp.id));

    // Неполные смены
    let partialEntries: ScheduleEntry[] = [];
    for (const av of partialAvail) {
      const emp = employees.find(e => e.id === av.employeeId);
      if (emp) {
        partialEntries.push({
          employeeId: emp.id,
          employeeName: emp.full_name,
          isFullDay: false,
          startTime: av.startTime,
          endTime: av.endTime,
        });
      }
    }

    const usedPartialIds: number[] = [];
    for (const row of rows) {
      const currentCount = row.employees.length;
      const deficit = row.minStaffRequired - currentCount;
      if (deficit <= 0) continue;

      const availablePartials = partialEntries.filter(p => !usedPartialIds.includes(p.employeeId));
      const cover = findCoverForAttraction(deficit, availablePartials, row.attractionId, priorityMapCache);
      
      if (cover && cover.length === deficit) {
        for (const emp of cover) {
          row.employees.push({ ...emp, isManuallyAdded: false });
          usedPartialIds.push(emp.employeeId);
        }
      }
    }

    const remainingPartial = partialEntries.filter(p => !usedPartialIds.includes(p.employeeId));

    const unassignedList: ScheduleEntry[] = [
      ...unassignedFull.map(emp => ({
        employeeId: emp.id,
        employeeName: emp.name,
        isFullDay: true,
        startTime: null,
        endTime: null,
      })),
      ...remainingPartial
    ];

    return { rows, unassigned: unassignedList };
  };

  // ============================================================
  // БЛОК 5: Основная генерация графика
  // ============================================================
  
  const generateSchedule = async () => {
    if (selectedAttractionIds.size === 0) {
      alert('Выберите хотя бы один аттракцион');
      return;
    }
    
    setGenerating(true);
    setSaveSuccess(false);

    const dates: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      dates.push(format(addDays(parseISO(startDate), i), 'yyyy-MM-dd'));
    }

    const newSchedule: ScheduleDay[] = [];
    const allUnassigned: ScheduleEntry[] = [];

    for (const date of dates) {
      const { rows, unassigned: dayUnassigned } = await generateForDayCombined(date);
      newSchedule.push({ date, rows });
      allUnassigned.push(...dayUnassigned);
    }

    const uniqueUnassigned = allUnassigned.filter(
      (e, i, arr) => arr.findIndex(x => x.employeeId === e.employeeId) === i
    );
    
    setUnassigned(uniqueUnassigned);
    setSchedule(newSchedule);
    setIsGenerated(true);
    setGenerating(false);

    console.log('[ScheduleGenerator] График сгенерирован:', {
      days: daysCount,
      algorithm,
      unassigned: uniqueUnassigned.length
    });
  };

  // ============================================================
  // БЛОК 6: Ручное редактирование
  // ============================================================
  
  const moveToUnassigned = (dayDate: string, attractionId: number, employeeId: number) => {
    setSchedule(prev => prev.map(day => {
      if (day.date !== dayDate) return day;
      return {
        ...day,
        rows: day.rows.map(row => {
          if (row.attractionId !== attractionId) return row;
          const entry = row.employees.find(e => e.employeeId === employeeId);
          if (entry) {
            setUnassigned(u => {
              if (u.find(x => x.employeeId === employeeId)) return u;
              return [...u, entry];
            });
          }
          return { ...row, employees: row.employees.filter(e => e.employeeId !== employeeId) };
        }),
      };
    }));
  };

  const moveFromUnassigned = (employeeId: number, dayDate: string, attractionId: number) => {
    const entry = unassigned.find(e => e.employeeId === employeeId);
    if (!entry) return;

    const priorityMap = priorityMapCache.get(employeeId) || new Map();
    const hasPriority = priorityMap.has(attractionId);
    const studyGoal = studyGoalCache.get(employeeId);
    const hasGoal = studyGoal === attractionId;
    
    if (!hasPriority && !hasGoal) {
      alert(`Сотрудник ${entry.employeeName} не имеет допуска или цели на этот аттракцион.`);
      return;
    }

    setSchedule(prev => prev.map(day => {
      if (day.date !== dayDate) return day;
      return {
        ...day,
        rows: day.rows.map(row => {
          if (row.attractionId !== attractionId) return row;
          if (row.employees.find(e => e.employeeId === employeeId)) return row;
          return { ...row, employees: [...row.employees, { ...entry, isManuallyAdded: true }] };
        }),
      };
    }));
    setUnassigned(prev => prev.filter(e => e.employeeId !== employeeId));
  };

  // ============================================================
  // БЛОК 7: Сохранение графика через DatabaseService
  // ============================================================
  
  const handleSaveSchedule = async () => {
    setSaving(true);
    
    try {
      const assignments: Array<{
        employee_id: number;
        attraction_id: number;
        work_date: string;
        start_time: string;
        end_time: string | null;
      }> = [];

      for (const day of schedule) {
        for (const row of day.rows) {
          for (const emp of row.employees) {
            let startTime = '10:00:00';
            let endTime = null;
            
            if (!emp.isFullDay && emp.startTime && emp.endTime) {
              startTime = emp.startTime;
              endTime = emp.endTime;
            }
            
            assignments.push({
              work_date: day.date,
              employee_id: emp.employeeId,
              attraction_id: row.attractionId,
              start_time: startTime,
              end_time: endTime,
            });
          }
        }
      }

      if (assignments.length === 0) {
        alert('Нет данных для сохранения');
        setSaving(false);
        return;
      }

      // Удаляем старые записи на эти даты
      const dates = [...new Set(schedule.map(d => d.date))];
      for (const date of dates) {
        await dbService.deleteScheduleByDate(date);
      }

      // Массовое создание через DatabaseService
      const success = await dbService.bulkCreateScheduleAssignments(assignments);

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        console.log('[ScheduleGenerator] График сохранён:', assignments.length, 'записей');
      } else {
        throw new Error('Ошибка сохранения через DatabaseService');
      }

    } catch (err: any) {
      console.error('[ScheduleGenerator] Ошибка сохранения:', err);
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // БЛОК 8: Рендер (обновленный дизайн)
  // ============================================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-600 h-12 w-12 mx-auto" />
          <p className="text-gray-600 font-medium">Загрузка данных из базы...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Заголовок с градиентом */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Sparkles className="h-8 w-8" />
              Генератор графика 2.0
            </h1>
            <p className="text-indigo-100 mt-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Автоматическое составление расписания с ИИ-оптимизацией
            </p>
          </div>
          {isGenerated && (
            <button
              onClick={handleSaveSchedule}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:transform-none font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Сохранить график
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Панель параметров */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 space-y-8">
        
        {/* Основные параметры */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              Количество дней
            </label>
            <select
              value={daysCount}
              onChange={e => setDaysCount(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Мин. сотрудников
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={minStaffPerAttraction}
              onChange={e => setMinStaffPerAttraction(Number(e.target.value))}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">Дополнительно к требованиям БД</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" />
              Алгоритм
            </label>
            <select
              value={algorithm}
              onChange={e => setAlgorithm(e.target.value as AlgorithmType)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all bg-white"
            >
              <option value="combined">Комбинированный (оптимальный)</option>
              <option value="timeslot">Временные слоты (beta)</option>
            </select>
          </div>
        </div>

        {/* Выбор аттракционов */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              🎢 Аттракционы
              <span className="text-xs font-normal text-gray-500">
                ({selectedAttractionIds.size} из {attractions.length})
              </span>
            </label>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => setSelectedAttractionIds(new Set(attractions.map(a => a.id)))}
                className="text-indigo-600 hover:text-indigo-800 font-medium transition"
              >
                Все
              </button>
              <button
                onClick={() => setSelectedAttractionIds(new Set())}
                className="text-gray-400 hover:text-gray-600 font-medium transition"
              >
                Сбросить
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-xl">
            {attractions.map(attr => {
              const isSelected = selectedAttractionIds.has(attr.id);
              return (
                <button
                  key={attr.id}
                  onClick={() => {
                    setSelectedAttractionIds(prev => {
                      const next = new Set(prev);
                      next.has(attr.id) ? next.delete(attr.id) : next.add(attr.id);
                      return next;
                    });
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {attr.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Кнопка генерации */}
        <button
          onClick={generateSchedule}
          disabled={generating || selectedAttractionIds.size === 0}
          className="w-full flex justify-center items-center gap-3 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:transform-none"
        >
          {generating ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Генерация графика...
            </>
          ) : (
            <>
              <Wand2 className="h-6 w-6" />
              Сгенерировать график
            </>
          )}
        </button>
      </div>

      {/* Результат генерации */}
      {isGenerated && (
        <div className="space-y-6">
          
          {/* Сообщение об успешном сохранении */}
          {saveSuccess && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-md animate-pulse">
              <CheckSquare className="h-6 w-6 text-green-600" />
              <span className="text-green-800 font-semibold text-lg">
                График успешно сохранён в базе данных!
              </span>
            </div>
          )}

          {/* График по дням */}
          {schedule.map((day, idx) => (
            <div key={day.date} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              
              {/* Заголовок дня */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6" />
                  <div>
                    <div className="font-bold text-xl">
                      {format(parseISO(day.date), 'dd MMMM yyyy', { locale: ru })}
                    </div>
                    <div className="text-sm text-gray-300">
                      {format(parseISO(day.date), 'EEEE', { locale: ru })}
                    </div>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium">
                  {algorithm === 'combined' ? '🎯 Комбинированный' : '⏰ Временные слоты'}
                </div>
              </div>

              {/* Таблица аттракционов */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-8 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Аттракцион
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Сотрудники
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {day.rows.map(row => {
                      const hasDeficit = row.employees.length < row.minStaffRequired;
                      
                      return (
                        <tr key={row.attractionId} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex flex-col gap-2">
                              <div className="text-base font-bold text-gray-900">
                                {row.attractionName}
                              </div>
                              {hasDeficit && (
                                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5 border border-red-200 w-fit">
                                  <AlertCircle className="h-4 w-4" />
                                  Нужно минимум {row.minStaffRequired} чел.
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-wrap gap-2">
                              {row.employees.map(emp => (
                                <div
                                  key={emp.employeeId}
                                  className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md ${
                                    emp.isManuallyAdded
                                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 text-blue-900'
                                      : 'bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 text-gray-800'
                                  }`}
                                >
                                  <GripVertical className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <span className="font-semibold">{emp.employeeName}</span>
                                  {!emp.isFullDay && emp.startTime && emp.endTime && (
                                    <span className="text-xs bg-white/50 rounded-full px-2 py-0.5">
                                      {emp.startTime.slice(0, 5)}–{emp.endTime.slice(0, 5)}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => moveToUnassigned(day.date, row.attractionId, emp.employeeId)}
                                    className="ml-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Убрать из графика"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                              
                              {/* Кнопка добавления */}
                              <div className="relative inline-block">
                                <button
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:shadow-md transition-all"
                                  onMouseEnter={e => {
                                    const picker = e.currentTarget.nextElementSibling;
                                    if (picker) (picker as HTMLElement).style.display = 'block';
                                  }}
                                  onMouseLeave={e => {
                                    const picker = e.currentTarget.nextElementSibling;
                                    if (picker) (picker as HTMLElement).style.display = 'none';
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                  Добавить
                                </button>
                                
                                <div
                                  className="absolute z-20 left-0 top-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl p-3 min-w-64 hidden"
                                  style={{ display: 'none' }}
                                  onMouseEnter={e => (e.currentTarget.style.display = 'block')}
                                  onMouseLeave={e => (e.currentTarget.style.display = 'none')}
                                >
                                  {unassigned.length === 0 ? (
                                    <p className="text-sm text-gray-400 px-3 py-2 italic">
                                      Нет доступных сотрудников
                                    </p>
                                  ) : (
                                    <ul className="space-y-1 max-h-64 overflow-y-auto">
                                      {unassigned.map(emp => (
                                        <li key={emp.employeeId}>
                                          <button
                                            onClick={() => moveFromUnassigned(emp.employeeId, day.date, row.attractionId)}
                                            className="w-full text-left px-4 py-2.5 rounded-xl text-sm hover:bg-indigo-50 transition-colors flex items-center gap-3 group"
                                          >
                                            <Plus className="h-4 w-4 text-green-500 group-hover:scale-110 transition-transform" />
                                            <div className="flex-1">
                                              <div className="font-medium text-gray-900">
                                                {emp.employeeName}
                                              </div>
                                              {!emp.isFullDay && emp.startTime && (
                                                <div className="text-xs text-gray-500">
                                                  {emp.startTime.slice(0, 5)}–{emp.endTime?.slice(0, 5)}
                                                </div>
                                              )}
                                            </div>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Незадействованные сотрудники */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-3xl border-2 border-dashed border-orange-300 p-8 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-6 w-6 text-orange-600" />
              <h5 className="font-bold text-xl text-gray-800">
                Незадействованные сотрудники
              </h5>
              <span className="bg-orange-200 text-orange-800 text-sm font-bold rounded-full px-3 py-1">
                {unassigned.length}
              </span>
            </div>
            
            {unassigned.length === 0 ? (
              <p className="text-gray-500 italic text-center py-4">
                ✨ Все доступные сотрудники распределены по графику
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {unassigned.map(emp => (
                  <div
                    key={emp.employeeId}
                    className="flex items-center gap-3 bg-white border-2 border-orange-200 rounded-2xl px-5 py-3 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <span className="text-base font-semibold text-gray-900">
                      {emp.employeeName}
                    </span>
                    <span className="text-xs font-medium bg-orange-100 text-orange-700 rounded-full px-3 py-1">
                      {emp.isFullDay ? '📅 Полный день' : `⏰ ${emp.startTime?.slice(0, 5)}–${emp.endTime?.slice(0, 5)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
