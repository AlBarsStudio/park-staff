// lib/DatabaseService.ts

import { supabase } from './supabase';
import { format, parseISO } from 'date-fns';

// ============================================================
// ТИПЫ ДАННЫХ
// ============================================================

export interface Employee {
  id: number;
  full_name: string;
  age: number | null;
  phone_number: string | null;
  telegram: string | null;
  vk: string | null;
  max: string | null;
  base_hourly_rate: number | null;
  last_login: string | null;
  auth_uid: string | null;
  access_level: number | null;
  created_at: string;
}

export interface Attraction {
  id: number;
  name: string;
  min_staff_weekday: number | null;
  min_staff_weekend: number | null;
  coefficient: number;
}

export interface ScheduleAssignment {
  id: number;
  work_date: string;
  employee_id: number;
  attraction_id: number;
  start_time: string;
  end_time: string | null;
  version_type: 'original' | 'edited';
  original_id: number | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  employees?: { id: number; full_name: string } | null;
  attractions?: { id: number; name: string; coefficient: number } | null;
}

export interface EmployeeAvailability {
  id: number;
  employee_id: number;
  work_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string | null;
  // Joined data
  employees?: { id: number; full_name: string } | null;
}

export interface ActualWorkLog {
  id: number;
  schedule_assignment_id: number;
  actual_start: string;
  actual_end: string;
  created_at: string;
}

export interface EmployeeStudyGoal {
  id: number;
  employee_id: number;
  attraction_id: number;
  created_at: string;
  updated_at: string | null;
}

export interface EmployeeAttractionPriority {
  id: number;
  employee_id: number;
  priority_level: 1 | 2 | 3;
  attraction_ids: number[];
  created_at: string;
  updated_at: string | null;
}

export interface Admin {
  id: number;
  full_name: string | null;
  auth_uid: string | null;
  access_level: number | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  action_type: string;
  description: string;
  admin_id: number | null;
  employee_id: number | null;
  created_at: string;
}

// ============================================================
// КЛАСС DATABASE SERVICE
// ============================================================

export class DatabaseService {
  // Хранилище данных в памяти
  private data = {
    employees: [] as Employee[],
    attractions: [] as Attraction[],
    scheduleAssignments: [] as ScheduleAssignment[],
    employeeAvailability: [] as EmployeeAvailability[],
    actualWorkLog: [] as ActualWorkLog[],
    studyGoals: [] as EmployeeStudyGoal[],
    priorities: [] as EmployeeAttractionPriority[],
    activityLog: [] as ActivityLog[],
    currentAdmin: null as Admin | null,
  };

  private adminId: number | null = null;
  private isInitialized = false;

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

async init(adminAuthUid: string | undefined): Promise<boolean> {
  try {
    // Проверка валидности auth_uid
    if (!adminAuthUid) {
      console.error('[DB] Ошибка: auth_uid не предоставлен');
      return false;
    }

    console.log('[DB] Инициализация DatabaseService для админа:', adminAuthUid);

    // 1. Получаем текущего администратора
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('id, full_name, auth_uid, access_level, created_at')
      .eq('auth_uid', adminAuthUid)
      .maybeSingle(); // Используем maybeSingle вместо single

    if (adminError) {
      console.error('[DB] Ошибка запроса администратора:', adminError);
      return false;
    }

    if (!adminData) {
      console.error('[DB] Администратор не найден с auth_uid:', adminAuthUid);
      return false;
    }

    this.data.currentAdmin = adminData;
    this.adminId = adminData.id;

    console.log('[DB] Администратор найден:', adminData.full_name, 'ID:', this.adminId);

    // 2. Параллельная загрузка всех данных
    const [
      employeesRes,
      attractionsRes,
      scheduleRes,
      availabilityRes,
      actualLogRes,
      studyGoalsRes,
      prioritiesRes,
      activityLogRes,
    ] = await Promise.all([
      this.loadEmployees(),
      this.loadAttractions(),
      this.loadScheduleAssignments(),
      this.loadEmployeeAvailability(),
      this.loadActualWorkLog(),
      this.loadStudyGoals(),
      this.loadPriorities(),
      this.loadActivityLog(),
    ]);

    // Проверяем результаты загрузки
    const allSuccess = [
      employeesRes,
      attractionsRes,
      scheduleRes,
      availabilityRes,
      actualLogRes,
      studyGoalsRes,
      prioritiesRes,
      activityLogRes,
    ].every((res) => res);

    if (allSuccess) {
      this.isInitialized = true;
      console.log('[DB] Инициализация завершена успешно');
      console.log('[DB] Загружено данных:', {
        employees: this.data.employees.length,
        attractions: this.data.attractions.length,
        scheduleAssignments: this.data.scheduleAssignments.length,
        employeeAvailability: this.data.employeeAvailability.length,
        actualWorkLog: this.data.actualWorkLog.length,
        studyGoals: this.data.studyGoals.length,
        priorities: this.data.priorities.length,
        activityLog: this.data.activityLog.length,
      });
      return true;
    } else {
      console.error('[DB] Ошибка при загрузке некоторых данных');
      return false;
    }
  } catch (error) {
    console.error('[DB] Критическая ошибка инициализации:', error);
    return false;
  }
}

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ ИЗ БД
  // ============================================================

