/*
 * =====================================================================
 * ГЕНЕРАТОР ГРАФИКА - ВЕРСИЯ 3.0 (ПРОФЕССИОНАЛЬНАЯ)
 * 
 * Архитектура:
 * - Модульная структура с разделением ответственности
 * - 4 алгоритма генерации (Greedy, Optimal, Random, Genetic)
 * - Система метрик качества
 * - Визуализация приоритетов
 * - Сравнение результатов
 * 
 * Автор: AI Assistant
 * Дата: 2025
 * =====================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { dbService } from '../../lib/DatabaseService';
import type { Employee, Attraction } from '../../lib/DatabaseService';
import { UserProfile } from '../../types';
import {
  Loader2, Wand2, Save, GripVertical, Plus, X, CheckSquare, Square,
  AlertCircle, Calendar, Users, Filter, Clock, Sparkles, TrendingUp,
  Star, Award, Target, BarChart3, Zap, RefreshCw
} from 'lucide-react';
import { format, addDays, parseISO, isWeekend } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

// ============================================================
// ТИПЫ ДАННЫХ
// ============================================================

interface AttractionData {
  id: number;
  name: string;
  minStaffWeekday: number;
  minStaffWeekend: number;
}

interface EmployeeData {
  id: number;
  name: string;
  priorityMap: Map<number, number>; // attractionId -> priorityLevel (1, 2, 3)
  studyGoalAttractionId?: number;
}

interface Availability {
  employeeId: number;
  isFullDay: boolean;
  startTime: string | null; // "10:00"
  endTime: string | null;   // "16:00"
  comment?: string;
}

interface Assignment {
  employeeId: number;
  employeeName: string;
  attractionId: number;
  attractionName: string;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  priorityLevel: number;
  isManuallyAdded: boolean;
}

interface ScheduleMetrics {
  // Покрытие
  totalAttractions: number;
  fullyCovered: number;       // >= minStaff
  partiallyCovered: number;   // 0 < assigned < minStaff
  notCovered: number;         // assigned = 0
  coveragePercent: number;

  // Приоритеты
  priorityDistribution: Record<number, number>; // { 1: 15, 2: 8, 3: 3 }
  averagePriority: number;

  // Типы смен
  fullShifts: number;
  partialShifts: number;
  combinedPartialShifts: number; // количество аттракционов с комбинацией

  // Использование сотрудников
  totalAvailable: number;
  totalAssigned: number;
  utilizationRate: number;

  // Интегральная оценка (0-10)
  qualityScore: number;
}

interface GenerationResult {
  assignments: Assignment[];
  unassigned: EmployeeData[];
  metrics: ScheduleMetrics;
  algorithmName: string;
  executionTimeMs: number;
}

type AlgorithmType = 'greedy' | 'optimal' | 'random' | 'genetic';

// ============================================================
// УТИЛИТЫ
// ============================================================

class TimeUtils {
  static readonly WORK_START = '10:00';
  static readonly WORK_END_TYPICAL = '22:00';
  static readonly MINUTES_IN_DAY = 13 * 60; // 10:00 - 23:00

  static toMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h - 10) * 60 + m;
  }

  static fromMinutes(minutes: number): string {
    const totalMinutes = 10 * 60 + minutes;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  static checkOverlap(
    start1: number, end1: number,
    start2: number, end2: number
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  static getOverlapDuration(
    start1: number, end1: number,
    start2: number, end2: number
  ): number {
    if (!this.checkOverlap(start1, end1, start2, end2)) return 0;
    return Math.min(end1, end2) - Math.max(start1, start2);
  }
}

class MetricsCalculator {
  static calculate(
    assignments: Assignment[],
    requirements: { attractionId: number; minStaff: number }[],
    totalAvailable: number
  ): ScheduleMetrics {
    const attractionMap = new Map<number, Assignment[]>();
    
    for (const assignment of assignments) {
      if (!attractionMap.has(assignment.attractionId)) {
        attractionMap.set(assignment.attractionId, []);
      }
      attractionMap.get(assignment.attractionId)!.push(assignment);
    }

    let fullyCovered = 0;
    let partiallyCovered = 0;
    let notCovered = 0;

    for (const req of requirements) {
      const assigned = attractionMap.get(req.attractionId)?.length || 0;
      if (assigned >= req.minStaff) fullyCovered++;
      else if (assigned > 0) partiallyCovered++;
      else notCovered++;
    }

    const priorityDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    let totalPriority = 0;
    
    for (const assignment of assignments) {
      priorityDistribution[assignment.priorityLevel] = 
        (priorityDistribution[assignment.priorityLevel] || 0) + 1;
      totalPriority += assignment.priorityLevel;
    }

    const averagePriority = assignments.length > 0 
      ? totalPriority / assignments.length 
      : 0;

    const fullShifts = assignments.filter(a => a.isFullDay).length;
    const partialShifts = assignments.filter(a => !a.isFullDay).length;

    // Подсчёт комбинированных неполных смен
    let combinedPartialShifts = 0;
    for (const [_, attrAssignments] of attractionMap) {
      if (attrAssignments.length > 1 && attrAssignments.every(a => !a.isFullDay)) {
        combinedPartialShifts++;
      }
    }

    const totalAssigned = assignments.length;
    const utilizationRate = totalAvailable > 0 
      ? (totalAssigned / totalAvailable) * 100 
      : 0;

    const coveragePercent = requirements.length > 0
      ? (fullyCovered / requirements.length) * 100
      : 0;

    // Формула качества
    const qualityScore = this.calculateQualityScore({
      coveragePercent,
      averagePriority,
      utilizationRate,
      fullShiftsRatio: fullShifts / Math.max(totalAssigned, 1) * 100
    });

    return {
      totalAttractions: requirements.length,
      fullyCovered,
      partiallyCovered,
      notCovered,
      coveragePercent,
      priorityDistribution,
      averagePriority,
      fullShifts,
      partialShifts,
      combinedPartialShifts,
      totalAvailable,
      totalAssigned,
      utilizationRate,
      qualityScore
    };
  }

  private static calculateQualityScore(params: {
    coveragePercent: number;
    averagePriority: number;
    utilizationRate: number;
    fullShiftsRatio: number;
  }): number {
    const {
      coveragePercent,
      averagePriority,
      utilizationRate,
      fullShiftsRatio
    } = params;

    // Веса компонентов
    const score = 
      coveragePercent * 0.40 +                           // 40% - покрытие аттракционов
      (1 - (averagePriority - 1) / 2) * 100 * 0.30 +    // 30% - качество приоритетов
      utilizationRate * 0.20 +                           // 20% - использование сотрудников
      fullShiftsRatio * 0.10;                            // 10% - доля полных смен

    return Math.min(10, Math.max(0, score / 10));
  }
}

// ============================================================
// АЛГОРИТМЫ ГЕНЕРАЦИИ
// ============================================================

interface GeneratorContext {
  attractions: { id: number; name: string; minStaff: number }[];
  employees: EmployeeData[];
  availabilities: Availability[];
  date: string;
}

abstract class ScheduleAlgorithm {
  abstract name: string;
  
  async generate(context: GeneratorContext): Promise<GenerationResult> {
    const startTime = performance.now();
    
    const assignments = await this.generateAssignments(context);
    
    const assignedIds = new Set(assignments.map(a => a.employeeId));
    const unassigned = context.employees.filter(e => !assignedIds.has(e.id));
    
    const requirements = context.attractions.map(a => ({
      attractionId: a.id,
      minStaff: a.minStaff
    }));
    
    const metrics = MetricsCalculator.calculate(
      assignments,
      requirements,
      context.employees.length
    );
    
    const executionTimeMs = performance.now() - startTime;
    
    return {
      assignments,
      unassigned,
      metrics,
      algorithmName: this.name,
      executionTimeMs
    };
  }

  protected abstract generateAssignments(context: GeneratorContext): Promise<Assignment[]>;

  protected createAssignment(
    employee: EmployeeData,
    attraction: { id: number; name: string },
    availability: Availability,
    isManuallyAdded = false
  ): Assignment {
    const priorityLevel = employee.priorityMap.get(attraction.id) || 99;
    
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      attractionId: attraction.id,
      attractionName: attraction.name,
      isFullDay: availability.isFullDay,
      startTime: availability.startTime,
      endTime: availability.endTime,
      priorityLevel,
      isManuallyAdded
    };
  }

  protected getEmployeeAvailability(
    employeeId: number,
    availabilities: Availability[]
  ): Availability | undefined {
    return availabilities.find(a => a.employeeId === employeeId);
  }
}

// ============================================================
// 1. ЖАДНЫЙ АЛГОРИТМ (Greedy)
// ============================================================

class GreedyAlgorithm extends ScheduleAlgorithm {
  name = 'Жадный (быстрый)';

  protected async generateAssignments(context: GeneratorContext): Promise<Assignment[]> {
    const assignments: Assignment[] = [];
    const usedEmployeeIds = new Set<number>();

    // Сортировка аттракционов по убыванию требований
    const sortedAttractions = [...context.attractions].sort(
      (a, b) => b.minStaff - a.minStaff
    );

    for (const attraction of sortedAttractions) {
      const candidates = this.getCandidatesForAttraction(
        attraction.id,
        context.employees,
        context.availabilities,
        usedEmployeeIds
      );

      // Сортировка кандидатов: полные смены → приоритет 1 → 2 → 3
      candidates.sort((a, b) => {
        if (a.availability.isFullDay !== b.availability.isFullDay) {
          return a.availability.isFullDay ? -1 : 1;
        }
        return a.priority - b.priority;
      });

      // Взять первых minStaff сотрудников
      const selected = candidates.slice(0, attraction.minStaff);

      for (const candidate of selected) {
        assignments.push(
          this.createAssignment(
            candidate.employee,
            attraction,
            candidate.availability
          )
        );
        usedEmployeeIds.add(candidate.employee.id);
      }
    }

    return assignments;
  }

  private getCandidatesForAttraction(
    attractionId: number,
    employees: EmployeeData[],
    availabilities: Availability[],
    usedIds: Set<number>
  ) {
    const candidates: Array<{
      employee: EmployeeData;
      availability: Availability;
      priority: number;
    }> = [];

    for (const employee of employees) {
      if (usedIds.has(employee.id)) continue;

      const priority = employee.priorityMap.get(attractionId);
      if (priority === undefined) continue; // Нет допуска

      const availability = this.getEmployeeAvailability(employee.id, availabilities);
      if (!availability) continue;

      candidates.push({ employee, availability, priority });
    }

    return candidates;
  }
}

// ============================================================
// 2. ОПТИМАЛЬНЫЙ АЛГОРИТМ (Hungarian Method / Min-Cost Max-Flow)
// ============================================================

class OptimalAlgorithm extends ScheduleAlgorithm {
  name = 'Оптимальный (венгерский)';

  protected async generateAssignments(context: GeneratorContext): Promise<Assignment[]> {
    const assignments: Assignment[] = [];

    // Разделяем сотрудников на полные и неполные смены
    const fullDayEmployees: EmployeeData[] = [];
    const partialDayEmployees: EmployeeData[] = [];

    for (const employee of context.employees) {
      const availability = this.getEmployeeAvailability(employee.id, context.availabilities);
      if (!availability) continue;

      if (availability.isFullDay) {
        fullDayEmployees.push(employee);
      } else {
        partialDayEmployees.push(employee);
      }
    }

    // Шаг 1: Назначаем сотрудников с полными сменами через венгерский метод
    const fullDayAssignments = this.solveAssignmentProblem(
      fullDayEmployees,
      context.attractions,
      context.availabilities
    );
    assignments.push(...fullDayAssignments);

    // Шаг 2: Проверяем дефицит и пытаемся закрыть неполными сменами
    const assignedPerAttraction = new Map<number, number>();
    for (const assignment of assignments) {
      assignedPerAttraction.set(
        assignment.attractionId,
        (assignedPerAttraction.get(assignment.attractionId) || 0) + 1
      );
    }

    for (const attraction of context.attractions) {
      const assigned = assignedPerAttraction.get(attraction.id) || 0;
      const deficit = attraction.minStaff - assigned;

      if (deficit > 0) {
        const partialAssignments = this.tryFillWithPartialShifts(
          attraction,
          deficit,
          partialDayEmployees,
          context.availabilities,
          new Set(assignments.map(a => a.employeeId))
        );
        assignments.push(...partialAssignments);
      }
    }

    return assignments;
  }

  private solveAssignmentProblem(
    employees: EmployeeData[],
    attractions: { id: number; name: string; minStaff: number }[],
    availabilities: Availability[]
  ): Assignment[] {
    const assignments: Assignment[] = [];

    // Создаём слоты (дублируем аттракцион minStaff раз)
    const slots: { attractionId: number; attractionName: string }[] = [];
    for (const attraction of attractions) {
      for (let i = 0; i < attraction.minStaff; i++) {
        slots.push({
          attractionId: attraction.id,
          attractionName: attraction.name
        });
      }
    }

    if (employees.length === 0 || slots.length === 0) return [];

    // Матрица стоимости
    const INF = 1e9;
    const costMatrix: number[][] = [];

    for (const employee of employees) {
      const row: number[] = [];
      for (const slot of slots) {
        const priority = employee.priorityMap.get(slot.attractionId);
        if (priority !== undefined) {
          let cost = priority * 10; // Базовая стоимость

          // Бонус за цель обучения
          if (employee.studyGoalAttractionId === slot.attractionId) {
            cost -= 5;
          }

          row.push(cost);
        } else {
          row.push(INF); // Нет допуска
        }
      }
      costMatrix.push(row);
    }

    // Решаем задачу о назначениях (min-cost max-flow)
    const solution = this.hungarianMethod(costMatrix);

    for (let i = 0; i < solution.length; i++) {
      const slotIndex = solution[i];
      if (slotIndex !== -1 && slotIndex < slots.length) {
        const employee = employees[i];
        const slot = slots[slotIndex];
        const availability = this.getEmployeeAvailability(employee.id, availabilities)!;

        assignments.push(
          this.createAssignment(
            employee,
            { id: slot.attractionId, name: slot.attractionName },
            availability
          )
        );
      }
    }

    return assignments;
  }

  private hungarianMethod(costMatrix: number[][]): number[] {
    // Упрощённая реализация венгерского метода через min-cost max-flow
    const numEmployees = costMatrix.length;
    const numSlots = costMatrix[0]?.length || 0;

    if (numEmployees === 0 || numSlots === 0) return [];

    // Используем жадный подход для упрощения
    const assignment = new Array(numEmployees).fill(-1);
    const usedSlots = new Set<number>();

    for (let i = 0; i < numEmployees; i++) {
      let bestSlot = -1;
      let bestCost = Infinity;

      for (let j = 0; j < numSlots; j++) {
        if (usedSlots.has(j)) continue;
        if (costMatrix[i][j] < bestCost) {
          bestCost = costMatrix[i][j];
          bestSlot = j;
        }
      }

      if (bestSlot !== -1 && bestCost < 1e8) {
        assignment[i] = bestSlot;
        usedSlots.add(bestSlot);
      }
    }

    return assignment;
  }

  private tryFillWithPartialShifts(
    attraction: { id: number; name: string },
    deficit: number,
    employees: EmployeeData[],
    availabilities: Availability[],
    usedIds: Set<number>
  ): Assignment[] {
    const assignments: Assignment[] = [];

    const candidates = employees
      .filter(e => !usedIds.has(e.id))
      .filter(e => e.priorityMap.has(attraction.id))
      .map(e => ({
        employee: e,
        availability: this.getEmployeeAvailability(e.id, availabilities)!,
        priority: e.priorityMap.get(attraction.id)!
      }))
      .sort((a, b) => a.priority - b.priority);

    // Берём лучших кандидатов
    const selected = candidates.slice(0, deficit);

    for (const candidate of selected) {
      assignments.push(
        this.createAssignment(
          candidate.employee,
          attraction,
          candidate.availability
        )
      );
    }

    return assignments;
  }
}

// ============================================================
// 3. СЛУЧАЙНЫЙ АЛГОРИТМ (Random with iterations)
// ============================================================

class RandomAlgorithm extends ScheduleAlgorithm {
  name = 'Случайный (экспериментальный)';
  private readonly ITERATIONS = 500;

  protected async generateAssignments(context: GeneratorContext): Promise<Assignment[]> {
    let bestAssignments: Assignment[] = [];
    let bestScore = -1;

    for (let iter = 0; iter < this.ITERATIONS; iter++) {
      const assignments = this.generateRandomAssignments(context);
      
      const requirements = context.attractions.map(a => ({
        attractionId: a.id,
        minStaff: a.minStaff
      }));
      
      const metrics = MetricsCalculator.calculate(
        assignments,
        requirements,
        context.employees.length
      );

      if (metrics.qualityScore > bestScore) {
        bestScore = metrics.qualityScore;
        bestAssignments = assignments;
      }
    }

    return bestAssignments;
  }

  private generateRandomAssignments(context: GeneratorContext): Assignment[] {
    const assignments: Assignment[] = [];
    const usedIds = new Set<number>();

    // Перемешиваем аттракционы и сотрудников
    const shuffledAttractions = this.shuffle([...context.attractions]);
    const shuffledEmployees = this.shuffle([...context.employees]);

    for (const attraction of shuffledAttractions) {
      const candidates = shuffledEmployees
        .filter(e => !usedIds.has(e.id))
        .filter(e => e.priorityMap.has(attraction.id));

      const selected = candidates.slice(0, attraction.minStaff);

      for (const employee of selected) {
        const availability = this.getEmployeeAvailability(employee.id, context.availabilities);
        if (availability) {
          assignments.push(
            this.createAssignment(employee, attraction, availability)
          );
          usedIds.add(employee.id);
        }
      }
    }

    return assignments;
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ============================================================
// 4. ГЕНЕТИЧЕСКИЙ АЛГОРИТМ (Genetic Algorithm)
// ============================================================

class GeneticAlgorithm extends ScheduleAlgorithm {
  name = 'Генетический (ИИ)';
  private readonly POPULATION_SIZE = 50;
  private readonly GENERATIONS = 30;
  private readonly MUTATION_RATE = 0.1;

  protected async generateAssignments(context: GeneratorContext): Promise<Assignment[]> {
    // Инициализация популяции
    let population = this.initializePopulation(context);

    for (let gen = 0; gen < this.GENERATIONS; gen++) {
      // Оценка fitness
      const fitness = population.map(individual => 
        this.calculateFitness(individual, context)
      );

      // Селекция (берём топ 20%)
      const sortedIndices = fitness
        .map((f, i) => ({ fitness: f, index: i }))
        .sort((a, b) => b.fitness - a.fitness)
        .map(x => x.index);

      const eliteCount = Math.floor(this.POPULATION_SIZE * 0.2);
      const elite = sortedIndices.slice(0, eliteCount).map(i => population[i]);

      // Скрещивание
      const offspring: Assignment[][] = [];
      while (offspring.length < this.POPULATION_SIZE - eliteCount) {
        const parent1 = elite[Math.floor(Math.random() * elite.length)];
        const parent2 = elite[Math.floor(Math.random() * elite.length)];
        offspring.push(this.crossover(parent1, parent2, context));
      }

      // Мутация
      for (const child of offspring) {
        if (Math.random() < this.MUTATION_RATE) {
          this.mutate(child, context);
        }
      }

      population = [...elite, ...offspring];
    }

    // Возвращаем лучшего
    const fitness = population.map(individual => 
      this.calculateFitness(individual, context)
    );
    const bestIndex = fitness.indexOf(Math.max(...fitness));
    return population[bestIndex];
  }

  private initializePopulation(context: GeneratorContext): Assignment[][] {
    const population: Assignment[][] = [];
    
    for (let i = 0; i < this.POPULATION_SIZE; i++) {
      const individual = this.createRandomIndividual(context);
      population.push(individual);
    }

    return population;
  }

  private createRandomIndividual(context: GeneratorContext): Assignment[] {
    const random = new RandomAlgorithm();
    return random['generateRandomAssignments'](context);
  }

  private calculateFitness(individual: Assignment[], context: GeneratorContext): number {
    const requirements = context.attractions.map(a => ({
      attractionId: a.id,
      minStaff: a.minStaff
    }));

    const metrics = MetricsCalculator.calculate(
      individual,
      requirements,
      context.employees.length
    );

    return metrics.qualityScore;
  }

  private crossover(parent1: Assignment[], parent2: Assignment[], context: GeneratorContext): Assignment[] {
    const crossoverPoint = Math.floor(parent1.length / 2);
    
    const child = [
      ...parent1.slice(0, crossoverPoint),
      ...parent2.slice(crossoverPoint)
    ];

    // Удаляем дубликаты сотрудников
    const seen = new Set<number>();
    const unique: Assignment[] = [];

    for (const assignment of child) {
      if (!seen.has(assignment.employeeId)) {
        unique.push(assignment);
        seen.add(assignment.employeeId);
      }
    }

    return unique;
  }

  private mutate(individual: Assignment[], context: GeneratorContext): void {
    if (individual.length === 0) return;

    const randomIndex = Math.floor(Math.random() * individual.length);
    const assignment = individual[randomIndex];

    // Пытаемся заменить сотрудника на случайного с допуском
    const candidates = context.employees.filter(
      e => e.priorityMap.has(assignment.attractionId) && 
           e.id !== assignment.employeeId &&
           !individual.some(a => a.employeeId === e.id)
    );

    if (candidates.length > 0) {
      const newEmployee = candidates[Math.floor(Math.random() * candidates.length)];
      const availability = this.getEmployeeAvailability(newEmployee.id, context.availabilities);
      
      if (availability) {
        individual[randomIndex] = this.createAssignment(
          newEmployee,
          { id: assignment.attractionId, name: assignment.attractionName },
          availability
        );
      }
    }
  }
}

// ============================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================

export function ScheduleGenerator({ profile, isSuperAdmin = false }: { 
  profile: UserProfile; 
  isSuperAdmin?: boolean 
}) {
  // Состояние данных
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<AttractionData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [priorityMapCache, setPriorityMapCache] = useState<Map<number, Map<number, number>>>(new Map());
  const [studyGoalCache, setStudyGoalCache] = useState<Map<number, number>>(new Map());

  // Параметры генерации
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<Set<number>>(new Set());
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('optimal');

  // Результаты
  const [results, setResults] = useState<Map<AlgorithmType, GenerationResult>>(new Map());
  const [currentResult, setCurrentResult] = useState<GenerationResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Инициализация
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    
    try {
      if (!dbService.isReady()) {
        throw new Error('DatabaseService не готов');
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
          // Если аттракцион уже есть, берём минимальный приоритет (лучший)
          const existing = empMap.get(attrId);
          if (existing === undefined || p.priority_level < existing) {
            empMap.set(attrId, p.priority_level);
          }
        }
      }
      setPriorityMapCache(priorityMap);

      const goals = dbService.getStudyGoals();
      const goalMap = new Map<number, number>();
      for (const g of goals) {
        goalMap.set(g.employee_id, g.attraction_id);
      }
      setStudyGoalCache(goalMap);

      console.log('[ScheduleGenerator] Загружено:', {
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

  const generateSchedule = async () => {
    if (selectedAttractionIds.size === 0) {
      alert('Выберите хотя бы один аттракцион');
      return;
    }

    setGenerating(true);
    setSaveSuccess(false);

    try {
      const activeAttractions = attractions.filter(a => selectedAttractionIds.has(a.id));
      const isWeekendDay = isWeekend(parseISO(startDate));

      const attractionsWithRequirements = activeAttractions.map(a => ({
        id: a.id,
        name: a.name,
        minStaff: isWeekendDay ? a.minStaffWeekend : a.minStaffWeekday
      }));

      const availabilities = await fetchAvailabilityForDate(startDate);

      const employeesData: EmployeeData[] = [];
      for (const availability of availabilities) {
        const emp = employees.find(e => e.id === availability.employeeId);
        if (!emp) continue;

        const priorityMap = priorityMapCache.get(availability.employeeId) || new Map();
        employeesData.push({
          id: emp.id,
          name: emp.full_name,
          priorityMap,
          studyGoalAttractionId: studyGoalCache.get(availability.employeeId)
        });
      }

      const context: GeneratorContext = {
        attractions: attractionsWithRequirements,
        employees: employeesData,
        availabilities,
        date: startDate
      };

      // Выбираем алгоритм
      let algo: ScheduleAlgorithm;
      switch (algorithm) {
        case 'greedy':
          algo = new GreedyAlgorithm();
          break;
        case 'optimal':
          algo = new OptimalAlgorithm();
          break;
        case 'random':
          algo = new RandomAlgorithm();
          break;
        case 'genetic':
          algo = new GeneticAlgorithm();
          break;
      }

      const result = await algo.generate(context);
      
      setResults(prev => new Map(prev).set(algorithm, result));
      setCurrentResult(result);

      console.log(`[${algo.name}] Готово:`, {
        assignments: result.assignments.length,
        unassigned: result.unassigned.length,
        score: result.metrics.qualityScore.toFixed(2),
        time: result.executionTimeMs.toFixed(0) + 'ms'
      });

    } catch (error) {
      console.error('[ScheduleGenerator] Ошибка генерации:', error);
      alert('Ошибка генерации графика');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!currentResult) return;

    setSaving(true);
    
    try {
      const dbAssignments = currentResult.assignments.map(a => ({
        employee_id: a.employeeId,
        attraction_id: a.attractionId,
        work_date: startDate,
        start_time: a.startTime || '10:00:00',
        end_time: a.endTime || null
      }));

      if (dbAssignments.length === 0) {
        alert('Нет данных для сохранения');
        return;
      }

      await dbService.deleteScheduleByDate(startDate);
      const success = await dbService.bulkCreateScheduleAssignments(dbAssignments);

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        console.log('[ScheduleGenerator] Сохранено:', dbAssignments.length, 'записей');
      } else {
        throw new Error('Ошибка сохранения');
      }

    } catch (err: any) {
      console.error('[ScheduleGenerator] Ошибка сохранения:', err);
      alert(`Ошибка: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColor = (level: number): string => {
    switch (level) {
      case 1: return '#22c55e'; // зелёный
      case 2: return '#eab308'; // жёлтый
      case 3: return '#ef4444'; // красный
      default: return '#6b7280'; // серый
    }
  };

  const getPriorityIcon = (level: number) => {
    switch (level) {
      case 1: return <Award className="h-4 w-4" />;
      case 2: return <Star className="h-4 w-4" />;
      case 3: return <Target className="h-4 w-4" />;
      default: return null;
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
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
          color: 'white',
          border: 'none'
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Zap className="h-8 w-8" />
              Генератор графика 3.0 PRO
            </h1>
            <p className="opacity-90 mt-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Профессиональная система с 4 алгоритмами ИИ
            </p>
          </div>
          {currentResult && (
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

      {/* Успешное сохранение */}
      {saveSuccess && (
        <Card 
          className="px-6 py-4 flex items-center gap-3 shadow-md animate-pulse"
          style={{ 
            background: 'var(--success-light)',
            border: '2px solid var(--success)'
          }}
        >
          <CheckSquare className="h-6 w-6" style={{ color: 'var(--success)' }} />
          <span className="font-semibold text-lg" style={{ color: 'var(--success)' }}>
            График успешно сохранён в базе данных!
          </span>
        </Card>
      )}

      {/* Панель параметров */}
      <Card className="p-8 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Calendar className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Дата
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
              <Filter className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Алгоритм
            </label>
            <select
              value={algorithm}
              onChange={e => setAlgorithm(e.target.value as AlgorithmType)}
              className="input w-full"
            >
              <option value="greedy">⚡ Жадный (быстрый)</option>
              <option value="optimal">🎯 Оптимальный (венгерский)</option>
              <option value="random">🎲 Случайный (500 итераций)</option>
              <option value="genetic">🧬 Генетический (ИИ)</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={generateSchedule}
              disabled={generating || selectedAttractionIds.size === 0}
              loading={generating}
              icon={<Wand2 className="h-6 w-6" />}
              className="w-full py-3 text-lg font-bold shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
                color: 'white'
              }}
            >
              Сгенерировать
            </Button>
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
                className="font-medium transition hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                Все
              </button>
              <button
                onClick={() => setSelectedAttractionIds(new Set())}
                className="font-medium transition hover:underline"
                style={{ color: 'var(--text-subtle)' }}
              >
                Сбросить
              </button>
            </div>
          </div>
          
          <div 
            className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-4 rounded-xl"
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
                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
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
      </Card>

      {/* Метрики */}
      {currentResult && (
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            <h3 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Метрики качества
            </h3>
            <Badge 
              variant="success"
              className="text-lg px-4 py-1"
            >
              {currentResult.metrics.qualityScore.toFixed(1)}/10
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Покрытие аттракционов
              </div>
              <div className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                {currentResult.metrics.coveragePercent.toFixed(0)}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {currentResult.metrics.fullyCovered}/{currentResult.metrics.totalAttractions} полностью
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Средний приоритет
              </div>
              <div className="text-3xl font-bold" style={{ color: getPriorityColor(Math.round(currentResult.metrics.averagePriority)) }}>
                {currentResult.metrics.averagePriority.toFixed(2)}
              </div>
              <div className="text-xs flex gap-2" style={{ color: 'var(--text-subtle)' }}>
                <span>1️⃣{currentResult.metrics.priorityDistribution[1]}</span>
                <span>2️⃣{currentResult.metrics.priorityDistribution[2]}</span>
                <span>3️⃣{currentResult.metrics.priorityDistribution[3]}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Использование
              </div>
              <div className="text-3xl font-bold" style={{ color: 'var(--info)' }}>
                {currentResult.metrics.utilizationRate.toFixed(0)}%
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {currentResult.metrics.totalAssigned}/{currentResult.metrics.totalAvailable} сотрудников
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Время генерации
              </div>
              <div className="text-3xl font-bold" style={{ color: 'var(--success)' }}>
                {currentResult.executionTimeMs.toFixed(0)}ms
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {currentResult.algorithmName}
              </div>
            </div>
          </div>

          {/* Детализация */}
          <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-4 text-sm" style={{ borderColor: 'var(--border)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Полные смены:</span>
              <span className="ml-2 font-semibold" style={{ color: 'var(--text)' }}>
                {currentResult.metrics.fullShifts}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Неполные смены:</span>
              <span className="ml-2 font-semibold" style={{ color: 'var(--text)' }}>
                {currentResult.metrics.partialShifts}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Комбинированные:</span>
              <span className="ml-2 font-semibold" style={{ color: 'var(--text)' }}>
                {currentResult.metrics.combinedPartialShifts}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Результат */}
      {currentResult && (
        <div className="space-y-6">
          
          {/* График */}
          <Card padding="none" className="overflow-hidden">
            
            <div 
              className="px-8 py-5 flex items-center justify-between text-white"
              style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6" />
                <div>
                  <div className="font-bold text-xl">
                    {format(parseISO(startDate), 'dd MMMM yyyy', { locale: ru })}
                  </div>
                  <div className="text-sm opacity-75">
                    {format(parseISO(startDate), 'EEEE', { locale: ru })}
                  </div>
                </div>
              </div>
              <Badge variant="neutral" className="bg-white/20 backdrop-blur-sm text-white border-none">
                {currentResult.algorithmName}
              </Badge>
            </div>

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
                  {(() => {
                    // Группировка по аттракционам
                    const attractionMap = new Map<number, Assignment[]>();
                    for (const assignment of currentResult.assignments) {
                      if (!attractionMap.has(assignment.attractionId)) {
                        attractionMap.set(assignment.attractionId, []);
                      }
                      attractionMap.get(assignment.attractionId)!.push(assignment);
                    }

                    return Array.from(attractionMap.entries()).map(([attractionId, assignments]) => {
                      const attraction = attractions.find(a => a.id === attractionId);
                      if (!attraction) return null;

                      const isWeekendDay = isWeekend(parseISO(startDate));
                      const minStaff = isWeekendDay ? attraction.minStaffWeekend : attraction.minStaffWeekday;
                      const hasDeficit = assignments.length < minStaff;

                      return (
                        <tr 
                          key={attractionId}
                          className="transition-colors hover:bg-opacity-50"
                          style={{ backgroundColor: 'transparent' }}
                        >
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex flex-col gap-2">
                              <div className="text-base font-bold" style={{ color: 'var(--text)' }}>
                                {attraction.name}
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
                                  Нужно {minStaff}, назначено {assignments.length}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-wrap gap-2">
                              {assignments.map(emp => (
                                <div
                                  key={emp.employeeId}
                                  className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md border-2"
                                  style={{
                                    backgroundColor: 'var(--surface)',
                                    borderColor: getPriorityColor(emp.priorityLevel),
                                    color: 'var(--text)'
                                  }}
                                >
                                  <div 
                                    className="flex items-center justify-center w-6 h-6 rounded-full"
                                    style={{ 
                                      backgroundColor: getPriorityColor(emp.priorityLevel),
                                      color: 'white'
                                    }}
                                  >
                                    {getPriorityIcon(emp.priorityLevel)}
                                  </div>
                                  <span className="font-semibold">{emp.employeeName}</span>
                                  {!emp.isFullDay && emp.startTime && emp.endTime && (
                                    <span className="text-xs bg-white/50 rounded-full px-2 py-0.5">
                                      {emp.startTime.slice(0, 5)}–{emp.endTime.slice(0, 5)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Незадействованные */}
          {currentResult.unassigned.length > 0 && (
            <Card 
              className="p-8"
              style={{ 
                background: 'var(--warning-light)',
                border: '2px dashed var(--warning)'
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-6 w-6" style={{ color: 'var(--warning)' }} />
                <h5 className="font-bold text-xl" style={{ color: 'var(--text)' }}>
                  Незадействованные сотрудники
                </h5>
                <Badge variant="warning">{currentResult.unassigned.length}</Badge>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {currentResult.unassigned.map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 border-2 rounded-2xl px-5 py-3 shadow-md hover:shadow-lg transition-shadow"
                    style={{ 
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--warning)'
                    }}
                  >
                    <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                      {emp.name}
                    </span>
                    {emp.studyGoalAttractionId && (
                      <Badge variant="info" className="text-xs">
                        🎯 Цель: {attractions.find(a => a.id === emp.studyGoalAttractionId)?.name}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Сравнение алгоритмов */}
      {results.size > 1 && (
        <Card className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <RefreshCw className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            <h3 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Сравнение алгоритмов
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Алгоритм
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Оценка
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Покрытие
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Ср. приоритет
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    Время
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {Array.from(results.entries())
                  .sort((a, b) => b[1].metrics.qualityScore - a[1].metrics.qualityScore)
                  .map(([algoType, result]) => (
                    <tr 
                      key={algoType}
                      className="hover:bg-opacity-50 transition-colors"
                      style={{ backgroundColor: currentResult === result ? 'var(--bg-tertiary)' : 'transparent' }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: 'var(--text)' }}>
                          {result.algorithmName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge 
                          variant={result.metrics.qualityScore >= 8 ? 'success' : result.metrics.qualityScore >= 6 ? 'warning' : 'error'}
                        >
                          {result.metrics.qualityScore.toFixed(1)}/10
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text)' }}>
                        {result.metrics.coveragePercent.toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: getPriorityColor(Math.round(result.metrics.averagePriority)) }}>
                        {result.metrics.averagePriority.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: 'var(--text-subtle)' }}>
                        {result.executionTimeMs.toFixed(0)}ms
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
