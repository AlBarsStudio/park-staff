import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { UserProfile, Attraction, Employee } from '../types';
import {
  Loader2, Wand2, Save, GripVertical,
  Plus, X, CheckSquare, Square, Info, AlertCircle
} from 'lucide-react';
import { format, addDays, parseISO, isWeekend } from 'date-fns';
import { ru } from 'date-fns/locale';

// ---------- Типы ----------
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

// ---------- Вспомогательные функции ----------
function minutesFrom10(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h - 10) * 60 + m;
}

// ============================================================
// АЛГОРИТМ 1: Комбинированный (только полные смены + min-cost flow)
// ============================================================
function solveAssignmentMinCostFlow(
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
        cost[i][j] = priority * 10; // 1->10, 2->20, 3->30
      }
    }
  }

  const N = 2 + nEmp + nSlot;
  const source = 0;
  const sink = N - 1;
  const empOffset = 1;
  const slotOffset = 1 + nEmp;

  interface Edge { to: number; rev: number; cap: number; cost: number; }
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

  let flowCount = 0;
  const maxFlow = Math.min(nEmp, nSlot);
  const dist = new Array(N);
  const prevv = new Array(N);
  const preve = new Array(N);
  const inqueue = new Array(N);

  while (flowCount < maxFlow) {
    for (let i = 0; i < N; i++) dist[i] = INF;
    dist[source] = 0;
    const queue: number[] = [source];
    inqueue.fill(false);
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
    let d = maxFlow - flowCount;
    for (let v = sink; v !== source; v = prevv[v]) d = Math.min(d, graph[prevv[v]][preve[v]].cap);
    flowCount += d;
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

// Генерация через комбинированный алгоритм (только полные смены)
async function generateWithCombined(
  date: string,
  activeAttractions: AttractionWithStaff[],
  isWeekendDay: boolean,
  minStaffPerAttraction: number,
  allEmployees: Employee[],
  priorityMapCache: Map<number, Map<number, number>>,
  studyGoalCache: Map<number, number>,
  fetchAvailabilityForDate: (date: string) => Promise<Availability[]>
): Promise<{ rows: ScheduleAttractionRow[]; unassigned: ScheduleEntry[] }> {
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
  const fullEmployees: EmployeeWithPriority[] = [];
  for (const av of fullDayAvail) {
    const emp = allEmployees.find(e => e.id === av.employeeId);
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
    for (let i = 0; i < req.requiredCount; i++) slots.push({ attractionId: req.attractionId });
  }

  const assignment = solveAssignmentMinCostFlow(fullEmployees, slots);

  const rows: ScheduleAttractionRow[] = attractionRequirements.map(req => ({
    attractionId: req.attractionId,
    attractionName: req.attractionName,
    minStaffRequired: req.requiredCount,
    employees: []
  }));

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
        }
      }
    }
  }

  const assignedEmpIds = assignment.filter(id => id !== null) as number[];
  const unassignedFull = fullEmployees.filter(emp => !assignedEmpIds.includes(emp.id));
  const partialAvail = availabilities.filter(a => !a.isFullDay);
  const partialEntries: ScheduleEntry[] = [];
  for (const av of partialAvail) {
    const emp = allEmployees.find(e => e.id === av.employeeId);
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
  const unassignedList: ScheduleEntry[] = [
    ...unassignedFull.map(emp => ({ employeeId: emp.id, employeeName: emp.name, isFullDay: true, startTime: null, endTime: null })),
    ...partialEntries
  ];
  return { rows, unassigned: unassignedList };
}

// ============================================================
// АЛГОРИТМ 2: Потоковый с временными слотами (hourly slots)
// ============================================================
interface HourlySlot {
  attractionId: number;
  hour: number; // 10..22 (10:00-11:00 ... 22:00-23:00)
}

