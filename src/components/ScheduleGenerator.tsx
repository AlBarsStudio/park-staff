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
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { UserProfile, Attraction, Employee } from '../types';
import {
  Loader2, Wand2, Save, GripVertical,
  Plus, X, CheckSquare, Square, Info, AlertCircle, Calendar,
  Users, Filter, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { format, addDays, parseISO, isWeekend } from 'date-fns';
import { ru } from 'date-fns/locale';

// Типы данных
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

// Тип алгоритма
type AlgorithmType = 'combined' | 'timeslot';

// ============================================================
// БЛОК 2: Вспомогательные функции (математика, преобразования, покрытие интервалов)
// Описание: Функции для работы с временем, матрицами, потоками, а также покрытие дня неполными сменами.
// При изменении: заменять целиком при изменении логики назначения.
// ============================================================

const WORK_START_MIN = 0;      // 10:00
const WORK_END_MIN = 780;      // 23:00 (13 часов * 60)
const HOURS = Array.from({ length: 13 }, (_, i) => i); // 0..12 (10:00..23:00)

function minutesFrom10(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h - 10) * 60 + m;
}

// Проверяет, можно ли покрыть день [WORK_START_MIN, WORK_END_MIN] заданным набором интервалов
// Возвращает массив выбранных сотрудников или null
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
    return null;
  }

  return null;
}

// Решение задачи назначения для полных смен (min-cost flow)
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
        cost[i][j] = priority * 10;
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
    for (let v = sink; v !== source; v = prevv[v]) d = Math.min(d, graph[prevv[v]][preve[v]].cap);
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
// Дополнительные функции для алгоритма временных слотов
// ============================================================

interface Timeslot {
  attractionId: number;
  hour: number; // 0..12 (10:00 + hour)
}

interface TimeslotGraphEdge {
  to: number;
  rev: number;
  cap: number;
  cost: number;
}

// Построение графа для алгоритма временных слотов
// Возвращает: { graph, source, sink, employeeNodes, slotNodes, slotInfos }
function buildTimeslotGraph(
  employees: EmployeeWithPriority[],
  timeslots: Timeslot[],
  partialIntervals: Map<number, { start: number; end: number }> // employeeId -> { startMin, endMin }
): {
  graph: TimeslotGraphEdge[][];
  source: number;
  sink: number;
  employeeNodes: number[];
  slotNodes: number[];
  slotInfos: Timeslot[];
} {
  const nEmp = employees.length;
  const nSlot = timeslots.length;
  const N = 2 + nEmp + nSlot;
  const source = 0;
  const sink = N - 1;
  const empOffset = 1;
  const slotOffset = 1 + nEmp;

  const graph: TimeslotGraphEdge[][] = Array(N).fill(null).map(() => []);
  const addEdge = (from: number, to: number, cap: number, cost: number) => {
    graph[from].push({ to, rev: graph[to].length, cap, cost });
    graph[to].push({ to: from, rev: graph[from].length - 1, cap: 0, cost: -cost });
  };

  // Исток -> сотрудники (capacity = 1, но на самом деле сотрудник может быть назначен на несколько слотов?
  // В нашей модели сотрудник может работать в разные часы на разных аттракционах, поэтому capacity должно быть равно количеству часов, которые он может работать.
  // Упростим: сотрудник может быть назначен на произвольное количество слотов, но не более одного в час. Поскольку слоты разные по часам, ограничение "один сотрудник на один слот" уже задано рёбрами от сотрудника к слотам с cap=1.
  // Чтобы сотрудник мог быть назначен на несколько слотов, нужно от истока к сотруднику дать capacity = количество часов, которые он может отработать (например, 13 для полного дня).
  // Для неполных смен capacity = количество часов в его интервале.
  // Для простоты дадим capacity = 13 (максимум), но тогда сотрудник может быть назначен на 13 разных слотов, что допустимо.
  // Однако лучше вычислить реальную доступность.
  for (let i = 0; i < nEmp; i++) {
    const emp = employees[i];
    const interval = partialIntervals.get(emp.id);
    let maxHours = HOURS.length; // 13
    if (interval) {
      // Неполная смена: считаем количество часов в интервале
      const startHour = Math.ceil(interval.start / 60);
      const endHour = Math.floor(interval.end / 60);
      maxHours = Math.max(0, endHour - startHour);
    }
    addEdge(source, empOffset + i, Math.min(maxHours, HOURS.length), 0);
  }

  // Сотрудники -> слоты (только если есть допуск и время покрывает час)
  for (let i = 0; i < nEmp; i++) {
    const emp = employees[i];
    const interval = partialIntervals.get(emp.id);
    for (let j = 0; j < nSlot; j++) {
      const slot = timeslots[j];
      const priority = emp.priorityMap.get(slot.attractionId);
      if (priority === undefined) continue;
      // Проверяем, что час слота попадает в интервал сотрудника
      const hourStart = WORK_START_MIN + slot.hour * 60;
      const hourEnd = hourStart + 60;
      if (interval) {
        if (hourEnd <= interval.start || hourStart >= interval.end) continue;
      }
      // Стоимость: чем выше приоритет (1 - лучший), тем меньше стоимость
      const cost = priority * 10;
      addEdge(empOffset + i, slotOffset + j, 1, cost);
    }
  }

  // Слоты -> сток (capacity = required)
  // required позже добавим отдельно, пока capacity = 1 (будем менять после построения)
  for (let j = 0; j < nSlot; j++) {
    addEdge(slotOffset + j, sink, 1, 0); // временно 1
  }

  return {
    graph,
    source,
    sink,
    employeeNodes: Array.from({ length: nEmp }, (_, i) => empOffset + i),
    slotNodes: Array.from({ length: nSlot }, (_, i) => slotOffset + i),
    slotInfos: timeslots
  };
}

