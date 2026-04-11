/*
 * =====================================================================
 * ГЕНЕРАТОР ГРАФИКА - ВЕРСИЯ 2.0
 * Интеграция с DatabaseService, улучшенные алгоритмы, современный UI
 * =====================================================================
 */

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
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { cn } from '../utils/cn';

// ============================================================
// Типы данных
// ============================================================
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
// Вспомогательные функции
// ============================================================

const WORK_START_MIN = 0;
const WORK_END_MIN = 780;

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
        let baseCost = priority * 10;
        if (emp.studyGoalAttractionId === attractionId) {
          baseCost -= 5;
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
// Основной компонент
// ============================================================

export function ScheduleGenerator({ profile, isSuperAdmin = false }: { profile: UserProfile; isSuperAdmin?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<AttractionWithStaff[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysCount, setDaysCount] = useState<number>(1);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<Set<number>>(new Set());
  const [minStaffPerAttraction, setMinStaffPerAttraction] = useState<number>(1);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('combined');

  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [unassigned, setUnassigned] = useState<ScheduleEntry[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [priorityMapCache, setPriorityMapCache] = useState<Map<number, Map<number, number>>>(new Map());
  const [studyGoalCache, setStudyGoalCache] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    
    try {
      if (!dbService.isReady()) {
        console.error('[ScheduleGenerator] DatabaseService не готов');
        alert('Ошибка: Сервис базы данных не инициализирован');
        setLoading(false);
        return;
      }

      const attractionsData = dbService.getAttractions();
      const mapped = attractionsData.map(a => ({
        id: a.id,
        name: a.name,
        minStaffWeekday: a.min_staff_weekday ?? 1,
        minStaffWeekend: a.min_staff_weekend ?? 1,
      }));
      setAttractions(mapped);
      setSelectedAttractionIds(new Set(mapped.map(a => a.id)));

      const employeesData = dbService.getEmployees();
      setEmployees(employeesData);

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

    const slots: { attractionId: number }[] = [];
    for (const req of attractionRequirements) {
      for (let i = 0; i < req.requiredCount; i++) {
        slots.push({ attractionId: req.attractionId });
      }
    }

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
  };

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

      const dates = [...new Set(schedule.map(d => d.date))];
      for (const date of dates) {
        await dbService.deleteScheduleByDate(date);
      }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-12 w-12 mx-auto" style={{ color: 'var(--primary)' }} />
          <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
            Загрузка данных из базы...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Заголовок */}
      <Card 
        className="p-6"
        style={{ 
          background: 'linear-gradient(135deg, var(--primary) 0%, #9333ea 50%, #ec4899 100%)',
          color: 'white',
          border: 'none'
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Sparkles className="h-8 w-8" />
              Генератор графика 2.0
            </h1>
            <p className="opacity-90 mt-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Автоматическое составление расписания с ИИ-оптимизацией
            </p>
          </div>
          {isGenerated && (
            <Button
              variant="secondary"
              onClick={handleSaveSchedule}
              loading={saving}
              icon={<Save className="h-5 w-5" />}
              className="shadow-lg"
            >
              Сохранить график
            </Button>
          )}
        </div>
      </Card>

      {/* Панель параметров */}
      <Card className="p-8 space-y-8">
        
        {/* Основные параметры */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Calendar className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Clock className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Количество дней
            </label>
            <select
              value={daysCount}
              onChange={e => setDaysCount(Number(e.target.value))}
              className="input w-full"
            >
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Users className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Мин. сотрудников
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={minStaffPerAttraction}
              onChange={e => setMinStaffPerAttraction(Number(e.target.value))}
              className="input w-full"
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Дополнительно к требованиям БД
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Filter className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Алгоритм
            </label>
            <select
              value={algorithm}
              onChange={e => setAlgorithm(e.target.value as AlgorithmType)}
              className="input w-full"
            >
              <option value="combined">Комбинированный (оптимальный)</option>
              <option value="timeslot">Временные слоты (beta)</option>
            </select>
          </div>
        </div>

        {/* Выбор аттракционов */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              🎢 Аттракционы
              <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                ({selectedAttractionIds.size} из {attractions.length})
              </span>
            </label>
            <div className="flex gap-3 text-sm">
              <button
                onClick={() => setSelectedAttractionIds(new Set(attractions.map(a => a.id)))}
                className="font-medium transition"
                style={{ color: 'var(--primary)' }}
              >
                Все
              </button>
              <button
                onClick={() => setSelectedAttractionIds(new Set())}
                className="font-medium transition"
                style={{ color: 'var(--text-subtle)' }}
              >
                Сбросить
              </button>
            </div>
          </div>
          
          <div 
            className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 rounded-xl"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
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
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    isSelected && 'scale-105 shadow-md'
                  )}
                  style={{
                    background: isSelected 
                      ? 'linear-gradient(135deg, var(--primary) 0%, #9333ea 100%)'
                      : 'var(--surface)',
                    color: isSelected ? 'white' : 'var(--text)',
                    border: isSelected ? 'none' : '2px solid var(--border)'
                  }}
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
        <Button
          onClick={generateSchedule}
          disabled={generating || selectedAttractionIds.size === 0}
          loading={generating}
          icon={<Wand2 className="h-6 w-6" />}
          className="w-full py-4 text-lg font-bold shadow-lg"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #9333ea 50%, #ec4899 100%)',
            color: 'white'
          }}
        >
          Сгенерировать график
        </Button>
      </Card>

      {/* Результат */}
      {isGenerated && (
        <div className="space-y-6">
          
          {/* Успешное сохранение */}
          {saveSuccess && (
            <Card 
              className="px-6 py-4 flex items-center gap-3 shadow-md animate-pulse"
              style={{ 
                background: 'linear-gradient(135deg, var(--success-light) 0%, var(--success-light) 100%)',
                border: '2px solid var(--success)'
              }}
            >
              <CheckSquare className="h-6 w-6" style={{ color: 'var(--success)' }} />
              <span className="font-semibold text-lg" style={{ color: 'var(--success)' }}>
                График успешно сохранён в базе данных!
              </span>
            </Card>
          )}

          {/* График по дням */}
          {schedule.map((day) => (
            <Card key={day.date} padding="none" className="overflow-hidden">
              
              {/* Заголовок дня */}
              <div 
                className="px-8 py-5 flex items-center justify-between text-white"
                style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6" />
                  <div>
                    <div className="font-bold text-xl">
                      {format(parseISO(day.date), 'dd MMMM yyyy', { locale: ru })}
                    </div>
                    <div className="text-sm opacity-75">
                      {format(parseISO(day.date), 'EEEE', { locale: ru })}
                    </div>
                  </div>
                </div>
                <Badge 
                  variant="neutral" 
                  className="bg-white/20 backdrop-blur-sm text-white border-none"
                >
                  {algorithm === 'combined' ? '🎯 Комбинированный' : '⏰ Временные слоты'}
                </Badge>
              </div>

              {/* Таблица */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y" style={{ borderColor: 'var(--border)' }}>
                  <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th className="px-8 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                        Аттракцион
                      </th>
                      <th className="px-8 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                        Сотрудники
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {day.rows.map(row => {
                      const hasDeficit = row.employees.length < row.minStaffRequired;
                      
                      return (
                        <tr 
                          key={row.attractionId} 
                          className="transition-colors"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex flex-col gap-2">
                              <div className="text-base font-bold" style={{ color: 'var(--text)' }}>
                                {row.attractionName}
                              </div>
                              {hasDeficit && (
                                <div 
                                  className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 border w-fit"
                                  style={{ 
                                    backgroundColor: 'var(--error-light)',
                                    color: 'var(--error)',
                                    borderColor: 'var(--error)'
                                  }}
                                >
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
                                  className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md border-2"
                                  style={{
                                    background: emp.isManuallyAdded
                                      ? 'linear-gradient(135deg, var(--info-light) 0%, var(--info-light) 100%)'
                                      : 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-tertiary) 100%)',
                                    borderColor: emp.isManuallyAdded ? 'var(--info)' : 'var(--border)',
                                    color: emp.isManuallyAdded ? 'var(--info)' : 'var(--text)'
                                  }}
                                >
                                  <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-subtle)' }} />
                                  <span className="font-semibold">{emp.employeeName}</span>
                                  {!emp.isFullDay && emp.startTime && emp.endTime && (
                                    <span className="text-xs bg-white/50 rounded-full px-2 py-0.5">
                                      {emp.startTime.slice(0, 5)}–{emp.endTime.slice(0, 5)}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => moveToUnassigned(day.date, row.attractionId, emp.employeeId)}
                                    className="ml-1 opacity-0 group-hover:opacity-100 transition-all"
                                    style={{ color: 'var(--text-subtle)' }}
                                    title="Убрать из графика"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                              
                              {/* Кнопка добавления */}
                              <div className="relative inline-block">
                                <button
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                                  style={{
                                    background: 'linear-gradient(135deg, var(--success-light) 0%, var(--success-light) 100%)',
                                    borderColor: 'var(--success)',
                                    color: 'var(--success)'
                                  }}
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
                                  className="absolute z-20 left-0 top-full mt-2 rounded-2xl shadow-2xl p-3 min-w-64 hidden"
                                  style={{ 
                                    display: 'none',
                                    backgroundColor: 'var(--surface)',
                                    border: '2px solid var(--border)'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.display = 'block')}
                                  onMouseLeave={e => (e.currentTarget.style.display = 'none')}
                                >
                                  {unassigned.length === 0 ? (
                                    <p className="text-sm px-3 py-2 italic" style={{ color: 'var(--text-subtle)' }}>
                                      Нет доступных сотрудников
                                    </p>
                                  ) : (
                                    <ul className="space-y-1 max-h-64 overflow-y-auto">
                                      {unassigned.map(emp => (
                                        <li key={emp.employeeId}>
                                          <button
                                            onClick={() => moveFromUnassigned(emp.employeeId, day.date, row.attractionId)}
                                            className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-3 group"
                                            style={{ color: 'var(--text)' }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                          >
                                            <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" style={{ color: 'var(--success)' }} />
                                            <div className="flex-1">
                                              <div className="font-medium">
                                                {emp.employeeName}
                                              </div>
                                              {!emp.isFullDay && emp.startTime && (
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
            </Card>
          ))}

          {/* Незадействованные */}
          <Card 
            className="p-8"
            style={{ 
              background: 'linear-gradient(135deg, var(--warning-light) 0%, var(--warning-light) 100%)',
              border: '2px dashed var(--warning)'
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-6 w-6" style={{ color: 'var(--warning)' }} />
              <h5 className="font-bold text-xl" style={{ color: 'var(--text)' }}>
                Незадействованные сотрудники
              </h5>
              <Badge variant="warning">{unassigned.length}</Badge>
            </div>
            
            {unassigned.length === 0 ? (
              <p className="italic text-center py-4" style={{ color: 'var(--text-muted)' }}>
                ✨ Все доступные сотрудники распределены по графику
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {unassigned.map(emp => (
                  <div
                    key={emp.employeeId}
                    className="flex items-center gap-3 border-2 rounded-2xl px-5 py-3 shadow-md hover:shadow-lg transition-shadow"
                    style={{ 
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--warning)'
                    }}
                  >
                    <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                      {emp.employeeName}
                    </span>
                    <Badge variant="warning" className="text-xs">
                      {emp.isFullDay ? '📅 Полный день' : `⏰ ${emp.startTime?.slice(0, 5)}–${emp.endTime?.slice(0, 5)}`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