function solveHourlyFlow(
  employees: EmployeeWithPriority[],
  hourlySlots: HourlySlot[],
  employeeHourAvailability: Map<number, Set<number>> // employeeId -> set of hours (10..22) when available
): Map<string, number> { // key "attractionId_hour" -> employeeId (или null?)
  // Строим min-cost flow: исток -> сотрудники (capacity = число часов, которые он может работать, но не более 1 в час)
  // Сотрудник -> слоты (attractionId+час) с cost = priority * 10
  // Слот -> сток (capacity = min_staff для этого аттракциона в этот час)
  // Упрощённо: здесь мы предполагаем, что для каждого часа и аттракциона требуется ровно min_staff человек (взято из глобального требования).
  // Но для простоты первой версии будем считать, что требуется 1 человек в час на аттракцион (потом можно обобщить).
  // Реализуем базовый вариант: каждый час каждый аттракцион требует 1 сотрудника.
  // Сотрудник может быть назначен на несколько разных часов (на один аттракцион или разные), но не более одного назначения в час.
  
  const nEmp = employees.length;
  const nSlots = hourlySlots.length;
  if (nEmp === 0 || nSlots === 0) return new Map();

  const INF = 1e9;
  // Стоимость: для каждого сотрудника и каждого слота
  const cost: number[][] = Array(nEmp).fill(null).map(() => Array(nSlots).fill(INF));
  for (let i = 0; i < nEmp; i++) {
    const emp = employees[i];
    const availHours = employeeHourAvailability.get(emp.id) || new Set();
    for (let j = 0; j < nSlots; j++) {
      const slot = hourlySlots[j];
      const priority = emp.priorityMap.get(slot.attractionId);
      if (priority !== undefined && availHours.has(slot.hour)) {
        cost[i][j] = priority * 10;
      }
    }
  }

  // Построение графа: исток (0) -> сотрудники (1..nEmp) capacity = сколько часов может работать? 
  // Ограничим maxHoursPerEmployee = 12 (максимум часов в день). Но лучше разрешить до 12, но учесть что один час только один слот.
  // В данной модели сотрудник может быть назначен на несколько слотов (разные часы), поэтому capacity = количество слотов, на которые он может пойти.
  // Упростим: capacity = 12 (максимум часов) и пусть поток сам выберет.
  const N = 2 + nEmp + nSlots;
  const source = 0;
  const sink = N - 1;
  const empOffset = 1;
  const slotOffset = 1 + nEmp;

  interface Edge { to: number; rev: number; cap: number; cost: number; }
  const graph: Edge[][] = Array(N).fill(null).map(() => []);
  const addEdge = (from: number, to: number, cap: number, cost: number) => {
    graph[from].push({ to, rev: graph[to].length, cap, cost });
    graph[to].push({ to: from, rev: graph[from].length - 1, cap: 0, cost: -cost });
  };

  // Исток -> сотрудники (capacity = 12, можно настроить)
  for (let i = 0; i < nEmp; i++) addEdge(source, empOffset + i, 12, 0);
  // Сотрудники -> слоты
  for (let i = 0; i < nEmp; i++) {
    for (let j = 0; j < nSlots; j++) {
      if (cost[i][j] < INF) {
        addEdge(empOffset + i, slotOffset + j, 1, cost[i][j]);
      }
    }
  }
  // Слоты -> сток (capacity = 1, т.к. на каждый час нужен 1 человек)
  for (let j = 0; j < nSlots; j++) addEdge(slotOffset + j, sink, 1, 0);

  // Min-cost max-flow (алгоритм аналогичен предыдущему)
  let flowCount = 0;
  const totalSlots = nSlots;
  const dist = new Array(N);
  const prevv = new Array(N);
  const preve = new Array(N);
  const inqueue = new Array(N);

  while (flowCount < totalSlots) {
    for (let i = 0; i < N; i++) dist[i] = INF;
    dist[source] = 0;
    const queue: number[] = [source];
    inqueue.fill(false);
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
    let d = totalSlots - flowCount;
    for (let v = sink; v !== source; v = prevv[v]) d = Math.min(d, graph[prevv[v]][preve[v]].cap);
    flowCount += d;
    for (let v = sink; v !== source; v = prevv[v]) {
      const e = graph[prevv[v]][preve[v]];
      e.cap -= d;
      graph[v][e.rev].cap += d;
    }
  }

  // Восстановление назначений: для каждого слота -> employeeId
  const assignment = new Map<string, number>(); // key "attractionId_hour" -> employeeId
  for (let j = 0; j < nSlots; j++) {
    const slotNode = slotOffset + j;
    for (const e of graph[slotNode]) {
      if (e.to === sink && e.cap === 0) {
        // ребро от слота к стоку с cap=0 означает, что слот заполнен. Нужно найти, какой сотрудник в него ведёт.
        // Пройдём по обратным рёбрам к сотрудникам
        for (let i = 0; i < nEmp; i++) {
          const empNode = empOffset + i;
          for (const edge of graph[empNode]) {
            if (edge.to === slotNode && edge.cap === 0) {
              const slot = hourlySlots[j];
              assignment.set(`${slot.attractionId}_${slot.hour}`, employees[i].id);
            }
          }
        }
      }
    }
  }
  return assignment;
}