// ============================================================
// БЛОК 3: Алгоритм с временными слотами (полноценная реализация)
// Описание: Разбиение дня на часы, построение min-cost flow, назначение сотрудников.
// При изменении: заменить при изменении логики временных слотов.
// ============================================================
async function generateWithTimeslots(
  date: string,
  activeAttractions: AttractionWithStaff[],
  minStaffPerAttraction: number,
  employeesList: Employee[],
  priorityMapCache: Map<number, Map<number, number>>,
  studyGoalCache: Map<number, number>,
  fetchAvailabilityForDate: (date: string) => Promise<Availability[]>
): Promise<{ rows: ScheduleAttractionRow[]; unassigned: ScheduleEntry[] }> {
  // 1. Определяем требования для каждого аттракциона (min_staff на каждый час)
  const isWeekendDay = isWeekend(parseISO(date));
  const attractionRequirements = activeAttractions.map(attr => ({
    attractionId: attr.id,
    attractionName: attr.name,
    requiredCount: Math.max(
      isWeekendDay ? attr.minStaffWeekend : attr.minStaffWeekday,
      minStaffPerAttraction
    )
  }));

  // 2. Получаем доступность сотрудников
  const availabilities = await fetchAvailabilityForDate(date);
  const fullDayAvail = availabilities.filter(a => a.isFullDay);
  const partialAvail = availabilities.filter(a => !a.isFullDay);

  // 3. Формируем список сотрудников с приоритетами и интервалами
  interface EmployeeSlot {
    id: number;
    name: string;
    priorityMap: Map<number, number>;
    studyGoalAttractionId?: number;
    startMin: number;
    endMin: number;
    isFullDay: boolean;
  }

  const employeesForGraph: EmployeeSlot[] = [];

  // Полные смены (весь день)
  for (const av of fullDayAvail) {
    const emp = employeesList.find(e => e.id === av.employeeId);
    if (!emp) continue;
    const priorityMap = priorityMapCache.get(av.employeeId) || new Map();
    employeesForGraph.push({
      id: emp.id,
      name: emp.full_name,
      priorityMap,
      studyGoalAttractionId: studyGoalCache.get(av.employeeId),
      startMin: WORK_START_MIN,
      endMin: WORK_END_MIN,
      isFullDay: true,
    });
  }

  // Неполные смены
  for (const av of partialAvail) {
    const emp = employeesList.find(e => e.id === av.employeeId);
    if (!emp) continue;
    const priorityMap = priorityMapCache.get(av.employeeId) || new Map();
    const startMin = av.startTime ? minutesFrom10(av.startTime) : WORK_START_MIN;
    const endMin = av.endTime ? minutesFrom10(av.endTime) : WORK_END_MIN;
    employeesForGraph.push({
      id: emp.id,
      name: emp.full_name,
      priorityMap,
      studyGoalAttractionId: studyGoalCache.get(av.employeeId),
      startMin,
      endMin,
      isFullDay: false,
    });
  }

  // 4. Создаём временные слоты: для каждого аттракциона и каждого часа (10-11, 11-12, ..., 22-23)
  const timeslots: Timeslot[] = [];
  for (const req of attractionRequirements) {
    for (let hour = 0; hour < HOURS.length; hour++) {
      timeslots.push({ attractionId: req.attractionId, hour });
    }
  }

  // 5. Строим граф
  const partialIntervals = new Map<number, { start: number; end: number }>();
  for (const emp of employeesForGraph) {
    partialIntervals.set(emp.id, { start: emp.startMin, end: emp.endMin });
  }
  const { graph, source, sink, slotNodes, slotInfos } = buildTimeslotGraph(
    employeesForGraph.map(e => ({ id: e.id, name: e.name, priorityMap: e.priorityMap, studyGoalAttractionId: e.studyGoalAttractionId })),
    timeslots,
    partialIntervals
  );

  // 6. Устанавливаем пропускные способности для слотов (сторона слота -> сток) в соответствии с requiredCount
  // Нужно найти рёбра от slotNodes к sink и изменить их capacity
  for (let j = 0; j < slotNodes.length; j++) {
    const slotNode = slotNodes[j];
    const slot = slotInfos[j];
    const required = attractionRequirements.find(r => r.attractionId === slot.attractionId)?.requiredCount || 1;
    // Ищем ребро от slotNode к sink (обычно оно одно)
    for (let k = 0; k < graph[slotNode].length; k++) {
      const edge = graph[slotNode][k];
      if (edge.to === sink) {
        edge.cap = required;
        // Находим обратное ребро и меняем его cap на 0 (не обязательно)
        const revEdge = graph[sink][edge.rev];
        if (revEdge && revEdge.to === slotNode) {
          revEdge.cap = 0;
        }
        break;
      }
    }
  }

  // 7. Запускаем min-cost max-flow для заполнения всех слотов
  const INF = 1e9;
  let totalFlow = 0;
  let totalCost = 0;
  const totalSlots = slotNodes.length;
  const maxFlow = totalSlots * 10; // достаточно большой

  const dist = new Array(graph.length);
  const prevv = new Array(graph.length);
  const preve = new Array(graph.length);
  const inqueue = new Array(graph.length);

  while (totalFlow < maxFlow) {
    for (let i = 0; i < graph.length; i++) dist[i] = INF;
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
    totalCost += d * dist[sink];
    for (let v = sink; v !== source; v = prevv[v]) {
      const e = graph[prevv[v]][preve[v]];
      e.cap -= d;
      graph[v][e.rev].cap += d;
    }
  }

  // 8. Восстанавливаем назначения: для каждого слота, кто на него назначен
  // Сотрудники находятся в вершинах empOffset (1..1+nEmp-1), но у нас граф перестроен внутри buildTimeslotGraph.
  // У нас есть slotNodes, ищем рёбра от сотрудников к слотам с cap === 0.
  // Для этого нужно знать маппинг сотрудник -> employeeId. Сотрудники в графе имеют индексы от 1 до nEmp.
  const empOffset = 1;
  const employeeIdByNode: Map<number, number> = new Map();
  for (let i = 0; i < employeesForGraph.length; i++) {
    employeeIdByNode.set(empOffset + i, employeesForGraph[i].id);
  }

  // Для каждого слота собираем назначенного сотрудника
  const slotAssignments: Map<number, number[]> = new Map(); // attractionId -> массив employeeId (по часам)
  for (let j = 0; j < slotNodes.length; j++) {
    const slotNode = slotNodes[j];
    const slot = slotInfos[j];
    // Ищем ребро от какого-то сотрудника к этому slotNode с cap === 0
    for (let i = 0; i < graph.length; i++) {
      for (const edge of graph[i]) {
        if (edge.to === slotNode && edge.cap === 0 && i !== source && i !== sink) {
          const empId = employeeIdByNode.get(i);
          if (empId) {
            if (!slotAssignments.has(slot.attractionId)) slotAssignments.set(slot.attractionId, []);
            slotAssignments.get(slot.attractionId)!.push(empId);
          }
          break;
        }
      }
    }
  }

  // 9. Формируем результат: для каждого аттракциона собираем уникальных сотрудников (поскольку один сотрудник может быть назначен на несколько часов, нужно убрать дубли)
  const rows: ScheduleAttractionRow[] = attractionRequirements.map(req => ({
    attractionId: req.attractionId,
    attractionName: req.attractionName,
    minStaffRequired: req.requiredCount,
    employees: []
  }));

  const usedEmployeeIds = new Set<number>();
  for (const req of attractionRequirements) {
    const assignedIds = slotAssignments.get(req.attractionId) || [];
    const uniqueIds = [...new Set(assignedIds)];
    for (const empId of uniqueIds) {
      const emp = employeesForGraph.find(e => e.id === empId);
      if (emp) {
        const row = rows.find(r => r.attractionId === req.attractionId);
        if (row) {
          row.employees.push({
            employeeId: emp.id,
            employeeName: emp.name,
            isFullDay: emp.isFullDay,
            startTime: emp.isFullDay ? null : formatTimeFromMinutes(emp.startMin),
            endTime: emp.isFullDay ? null : formatTimeFromMinutes(emp.endMin),
            isManuallyAdded: false,
          });
          usedEmployeeIds.add(emp.id);
        }
      }
    }
  }

  // 10. Незадействованные сотрудники (кто не попал в назначения)
  const unassignedEmployees = employeesForGraph.filter(emp => !usedEmployeeIds.has(emp.id));
  const unassignedList: ScheduleEntry[] = unassignedEmployees.map(emp => ({
    employeeId: emp.id,
    employeeName: emp.name,
    isFullDay: emp.isFullDay,
    startTime: emp.isFullDay ? null : formatTimeFromMinutes(emp.startMin),
    endTime: emp.isFullDay ? null : formatTimeFromMinutes(emp.endMin),
  }));

  return { rows, unassigned: unassignedList };
}