  private async loadEmployees(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, age, phone_number, telegram, vk, max, base_hourly_rate, last_login, auth_uid, access_level, created_at')
        .order('full_name', { ascending: true });

      if (error) throw error;
      this.data.employees = data || [];
      console.log('[DB] Загружено сотрудников:', this.data.employees.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки сотрудников:', error);
      return false;
    }
  }

  private async loadAttractions(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('attractions')
        .select('id, name, min_staff_weekday, min_staff_weekend, coefficient')
        .order('name', { ascending: true });

      if (error) throw error;
      this.data.attractions = data || [];
      console.log('[DB] Загружено аттракционов:', this.data.attractions.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки аттракционов:', error);
      return false;
    }
  }

  private async loadScheduleAssignments(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('schedule_assignments')
        .select(`
          id, work_date, employee_id, attraction_id, start_time, end_time,
          version_type, original_id, edited_at, created_at, updated_at
        `)
        .order('work_date', { ascending: true })
        .order('employee_id', { ascending: true });

      if (error) throw error;

      // Обогащаем данными о сотрудниках и аттракционах
      const enriched = (data || []).map((item) => {
        const employee = this.data.employees.find((e) => e.id === item.employee_id);
        const attraction = this.data.attractions.find((a) => a.id === item.attraction_id);

        return {
          ...item,
          employees: employee ? { id: employee.id, full_name: employee.full_name } : null,
          attractions: attraction ? { id: attraction.id, name: attraction.name, coefficient: attraction.coefficient } : null,
        };
      });

      this.data.scheduleAssignments = enriched;
      console.log('[DB] Загружено назначений графика:', this.data.scheduleAssignments.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки графика:', error);
      return false;
    }
  }

  private async loadEmployeeAvailability(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('employee_availability')
        .select('id, employee_id, work_date, is_full_day, start_time, end_time, comment, created_at, updated_at')
        .order('work_date', { ascending: true });

      if (error) throw error;

      // Обогащаем данными о сотрудниках
      const enriched = (data || []).map((item) => {
        const employee = this.data.employees.find((e) => e.id === item.employee_id);
        return {
          ...item,
          employees: employee ? { id: employee.id, full_name: employee.full_name } : null,
        };
      });

      this.data.employeeAvailability = enriched;
      console.log('[DB] Загружено записей доступности:', this.data.employeeAvailability.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки доступности:', error);
      return false;
    }
  }