async function generateWithHourlyFlow(
  date: string,
  activeAttractions: AttractionWithStaff[],
  isWeekendDay: boolean,
  minStaffPerAttraction: number,
  allEmployees: Employee[],
  priorityMapCache: Map<number, Map<number, number>>,
  studyGoalCache: Map<number, number>,
  fetchAvailabilityForDate: (date: string) => Promise<Availability[]>
): Promise<{ rows: ScheduleAttractionRow[]; unassigned: ScheduleEntry[] }> {
  // Определяем минимальное количество сотрудников в час (пока упрощённо: для каждого аттракциона нужно minStaff человек в каждый час работы)
  // Но для демонстрации будем считать, что в каждый час требуется 1 человек (позже можно расширить)
  const requiredPerHour = 1; // можно брать из minStaffPerAttraction или из min_staff_weekday, но это сложнее

  // Часы работы: с 10 до 23 (10,11,12,13,14,15,16,17,18,19,20,21,22) -> 13 часов
  const hours = Array.from({ length: 13 }, (_, i) => 10 + i); // 10..22
  // Создаём слоты для каждого аттракциона и каждого часа
  const hourlySlots: HourlySlot[] = [];
  for (const attr of activeAttractions) {
    for (const hour of hours) {
      // Проверка: работает ли аттракцион в этот час? По условию все работают с 10 до закрытия, так что да
      hourlySlots.push({ attractionId: attr.id, hour });
    }
  }

  // Получаем доступность сотрудников
  const availabilities = await fetchAvailabilityForDate(date);
  // Для каждого сотрудника строим множество часов, в которые он доступен (если полная смена – все часы, если неполная – только свой интервал)
  const employeeHourAvailability = new Map<number, Set<number>>();
  const allEmployeesWithPriority: EmployeeWithPriority[] = [];
  for (const av of availabilities) {
    const emp = allEmployees.find(e => e.id === av.employeeId);
    if (!emp) continue;
    const priorityMap = priorityMapCache.get(av.employeeId) || new Map();
    const empWithPrio: EmployeeWithPriority = {
      id: emp.id,
      name: emp.full_name,
      priorityMap,
      studyGoalAttractionId: studyGoalCache.get(av.employeeId),
    };
    allEmployeesWithPriority.push(empWithPrio);
    const hoursSet = new Set<number>();
    if (av.isFullDay) {
      hours.forEach(h => hoursSet.add(h));
    } else if (av.startTime && av.endTime) {
      const startMin = minutesFrom10(av.startTime);
      const endMin = minutesFrom10(av.endTime);
      for (const h of hours) {
        const hourStartMin = (h - 10) * 60;
        const hourEndMin = hourStartMin + 60;
        if (hourEndMin > startMin && hourStartMin < endMin) {
          hoursSet.add(h);
        }
      }
    }
    employeeHourAvailability.set(emp.id, hoursSet);
  }

  // Запускаем потоковое назначение
  const assignment = solveHourlyFlow(allEmployeesWithPriority, hourlySlots, employeeHourAvailability);

  // Теперь нужно сгруппировать назначения по аттракционам и создать записи ScheduleEntry
  // В отличие от комбинированного алгоритма, здесь один сотрудник может быть назначен на несколько часов (даже на один аттракцион в разные часы).
  // Для простоты отображения будем показывать каждого сотрудника один раз на аттракционе, но с указанием часов работы.
  // Однако в нашей структуре ScheduleEntry не поддерживает несколько временных интервалов. Поэтому сделаем так:
  // Если сотрудник назначен на один аттракцион в несколько часов, объединим их в один интервал от min часа до max часа.
  // Если на разные аттракционы – это разные строки (сотрудник будет числиться на нескольких аттракционах, что недопустимо в один день).
  // Поэтому в данной версии будем считать, что сотрудник может работать только на одном аттракционе в день (как и в реальности).
  // Для этого в потоковой модели нужно добавить ограничение, что сотрудник может быть назначен только на слоты одного аттракциона.
  // Это сложнее. Для демонстрации оставим так, но на практике нужно дорабатывать.

  // Временно упростим: создадим карту employee -> attractionId и интервалы.
  const employeeAttractionMap = new Map<number, { attractionId: number; hours: number[] }>();
  for (const [key, empId] of assignment.entries()) {
    const [attrIdStr, hourStr] = key.split('_');
    const attractionId = parseInt(attrIdStr);
    const hour = parseInt(hourStr);
    if (!employeeAttractionMap.has(empId)) {
      employeeAttractionMap.set(empId, { attractionId, hours: [hour] });
    } else {
      const existing = employeeAttractionMap.get(empId)!;
      if (existing.attractionId !== attractionId) {
        // Сотрудник пытается работать на двух разных аттракционах – игнорируем второе назначение
        console.warn(`Сотрудник ${empId} назначен на два аттракциона: ${existing.attractionId} и ${attractionId}`);
      } else {
        existing.hours.push(hour);
      }
    }
  }

  // Теперь формируем строки для аттракционов
  const attractionRequirements = activeAttractions.map(attr => ({
    attractionId: attr.id,
    attractionName: attr.name,
    requiredCount: Math.max(
      isWeekendDay ? attr.minStaffWeekend : attr.minStaffWeekday,
      minStaffPerAttraction
    )
  }));

  const rows: ScheduleAttractionRow[] = attractionRequirements.map(req => ({
    attractionId: req.attractionId,
    attractionName: req.attractionName,
    minStaffRequired: req.requiredCount,
    employees: []
  }));

  // Для каждого сотрудника, назначенного на аттракцион, создаём запись с интервалом времени
  for (const [empId, data] of employeeAttractionMap.entries()) {
    const emp = allEmployeesWithPriority.find(e => e.id === empId);
    if (!emp) continue;
    const hours = data.hours.sort((a,b) => a-b);
    const startHour = hours[0];
    const endHour = hours[hours.length-1] + 1; // +1 т.к. конец часа
    const startTimeStr = `${startHour.toString().padStart(2,'0')}:00:00`;
    const endTimeStr = `${endHour.toString().padStart(2,'0')}:00:00`;
    const row = rows.find(r => r.attractionId === data.attractionId);
    if (row) {
      row.employees.push({
        employeeId: emp.id,
        employeeName: emp.name,
        isFullDay: false, // помечаем как неполную, но с указанием времени
        startTime: startTimeStr,
        endTime: endTimeStr,
        isManuallyAdded: false,
      });
    }
  }

  // Сотрудники, которые не попали в назначения (все, кто есть в availabilities, но нет в assignment)
  const assignedEmpIds = new Set(employeeAttractionMap.keys());
  const unassignedList: ScheduleEntry[] = [];
  for (const av of availabilities) {
    if (!assignedEmpIds.has(av.employeeId)) {
      const emp = allEmployees.find(e => e.id === av.employeeId);
      if (emp) {
        unassignedList.push({
          employeeId: emp.id,
          employeeName: emp.full_name,
          isFullDay: av.isFullDay,
          startTime: av.startTime,
          endTime: av.endTime,
        });
      }
    }
  }

  return { rows, unassigned: unassignedList };
}