// Вспомогательная функция для преобразования минут в строку времени (HH:MM)
function formatTimeFromMinutes(minutesFrom10: number): string {
  const totalMinutes = 10 * 60 + minutesFrom10;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ============================================================
// БЛОК 4: Основной компонент ScheduleGenerator
// Описание: Состояния, хуки, загрузка начальных данных.
// При изменении: заменить при изменении структуры состояний.
// ============================================================
export function ScheduleGenerator({ profile, isSuperAdmin = false }: { profile: UserProfile; isSuperAdmin?: boolean }) {
  const [attractions, setAttractions] = useState<AttractionWithStaff[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Кэши приоритетов и целей
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

  // ============================================================
  // БЛОК 5: Функции работы с БД (доступность, сохранение)
  // Описание: Запросы к supabase для получения заявок и сохранения графика.
  // При изменении: заменить при изменении схемы БД.
  // ============================================================
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

// ============================================================
// БЛОК 6: Генерация для одного дня (комбинированный алгоритм с поддержкой неполных смен)
// Описание: Логика комбинированного подхода: сначала полные смены, затем покрытие дефицита неполными.
// При изменении: заменить при изменении алгоритма назначения.
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

  // Создаём слоты для полных смен
  const slots: { attractionId: number }[] = [];
  for (const req of attractionRequirements) {
    for (let i = 0; i < req.requiredCount; i++) slots.push({ attractionId: req.attractionId });
  }

  // Назначаем полные смены
  const assignment = solveAssignment(fullEmployees, slots);

  // Инициализируем строки аттракционов
  const rows: ScheduleAttractionRow[] = attractionRequirements.map(req => ({
    attractionId: req.attractionId,
    attractionName: req.attractionName,
    minStaffRequired: req.requiredCount,
    employees: []
  }));

  // Заполняем назначенных полных сотрудников
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

  // Список неиспользованных полных сотрудников
  const unassignedFull = fullEmployees.filter(emp => !assignedFullIds.includes(emp.id));

  // Преобразуем неполные смены в ScheduleEntry
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

  // Для каждого аттракциона проверяем дефицит и пытаемся закрыть его неполными сменами
  const usedPartialIds: number[] = [];
  for (const row of rows) {
    const currentCount = row.employees.length;
    const deficit = row.minStaffRequired - currentCount;
    if (deficit <= 0) continue;

    // Пытаемся найти покрытие из неполных сотрудников (ещё не использованных)
    const availablePartials = partialEntries.filter(p => !usedPartialIds.includes(p.employeeId));
    const cover = findCoverForAttraction(deficit, availablePartials, row.attractionId, priorityMapCache);
    if (cover && cover.length === deficit) {
      // Назначаем этих сотрудников на аттракцион
      for (const emp of cover) {
        row.employees.push({
          ...emp,
          isManuallyAdded: false, // автоматически назначенные, не вручную
        });
        usedPartialIds.push(emp.employeeId);
      }
    }
  }

  // Оставшиеся неполные (не использованные в покрытии)
  const remainingPartial = partialEntries.filter(p => !usedPartialIds.includes(p.employeeId));

  // Все незадействованные: неиспользованные полные + оставшиеся неполные
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
  // БЛОК 7: Генерация для одного дня (выбор алгоритма)
  // Описание: Маршрутизация на нужный алгоритм.
  // При изменении: заменить при добавлении новых алгоритмов.
  // ============================================================
  const generateForDay = async (date: string): Promise<{ rows: ScheduleAttractionRow[]; unassigned: ScheduleEntry[] }> => {
    if (algorithm === 'combined') {
      return generateForDayCombined(date);
    } else {
      return generateWithTimeslots(
        date,
        attractions.filter(a => selectedAttractionIds.has(a.id)),
        minStaffPerAttraction,
        employees,
        priorityMapCache,
        studyGoalCache,
        fetchAvailabilityForDate
      );
    }
  };

  // ============================================================
  // БЛОК 8: Основная генерация графика (несколько дней)
  // Описание: Цикл по дням, вызов generateForDay, сбор результатов.
  // При изменении: редко требуется.
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
      `Сгенерирован график на ${daysCount} дн. (${algorithm}) начиная с ${startDate}`
    );
  };

  // ============================================================
  // БЛОК 9: Функции ручного редактирования (перемещение сотрудников)
  // Описание: moveToUnassigned, moveFromUnassigned.
  // При изменении: заменить при изменении логики редактирования.
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
  // БЛОК 10: Сохранение графика в БД
  // Описание: Вставка записей в schedule_assignments.
  // При изменении: заменить при изменении структуры таблицы.
  // ============================================================
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
      if (error) throw error;

      await logActivity(isSuperAdmin ? 'superadmin' : 'admin', profile.id, 'schedule_save', `Сохранён график на ${schedule.length} дней`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // БЛОК 11: Визуальный компонент (рендер)
  // Описание: JSX с современным дизайном, но сохранением структуры.
  // При изменении: заменить при изменении интерфейса.
  // ============================================================
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="animate-spin text-purple-600 h-10 w-10 mx-auto mb-3" />
        <p className="text-gray-500">Загрузка данных...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wand2 className="h-7 w-7 text-purple-600" />
            Генератор графика
          </h1>
          <p className="text-sm text-gray-500 mt-1">Автоматическое составление расписания с ручной корректировкой</p>
        </div>
        {isGenerated && (
          <button
            onClick={handleSaveSchedule}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить график
          </button>
        )}
      </div>

      {/* Панель параметров */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Дата начала
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-xl border-gray-200 shadow-sm focus:border-purple-300 focus:ring focus:ring-purple-200 focus:ring-opacity-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Clock className="h-4 w-4" /> Количество дней
            </label>
            <select value={daysCount} onChange={e => setDaysCount(Number(e.target.value))} className="w-full rounded-xl border-gray-200 shadow-sm">
              {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} {d===1?'день':d<5?'дня':'дней'}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Users className="h-4 w-4" /> Мин. сотрудников (доп.)
            </label>
            <input type="number" min={1} max={10} value={minStaffPerAttraction} onChange={e => setMinStaffPerAttraction(Number(e.target.value))} className="w-full rounded-xl border-gray-200 shadow-sm" />
            <p className="text-xs text-gray-400 mt-1">Максимум из БД и этого значения</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Filter className="h-4 w-4" /> Алгоритм
            </label>
            <select value={algorithm} onChange={e => setAlgorithm(e.target.value as AlgorithmType)} className="w-full rounded-xl border-gray-200 shadow-sm bg-white">
              <option value="combined">Комбинированный (полные смены)</option>
              <option value="timeslot">Временные слоты (экспериментальный)</option>
            </select>
          </div>
        </div>

        {/* Выбор аттракционов */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              🎢 Аттракционы (работающие в этот день)
            </label>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setSelectedAttractionIds(new Set(attractions.map(a => a.id)))} className="text-purple-600 hover:text-purple-800">Выбрать все</button>
              <button onClick={() => setSelectedAttractionIds(new Set())} className="text-gray-400 hover:text-gray-600">Снять все</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
            {attractions.map(attr => (
              <button
                key={attr.id}
                onClick={() => setSelectedAttractionIds(prev => { const next = new Set(prev); next.has(attr.id) ? next.delete(attr.id) : next.add(attr.id); return next; })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  selectedAttractionIds.has(attr.id)
                    ? 'bg-purple-600 text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {selectedAttractionIds.has(attr.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {attr.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateSchedule}
          disabled={generating || selectedAttractionIds.size === 0}
          className="w-full flex justify-center items-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md transition disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
          {generating ? 'Генерация...' : 'Сгенерировать график'}
        </button>
      </div>

      {/* Результат генерации */}
      {isGenerated && (
        <div className="space-y-6">
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 flex items-center gap-2">
              <CheckSquare className="h-5 w-5" /> График успешно сохранён в базе данных!
            </div>
          )}

          {schedule.map((day, idx) => (
            <div key={day.date} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">{format(parseISO(day.date), 'dd MMMM yyyy', { locale: ru })}</span>
                  <span className="text-sm opacity-80">({format(parseISO(day.date), 'EEEE', { locale: ru })})</span>
                </div>
                <div className="text-xs bg-white/20 rounded-full px-2 py-1">
                  {algorithm === 'combined' ? 'Комбинированный' : 'Временные слоты'}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Аттракцион</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Сотрудники</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {day.rows.map(row => (
                      <tr key={row.attractionId} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{row.attractionName}</div>
                          {row.employees.length < row.minStaffRequired && (
                            <div className="mt-1 text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Нужно минимум {row.minStaffRequired}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {row.employees.map(emp => (
                              <div
                                key={emp.employeeId}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                  emp.isManuallyAdded
                                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                                    : 'bg-gray-100 border border-gray-200 text-gray-800'
                                }`}
                              >
                                <GripVertical className="h-3 w-3 text-gray-400" />
                                <span>{emp.employeeName}</span>
                                {!emp.isFullDay && emp.startTime && emp.endTime && (
                                  <span className="text-gray-400 text-[11px]">{emp.startTime.slice(0,5)}–{emp.endTime.slice(0,5)}</span>
                                )}
                                <button
                                  onClick={() => moveToUnassigned(day.date, row.attractionId, emp.employeeId)}
                                  className="ml-1 text-gray-400 hover:text-red-500 transition"
                                  title="Убрать из графика"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            {/* Кнопка добавления с выпадающим списком */}
                            <div className="relative inline-block">
                              <button
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition"
                                onMouseEnter={(e) => { const picker = e.currentTarget.nextElementSibling; if (picker) (picker as HTMLElement).style.display = 'block'; }}
                                onMouseLeave={(e) => { const picker = e.currentTarget.nextElementSibling; if (picker) (picker as HTMLElement).style.display = 'none'; }}
                              >
                                <Plus className="h-3 w-3" /> Добавить
                              </button>
                              <div
                                className="absolute z-20 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-48 hidden"
                                style={{ display: 'none' }}
                                onMouseEnter={(e) => (e.currentTarget.style.display = 'block')}
                                onMouseLeave={(e) => (e.currentTarget.style.display = 'none')}
                              >
                                {unassigned.length === 0 ? (
                                  <p className="text-xs text-gray-400 px-2 py-1">Нет доступных</p>
                                ) : (
                                  <ul className="space-y-1 max-h-60 overflow-y-auto">
                                    {unassigned.map(emp => (
                                      <li key={emp.employeeId}>
                                        <button
                                          onClick={() => moveFromUnassigned(emp.employeeId, day.date, row.attractionId)}
                                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-blue-50 transition flex items-center gap-2"
                                        >
                                          <Plus className="h-3 w-3 text-green-500" />
                                          {emp.employeeName}
                                          {!emp.isFullDay && emp.startTime && (
                                            <span className="text-gray-400 text-[10px]">{emp.startTime.slice(0,5)}–{emp.endTime?.slice(0,5)}</span>
                                          )}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Список незадействованных сотрудников */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-gray-500" />
              <h5 className="font-semibold text-gray-700">Незадействованные сотрудники</h5>
              <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{unassigned.length}</span>
            </div>
            {unassigned.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Все доступные сотрудники распределены</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unassigned.map(emp => (
                  <div key={emp.employeeId} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 shadow-sm">
                    <span className="text-sm font-medium text-orange-800">{emp.employeeName}</span>
                    <span className="text-xs text-orange-500 bg-orange-100 rounded-full px-2 py-0.5">
                      {emp.isFullDay ? 'Полн.' : `${emp.startTime?.slice(0,5)}–${emp.endTime?.slice(0,5)}`}
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