  private async loadActualWorkLog(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('actual_work_log')
        .select('id, schedule_assignment_id, actual_start, actual_end, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.data.actualWorkLog = data || [];
      console.log('[DB] Загружено фактических отработок:', this.data.actualWorkLog.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки фактических отработок:', error);
      return false;
    }
  }

  private async loadStudyGoals(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('employee_study_goals')
        .select('id, employee_id, attraction_id, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.data.studyGoals = data || [];
      console.log('[DB] Загружено целей обучения:', this.data.studyGoals.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки целей обучения:', error);
      return false;
    }
  }

  private async loadPriorities(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('employee_attraction_priorities')
        .select('id, employee_id, priority_level, attraction_ids, created_at, updated_at')
        .order('employee_id', { ascending: true })
        .order('priority_level', { ascending: true });

      if (error) throw error;
      this.data.priorities = data || [];
      console.log('[DB] Загружено приоритетов:', this.data.priorities.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки приоритетов:', error);
      return false;
    }
  }

  private async loadActivityLog(): Promise<boolean> {
    try {
      // Загружаем последние 500 записей логов
      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action_type, description, admin_id, employee_id, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      this.data.activityLog = data || [];
      console.log('[DB] Загружено логов активности:', this.data.activityLog.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка загрузки логов:', error);
      return false;
    }
  }

  // ============================================================
  // ГЕТТЕРЫ ДАННЫХ
  // ============================================================

  getEmployees(): Employee[] {
    return this.data.employees;
  }

  getAttractions(): Attraction[] {
    return this.data.attractions;
  }

  getScheduleAssignments(): ScheduleAssignment[] {
    return this.data.scheduleAssignments;
  }

  getEmployeeAvailability(): EmployeeAvailability[] {
    return this.data.employeeAvailability;
  }

  getActualWorkLog(): ActualWorkLog[] {
    return this.data.actualWorkLog;
  }

  getStudyGoals(): EmployeeStudyGoal[] {
    return this.data.studyGoals;
  }

  getPriorities(): EmployeeAttractionPriority[] {
    return this.data.priorities;
  }

  getActivityLog(): ActivityLog[] {
    return this.data.activityLog;
  }

  getCurrentAdmin(): Admin | null {
    return this.data.currentAdmin;
  }

  // Фильтры для графика по дате
  getScheduleByDate(date: Date): ScheduleAssignment[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    return this.data.scheduleAssignments.filter((s) => s.work_date === dateStr);
  }

  getScheduleByDateRange(startDate: Date, endDate: Date): ScheduleAssignment[] {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    return this.data.scheduleAssignments.filter((s) => s.work_date >= start && s.work_date <= end);
  }

  getAvailabilityByDate(date: Date): EmployeeAvailability[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    return this.data.employeeAvailability.filter((a) => a.work_date === dateStr);
  }

  getEmployeeById(id: number): Employee | undefined {
    return this.data.employees.find((e) => e.id === id);
  }

  getAttractionById(id: number): Attraction | undefined {
    return this.data.attractions.find((a) => a.id === id);
  }

  // ============================================================
  // ЛОГИРОВАНИЕ АКТИВНОСТИ
  // ============================================================

  private async logActivity(actionType: string, description: string, employeeId: number | null = null): Promise<void> {
    if (!this.adminId) {
      console.error('[DB] Невозможно записать лог: adminId не установлен');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('activity_log')
        .insert({
          action_type: actionType,
          description: description,
          admin_id: this.adminId,
          employee_id: employeeId,
        })
        .select()
        .single();

      if (error) throw error;

      // Добавляем в локальный кэш
      if (data) {
        this.data.activityLog.unshift(data);
        // Ограничиваем размер кэша
        if (this.data.activityLog.length > 500) {
          this.data.activityLog = this.data.activityLog.slice(0, 500);
        }
      }

      console.log('[DB] Лог записан:', actionType, '-', description);
    } catch (error) {
      console.error('[DB] Ошибка записи лога:', error);
    }
  }

  // ============================================================
  // CRUD: EMPLOYEE AVAILABILITY (Управление сменами)
  // ============================================================

  async createAvailability(data: {
    employee_id: number;
    work_date: string;
    is_full_day: boolean;
    start_time?: string | null;
    end_time?: string | null;
    comment?: string | null;
  }): Promise<EmployeeAvailability | null> {
    try {
      const { data: inserted, error } = await supabase
        .from('employee_availability')
        .insert({
          employee_id: data.employee_id,
          work_date: data.work_date,
          is_full_day: data.is_full_day,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          comment: data.comment || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Обогащаем данными сотрудника
      const employee = this.getEmployeeById(data.employee_id);
      const enriched: EmployeeAvailability = {
        ...inserted,
        employees: employee ? { id: employee.id, full_name: employee.full_name } : null,
      };

      // Добавляем в локальный кэш
      this.data.employeeAvailability.push(enriched);
      this.data.employeeAvailability.sort((a, b) => a.work_date.localeCompare(b.work_date));

      // Логируем
      await this.logActivity(
        'availability_create',
        `Добавлена смена для ${employee?.full_name} на ${data.work_date}`,
        data.employee_id
      );

      console.log('[DB] Создана доступность:', inserted.id);
      return enriched;
    } catch (error) {
      console.error('[DB] Ошибка создания доступности:', error);
      return null;
    }
  }

  async updateAvailability(
    id: number,
    data: Partial<{
      is_full_day: boolean;
      start_time: string | null;
      end_time: string | null;
      comment: string | null;
    }>
  ): Promise<boolean> {
    try {
      const existing = this.data.employeeAvailability.find((a) => a.id === id);
      if (!existing) {
        console.error('[DB] Доступность не найдена:', id);
        return false;
      }

      const { error } = await supabase.from('employee_availability').update(data).eq('id', id);

      if (error) throw error;

      // Обновляем локальный кэш
      const index = this.data.employeeAvailability.findIndex((a) => a.id === id);
      if (index !== -1) {
        this.data.employeeAvailability[index] = { ...existing, ...data };
      }

      const employee = this.getEmployeeById(existing.employee_id);
      await this.logActivity(
        'availability_update',
        `Изменена смена для ${employee?.full_name} на ${existing.work_date}`,
        existing.employee_id
      );

      console.log('[DB] Обновлена доступность:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка обновления доступности:', error);
      return false;
    }
  }

  async deleteAvailability(id: number): Promise<boolean> {
    try {
      const existing = this.data.employeeAvailability.find((a) => a.id === id);
      if (!existing) {
        console.error('[DB] Доступность не найдена:', id);
        return false;
      }

      const { error } = await supabase.from('employee_availability').delete().eq('id', id);

      if (error) throw error;

      // Удаляем из локального кэша
      this.data.employeeAvailability = this.data.employeeAvailability.filter((a) => a.id !== id);

      const employee = this.getEmployeeById(existing.employee_id);
      await this.logActivity(
        'availability_delete',
        `Удалена смена для ${employee?.full_name} на ${existing.work_date}`,
        existing.employee_id
      );

      console.log('[DB] Удалена доступность:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка удаления доступности:', error);
      return false;
    }
  }

  // ============================================================
  // CRUD: SCHEDULE ASSIGNMENTS (График работы)
  // ============================================================

  async createScheduleAssignment(data: {
    employee_id: number;
    attraction_id: number;
    work_date: string;
    start_time: string;
    end_time: string | null;
  }): Promise<ScheduleAssignment | null> {
    try {
      const { data: inserted, error } = await supabase
        .from('schedule_assignments')
        .insert({
          employee_id: data.employee_id,
          attraction_id: data.attraction_id,
          work_date: data.work_date,
          start_time: data.start_time,
          end_time: data.end_time,
          version_type: 'original',
        })
        .select()
        .single();

      if (error) throw error;

      // Обогащаем данными
      const employee = this.getEmployeeById(data.employee_id);
      const attraction = this.getAttractionById(data.attraction_id);
      const enriched: ScheduleAssignment = {
        ...inserted,
        employees: employee ? { id: employee.id, full_name: employee.full_name } : null,
        attractions: attraction ? { id: attraction.id, name: attraction.name, coefficient: attraction.coefficient } : null,
      };

      this.data.scheduleAssignments.push(enriched);
      this.data.scheduleAssignments.sort((a, b) => a.work_date.localeCompare(b.work_date));

      await this.logActivity(
        'schedule_create',
        `Создано назначение: ${employee?.full_name} на ${attraction?.name}, ${data.work_date}`,
        data.employee_id
      );

      console.log('[DB] Создано назначение графика:', inserted.id);
      return enriched;
    } catch (error) {
      console.error('[DB] Ошибка создания назначения:', error);
      return null;
    }
  }

  async bulkCreateScheduleAssignments(
    assignments: Array<{
      employee_id: number;
      attraction_id: number;
      work_date: string;
      start_time: string;
      end_time: string | null;
    }>
  ): Promise<boolean> {
    try {
      const toInsert = assignments.map((a) => ({
        employee_id: a.employee_id,
        attraction_id: a.attraction_id,
        work_date: a.work_date,
        start_time: a.start_time,
        end_time: a.end_time,
        version_type: 'original',
      }));

      const { data: inserted, error } = await supabase.from('schedule_assignments').insert(toInsert).select();

      if (error) throw error;

      // Обогащаем и добавляем в кэш
      const enriched = (inserted || []).map((item) => {
        const employee = this.getEmployeeById(item.employee_id);
        const attraction = this.getAttractionById(item.attraction_id);
        return {
          ...item,
          employees: employee ? { id: employee.id, full_name: employee.full_name } : null,
          attractions: attraction ? { id: attraction.id, name: attraction.name, coefficient: attraction.coefficient } : null,
        };
      });

      this.data.scheduleAssignments.push(...enriched);
      this.data.scheduleAssignments.sort((a, b) => a.work_date.localeCompare(b.work_date));

      await this.logActivity('schedule_bulk_create', `Массовое создание графика: ${assignments.length} записей`);

      console.log('[DB] Массово создано назначений:', inserted?.length);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка массового создания назначений:', error);
      return false;
    }
  }

  async updateScheduleAssignment(
    id: number,
    data: Partial<{
      start_time: string;
      end_time: string | null;
      attraction_id: number;
    }>
  ): Promise<boolean> {
    try {
      const existing = this.data.scheduleAssignments.find((s) => s.id === id);
      if (!existing) {
        console.error('[DB] Назначение не найдено:', id);
        return false;
      }

      // Создаём edited версию
      const { error } = await supabase
        .from('schedule_assignments')
        .update({
          ...data,
          version_type: 'edited',
          edited_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Обновляем локальный кэш
      const index = this.data.scheduleAssignments.findIndex((s) => s.id === id);
      if (index !== -1) {
        this.data.scheduleAssignments[index] = {
          ...existing,
          ...data,
          version_type: 'edited',
          edited_at: new Date().toISOString(),
        };

        // Обновляем joined данные если изменился attraction_id
        if (data.attraction_id) {
          const attraction = this.getAttractionById(data.attraction_id);
          this.data.scheduleAssignments[index].attractions = attraction
            ? { id: attraction.id, name: attraction.name, coefficient: attraction.coefficient }
            : null;
        }
      }

      const employee = this.getEmployeeById(existing.employee_id);
      await this.logActivity(
        'schedule_update',
        `Изменено назначение для ${employee?.full_name} на ${existing.work_date}`,
        existing.employee_id
      );

      console.log('[DB] Обновлено назначение:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка обновления назначения:', error);
      return false;
    }
  }

  async deleteScheduleAssignment(id: number): Promise<boolean> {
    try {
      const existing = this.data.scheduleAssignments.find((s) => s.id === id);
      if (!existing) {
        console.error('[DB] Назначение не найдено:', id);
        return false;
      }

      const { error } = await supabase.from('schedule_assignments').delete().eq('id', id);

      if (error) throw error;

      this.data.scheduleAssignments = this.data.scheduleAssignments.filter((s) => s.id !== id);

      const employee = this.getEmployeeById(existing.employee_id);
      await this.logActivity(
        'schedule_delete',
        `Удалено назначение для ${employee?.full_name} на ${existing.work_date}`,
        existing.employee_id
      );

      console.log('[DB] Удалено назначение:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка удаления назначения:', error);
      return false;
    }
  }

  async deleteScheduleByDate(workDate: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('schedule_assignments').delete().eq('work_date', workDate);

      if (error) throw error;

      const countBefore = this.data.scheduleAssignments.length;
      this.data.scheduleAssignments = this.data.scheduleAssignments.filter((s) => s.work_date !== workDate);
      const deleted = countBefore - this.data.scheduleAssignments.length;

      await this.logActivity('schedule_delete_by_date', `Удалён весь график на ${workDate} (${deleted} записей)`);

      console.log('[DB] Удалён график на дату:', workDate, '- удалено записей:', deleted);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка удаления графика по дате:', error);
      return false;
    }
  }

  // ============================================================
  // CRUD: ATTRACTIONS (Аттракционы)
  // ============================================================

  async createAttraction(data: {
    name: string;
    min_staff_weekday?: number | null;
    min_staff_weekend?: number | null;
    coefficient?: number;
  }): Promise<Attraction | null> {
    try {
      const { data: inserted, error } = await supabase
        .from('attractions')
        .insert({
          name: data.name,
          min_staff_weekday: data.min_staff_weekday || null,
          min_staff_weekend: data.min_staff_weekend || null,
          coefficient: data.coefficient || 1.0,
        })
        .select()
        .single();

      if (error) throw error;

      this.data.attractions.push(inserted);
      this.data.attractions.sort((a, b) => a.name.localeCompare(b.name));

      await this.logActivity('attraction_create', `Создан аттракцион: ${data.name}`);

      console.log('[DB] Создан аттракцион:', inserted.id);
      return inserted;
    } catch (error) {
      console.error('[DB] Ошибка создания аттракциона:', error);
      return null;
    }
  }

  async updateAttraction(
    id: number,
    data: Partial<{
      name: string;
      min_staff_weekday: number | null;
      min_staff_weekend: number | null;
      coefficient: number;
    }>
  ): Promise<boolean> {
    try {
      const existing = this.getAttractionById(id);
      if (!existing) {
        console.error('[DB] Аттракцион не найден:', id);
        return false;
      }

      const { error } = await supabase.from('attractions').update(data).eq('id', id);

      if (error) throw error;

      const index = this.data.attractions.findIndex((a) => a.id === id);
      if (index !== -1) {
        this.data.attractions[index] = { ...existing, ...data };
      }

      await this.logActivity('attraction_update', `Изменён аттракцион: ${existing.name}`);

      console.log('[DB] Обновлён аттракцион:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка обновления аттракциона:', error);
      return false;
    }
  }

  async deleteAttraction(id: number): Promise<boolean> {
    try {
      const existing = this.getAttractionById(id);
      if (!existing) {
        console.error('[DB] Аттракцион не найден:', id);
        return false;
      }

      const { error } = await supabase.from('attractions').delete().eq('id', id);

      if (error) throw error;

      this.data.attractions = this.data.attractions.filter((a) => a.id !== id);

      await this.logActivity('attraction_delete', `Удалён аттракцион: ${existing.name}`);

      console.log('[DB] Удалён аттракцион:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка удаления аттракциона:', error);
      return false;
    }
  }

  // ============================================================
  // CRUD: EMPLOYEES (Сотрудники)
  // ============================================================

  async updateEmployee(
    id: number,
    data: Partial<{
      full_name: string;
      age: number | null;
      phone_number: string | null;
      telegram: string | null;
      vk: string | null;
      max: string | null;
      base_hourly_rate: number | null;
    }>
  ): Promise<boolean> {
    try {
      const existing = this.getEmployeeById(id);
      if (!existing) {
        console.error('[DB] Сотрудник не найден:', id);
        return false;
      }

      const { error } = await supabase.from('employees').update(data).eq('id', id);

      if (error) throw error;

      const index = this.data.employees.findIndex((e) => e.id === id);
      if (index !== -1) {
        this.data.employees[index] = { ...existing, ...data };
      }

      await this.logActivity('employee_update', `Изменены данные сотрудника: ${existing.full_name}`, id);

      console.log('[DB] Обновлён сотрудник:', id);
      return true;
    } catch (error) {
      console.error('[DB] Ошибка обновления сотрудника:', error);
      return false;
    }
  }

  // ============================================================
  // ПОЛНОЕ ОБНОВЛЕНИЕ ДАННЫХ
  // ============================================================

  async refresh(): Promise<boolean> {
    console.log('[DB] Полное обновление данных...');
    if (!this.adminId || !this.data.currentAdmin) {
      console.error('[DB] Невозможно обновить: не инициализирован');
      return false;
    }

    // Перезагружаем все данные
    const results = await Promise.all([
      this.loadEmployees(),
      this.loadAttractions(),
      this.loadScheduleAssignments(),
      this.loadEmployeeAvailability(),
      this.loadActualWorkLog(),
      this.loadStudyGoals(),
      this.loadPriorities(),
      this.loadActivityLog(),
    ]);

    const success = results.every((r) => r);
    console.log('[DB] Обновление завершено:', success ? 'успешно' : 'с ошибками');
    return success;
  }

  // ============================================================
  // ПРОВЕРКА СОСТОЯНИЯ
  // ============================================================

  isReady(): boolean {
    return this.isInitialized && this.adminId !== null;
  }
}

// Экспортируем синглтон
export const dbService = new DatabaseService();