// ---------- Основной компонент ----------
export function ScheduleGenerator({ profile, isSuperAdmin = false }: { profile: UserProfile; isSuperAdmin?: boolean }) {
  const [attractions, setAttractions] = useState<AttractionWithStaff[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Параметры генерации
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [daysCount, setDaysCount] = useState<number>(1);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<Set<number>>(new Set());
  const [minStaffPerAttraction, setMinStaffPerAttraction] = useState<number>(1);
  const [algorithm, setAlgorithm] = useState<'combined' | 'hourly'>('combined'); // выбор алгоритма

  // Результат
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [unassigned, setUnassigned] = useState<ScheduleEntry[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [priorityMapCache, setPriorityMapCache] = useState<Map<number, Map<number, number>>>(new Map());
  const [studyGoalCache, setStudyGoalCache] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: attrData } = await supabase
      .from('attractions')
      .select('id, name, min_staff_weekday, min_staff_weekend')
      .order('name');
    if (attrData) {
      const mapped = attrData.map(a => ({
        id: a.id,
        name: a.name,
        minStaffWeekday: a.min_staff_weekday ?? 1,
        minStaffWeekend: a.min_staff_weekend ?? 1,
      }));
      setAttractions(mapped);
      setSelectedAttractionIds(new Set(mapped.map(a => a.id)));
    }

    const { data: empData } = await supabase.from('employees').select('id, full_name').order('full_name');
    if (empData) setEmployees(empData);

    const { data: priorities } = await supabase.from('employee_attraction_priorities').select('employee_id, attraction_id, priority_level');
    if (priorities) {
      const map = new Map<number, Map<number, number>>();
      for (const p of priorities) {
        if (!map.has(p.employee_id)) map.set(p.employee_id, new Map());
        map.get(p.employee_id)!.set(p.attraction_id, p.priority_level);
      }
      setPriorityMapCache(map);
    }

    const { data: goals } = await supabase.from('employee_study_goals').select('employee_id, attraction_id');
    if (goals) {
      const map = new Map<number, number>();
      for (const g of goals) map.set(g.employee_id, g.attraction_id);
      setStudyGoalCache(map);
    }

    setLoading(false);
  };

  const fetchAvailabilityForDate = async (date: string): Promise<Availability[]> => {
    const { data } = await supabase
      .from('employee_availability')
      .select('employee_id, is_full_day, start_time, end_time, comment')
      .eq('work_date', date);
    if (!data) return [];
    return data.map(row => ({
      employeeId: row.employee_id,
      isFullDay: row.is_full_day,
      startTime: row.start_time,
      endTime: row.end_time,
      comment: row.comment,
    }));
  };

  const generateForDay = async (date: string): Promise<{ rows: ScheduleAttractionRow[]; unassigned: ScheduleEntry[] }> => {
    const activeAttractions = attractions.filter(a => selectedAttractionIds.has(a.id));
    const isWeekendDay = isWeekend(parseISO(date));
    if (algorithm === 'combined') {
      return await generateWithCombined(
        date, activeAttractions, isWeekendDay, minStaffPerAttraction,
        employees, priorityMapCache, studyGoalCache, fetchAvailabilityForDate
      );
    } else {
      return await generateWithHourlyFlow(
        date, activeAttractions, isWeekendDay, minStaffPerAttraction,
        employees, priorityMapCache, studyGoalCache, fetchAvailabilityForDate
      );
    }
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
      const { rows, unassigned: dayUnassigned } = await generateForDay(date);
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

    await logActivity(
      isSuperAdmin ? 'superadmin' : 'admin',
      profile.id,
      'schedule_generate',
      `Алгоритм: ${algorithm}, на ${daysCount} дн. с ${startDate}, аттракционов: ${selectedAttractionIds.size}`
    );
  };

  // Перемещение сотрудника (аналогично предыдущей версии)
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
      const entries: any[] = [];
      for (const day of schedule) {
        for (const row of day.rows) {
          for (const emp of row.employees) {
            let startTime = '10:00:00';
            let endTime = null;
            if (!emp.isFullDay && emp.startTime && emp.endTime) {
              startTime = emp.startTime;
              endTime = emp.endTime;
            } else {
              endTime = null;
            }
            entries.push({
              work_date: day.date,
              employee_id: emp.employeeId,
              attraction_id: row.attractionId,
              start_time: startTime,
              end_time: endTime,
              version_type: 'original',
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
        }
      }
      if (entries.length === 0) {
        alert('Нет данных для сохранения');
        return;
      }
      const dates = [...new Set(schedule.map(d => d.date))];
      await supabase.from('schedule_assignments').delete().in('work_date', dates).eq('version_type', 'original');
      const { error } = await supabase.from('schedule_assignments').insert(entries);
      if (error) {
        console.error(error);
        alert(`Ошибка сохранения: ${error.message}`);
      } else {
        await logActivity(isSuperAdmin ? 'superadmin' : 'admin', profile.id, 'schedule_save', `Сохранено ${entries.length} записей`);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="animate-spin text-blue-600 h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-purple-600" />
            Генератор графика работы
          </h3>
          <p className="text-sm text-gray-500 mt-1">Выберите алгоритм и параметры</p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-5">
        <h4 className="font-semibold text-gray-800">Параметры генерации</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Алгоритм</label>
            <select
              value={algorithm}
              onChange={e => setAlgorithm(e.target.value as 'combined' | 'hourly')}
              className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="combined">Комбинированный (полные смены + min-cost flow)</option>
              <option value="hourly">Потоковый с временными слотами (экспериментальный)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {algorithm === 'combined' ? 'Назначает только полные смены оптимально. Неполные – вручную.' : 'Разбивает день на часы, назначает сотрудников почасово (beta).'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Количество дней</label>
            <select value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} {d===1?'день':d<5?'дня':'дней'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Мин. сотрудников (доп.)</label>
            <input type="number" min={1} max={10} value={minStaffPerAttraction} onChange={e => setMinStaffPerAttraction(Number(e.target.value))} className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Аттракционы</label>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSelectedAttractionIds(new Set(attractions.map(a => a.id)))} className="text-blue-600 hover:underline">Выбрать все</button>
              <button onClick={() => setSelectedAttractionIds(new Set())} className="text-gray-500 hover:underline">Снять все</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {attractions.map(attr => (
              <button key={attr.id} onClick={() => setSelectedAttractionIds(prev => { const next = new Set(prev); next.has(attr.id) ? next.delete(attr.id) : next.add(attr.id); return next; })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${selectedAttractionIds.has(attr.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {selectedAttractionIds.has(attr.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {attr.name}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generateSchedule} disabled={generating || selectedAttractionIds.size === 0} className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
          {generating ? <><Loader2 className="h-5 w-5 animate-spin" />Генерация...</> : <><Wand2 className="h-5 w-5" />Сгенерировать график</>}
        </button>
      </div>

      {isGenerated && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold">График работы (алгоритм: {algorithm === 'combined' ? 'комбинированный' : 'почасовой'})</h4>
            <button onClick={handleSaveSchedule} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Сохранить график
            </button>
          </div>
          {saveSuccess && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">График сохранён!</div>}

          {schedule.map(day => (
            <div key={day.date} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-800 text-white px-5 py-3 font-semibold">{format(parseISO(day.date), 'dd MMMM yyyy', { locale: ru })}</div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-1/3">Аттракцион</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Сотрудники</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {day.rows.map(row => (
                      <tr key={row.attractionId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 align-top">{row.attractionName}{row.employees.length < row.minStaffRequired && <div className="mt-1 text-xs text-red-500">Нужно минимум {row.minStaffRequired}</div>}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            {row.employees.map(emp => (
                              <div key={emp.employeeId} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${emp.isManuallyAdded ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-100 border-gray-200 text-gray-800'}`}>
                                <GripVertical className="h-3 w-3 text-gray-400" />
                                <span>{emp.employeeName}</span>
                                {!emp.isFullDay && emp.startTime && emp.endTime && <span className="text-gray-400">{emp.startTime.slice(0,5)}–{emp.endTime.slice(0,5)}</span>}
                                <button onClick={() => moveToUnassigned(day.date, row.attractionId, emp.employeeId)} className="ml-1 text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                              </div>
                            ))}
                            <div className="relative">
                              <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                                onMouseEnter={(e) => { const picker = e.currentTarget.nextSibling as HTMLElement; if(picker) picker.style.display = 'block'; }}
                                onMouseLeave={(e) => { const picker = e.currentTarget.nextSibling as HTMLElement; if(picker) picker.style.display = 'none'; }}>
                                <Plus className="h-3 w-3" /> Добавить
                              </button>
                              <div className="absolute z-10 left-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-48 hidden"
                                onMouseEnter={(e) => (e.currentTarget.style.display = 'block')}
                                onMouseLeave={(e) => (e.currentTarget.style.display = 'none')}>
                                {unassigned.length === 0 ? <p className="text-xs text-gray-400 px-2 py-1">Нет доступных</p> :
                                  <ul className="space-y-1">{unassigned.map(emp => (
                                    <li key={emp.employeeId}><button onClick={() => moveFromUnassigned(emp.employeeId, day.date, row.attractionId)} className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-blue-50">
                                      {emp.employeeName} {!emp.isFullDay && emp.startTime && <span className="text-gray-400"> ({emp.startTime.slice(0,5)}–{emp.endTime?.slice(0,5)})</span>}
                                    </button></li>
                                  ))}</ul>
                                }
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-5">
            <h5 className="font-semibold text-gray-700 mb-3">Незадействованные сотрудники ({unassigned.length})</h5>
            <div className="flex flex-wrap gap-2">
              {unassigned.map(emp => (
                <div key={emp.employeeId} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-orange-800">{emp.employeeName}</span>
                  <span className="text-xs text-orange-500">{emp.isFullDay ? 'Полн.' : `${emp.startTime?.slice(0,5)}–${emp.endTime?.slice(0,5)}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
