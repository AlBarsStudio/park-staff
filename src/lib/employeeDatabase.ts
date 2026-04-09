import { supabase } from './supabase';
import { logActivity } from './activityLog';

// ======================== ТИПЫ ========================
export interface Employee {
  id: number;
  created_at: string;
  full_name: string;
  age: number | null;
  telegram: string | null;
  max: string | null;
  vk: string | null;
  phone_number: string | null;
  access_level: number | null;
  auth_uid: string | null;
  base_hourly_rate: number;
  last_login: string | null;
}

export interface Attraction {
  id: number;
  name: string;
  min_staff_weekday: number | null;
  min_staff_weekend: number | null;
  coefficient: number;
}

export interface EmployeeAvailability {
  id: number;
  employee_id: number;
  work_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string | null;
  comment: string | null;
}

export interface ScheduleAssignment {
  id: number;
  work_date: string;
  employee_id: number;
  attraction_id: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  version_type: string;
  edited_at: string | null;
  original_id: number | null;
  attraction?: Attraction;
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
  attraction?: Attraction;
}

export interface EmployeeAttractionPriority {
  id: number;
  employee_id: number;
  priority_level: number;
  attraction_ids: number[];
  created_at: string;
  updated_at: string | null;
  attractions?: Attraction[];
}

// ======================== КЛАСС ДЛЯ УПРАВЛЕНИЯ ДАННЫМИ ========================
class EmployeeDataManager {
  private employeeId: number;
  
  // Кэш данных
  private cache = {
    employee: null as Employee | null,
    attractions: new Map<number, Attraction>(),
    availability: [] as EmployeeAvailability[],
    scheduleAssignments: [] as ScheduleAssignment[],
    actualWorkLogs: [] as ActualWorkLog[],
    studyGoal: null as EmployeeStudyGoal | null,
    priorities: [] as EmployeeAttractionPriority[],
    lastUpdate: 0,
  };

  // Подписки Realtime
  private subscriptions: any[] = [];

  constructor(employeeId: number) {
    this.employeeId = employeeId;
  }

  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  async initialize(): Promise<void> {
    console.log('🔄 Инициализация данных сотрудника:', this.employeeId);
    
    await Promise.all([
      this.loadEmployee(),
      this.loadAttractions(),
      this.loadAvailability(),
      this.loadScheduleAssignments(),
      this.loadActualWorkLogs(),
      this.loadStudyGoal(),
      this.loadPriorities(),
    ]);

    this.setupRealtimeSubscriptions();
    this.cache.lastUpdate = Date.now();
    
    console.log('✅ Данные сотрудника загружены');
  }

  // ==================== ЗАГРУЗКА ДАННЫХ ====================
  
  private async loadEmployee(): Promise<void> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', this.employeeId)
      .single();

    if (error) {
      console.error('❌ Ошибка загрузки сотрудника:', error);
      throw error;
    }

    this.cache.employee = data;
    console.log('✅ Сотрудник загружен:', data.full_name);
  }

  private async loadAttractions(): Promise<void> {
    const { data, error } = await supabase
      .from('attractions')
      .select('*')
      .order('name');

    if (error) {
      console.error('❌ Ошибка загрузки аттракционов:', error);
      return;
    }

    this.cache.attractions.clear();
    data?.forEach(attraction => {
      this.cache.attractions.set(attraction.id, attraction);
    });

    console.log('✅ Загружено аттракционов:', data?.length || 0);
  }

  private async loadAvailability(): Promise<void> {
    const { data, error } = await supabase
      .from('employee_availability')
      .select('*')
      .eq('employee_id', this.employeeId)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки доступности:', error);
      return;
    }

    this.cache.availability = data || [];
    console.log('✅ Загружено смен доступности:', data?.length || 0);
  }

  private async loadScheduleAssignments(): Promise<void> {
    const { data, error } = await supabase
      .from('schedule_assignments')
      .select('*')
      .eq('employee_id', this.employeeId)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки расписания:', error);
      return;
    }

    // Обогащаем данными об аттракционах
    const enrichedData = (data || []).map(schedule => ({
      ...schedule,
      attraction: this.cache.attractions.get(schedule.attraction_id),
    })) as ScheduleAssignment[];

    this.cache.scheduleAssignments = enrichedData;
    console.log('✅ Загружено смен по расписанию:', data?.length || 0);
  }

  private async loadActualWorkLogs(): Promise<void> {
    // Получаем ID всех смен сотрудника
    const scheduleIds = this.cache.scheduleAssignments.map(s => s.id);
    
    if (scheduleIds.length === 0) {
      this.cache.actualWorkLogs = [];
      return;
    }

    const { data, error } = await supabase
      .from('actual_work_log')
      .select('*')
      .in('schedule_assignment_id', scheduleIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Ошибка загрузки фактических отметок:', error);
      return;
    }

    this.cache.actualWorkLogs = data || [];
    console.log('✅ Загружено фактических отметок:', data?.length || 0);
  }

  private async loadStudyGoal(): Promise<void> {
    const { data, error } = await supabase
      .from('employee_study_goals')
      .select('*')
      .eq('employee_id', this.employeeId)
      .maybeSingle();

    if (error) {
      console.error('❌ Ошибка загрузки цели обучения:', error);
      return;
    }

    if (data) {
      this.cache.studyGoal = {
        ...data,
        attraction: this.cache.attractions.get(data.attraction_id),
      };
      console.log('✅ Цель обучения:', data.attraction_id);
    } else {
      this.cache.studyGoal = null;
      console.log('ℹ️ Цель обучения не установлена');
    }
  }

  private async loadPriorities(): Promise<void> {
    const { data, error } = await supabase
      .from('employee_attraction_priorities')
      .select('*')
      .eq('employee_id', this.employeeId)
      .order('priority_level', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки приоритетов:', error);
      return;
    }

    // Обогащаем данными об аттракционах
    const enrichedData = (data || []).map(priority => {
      const attractions = priority.attraction_ids
        .map(id => this.cache.attractions.get(id))
        .filter(Boolean) as Attraction[];
      
      return {
        ...priority,
        attractions,
      };
    }) as EmployeeAttractionPriority[];

    this.cache.priorities = enrichedData;
    console.log('✅ Загружено уровней приоритетов:', data?.length || 0);
  }

  // ==================== REALTIME ПОДПИСКИ ====================
  
  private setupRealtimeSubscriptions(): void {
    // Подписка на изменения доступности
    const availabilitySub = supabase
      .channel('employee_availability_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_availability',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        () => {
          console.log('🔄 Обновление доступности');
          this.loadAvailability();
        }
      )
      .subscribe();

    // Подписка на изменения расписания
    const scheduleSub = supabase
      .channel('schedule_assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_assignments',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        () => {
          console.log('🔄 Обновление расписания');
          this.loadScheduleAssignments();
          this.loadActualWorkLogs();
        }
      )
      .subscribe();

    // Подписка на изменения фактических отметок
    const actualLogsSub = supabase
      .channel('actual_work_log_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'actual_work_log',
        },
        () => {
          console.log('🔄 Обновление фактических отметок');
          this.loadActualWorkLogs();
        }
      )
      .subscribe();

    // Подписка на изменения целей обучения
    const studyGoalSub = supabase
      .channel('study_goals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_study_goals',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        () => {
          console.log('🔄 Обновление цели обучения');
          this.loadStudyGoal();
        }
      )
      .subscribe();

    // Подписка на изменения приоритетов
    const prioritiesSub = supabase
      .channel('priorities_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_attraction_priorities',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        () => {
          console.log('🔄 Обновление приоритетов');
          this.loadPriorities();
        }
      )
      .subscribe();

    this.subscriptions.push(
      availabilitySub,
      scheduleSub,
      actualLogsSub,
      studyGoalSub,
      prioritiesSub
    );

    console.log('✅ Realtime подписки установлены');
  }

  // ==================== ГЕТТЕРЫ ====================
  
  getEmployee(): Employee | null {
    return this.cache.employee;
  }

  getAttractions(): Attraction[] {
    return Array.from(this.cache.attractions.values());
  }

  getAttraction(id: number): Attraction | undefined {
    return this.cache.attractions.get(id);
  }

  getAvailability(startDate?: string, endDate?: string): EmployeeAvailability[] {
    if (!startDate && !endDate) {
      return this.cache.availability;
    }

    return this.cache.availability.filter(av => {
      if (startDate && av.work_date < startDate) return false;
      if (endDate && av.work_date > endDate) return false;
      return true;
    });
  }

  getAvailabilityByDate(date: string): EmployeeAvailability | undefined {
    return this.cache.availability.find(av => av.work_date === date);
  }

  getScheduleAssignments(startDate?: string, endDate?: string): ScheduleAssignment[] {
    if (!startDate && !endDate) {
      return this.cache.scheduleAssignments;
    }

    return this.cache.scheduleAssignments.filter(schedule => {
      if (startDate && schedule.work_date < startDate) return false;
      if (endDate && schedule.work_date > endDate) return false;
      return true;
    });
  }

  getActualWorkLogs(): ActualWorkLog[] {
    return this.cache.actualWorkLogs;
  }

  getActualWorkLog(scheduleAssignmentId: number): ActualWorkLog | undefined {
    return this.cache.actualWorkLogs.find(
      log => log.schedule_assignment_id === scheduleAssignmentId
    );
  }

  getStudyGoal(): EmployeeStudyGoal | null {
    return this.cache.studyGoal;
  }

  getPriorities(): EmployeeAttractionPriority[] {
    return this.cache.priorities;
  }

  getPriorityLevel(level: number): EmployeeAttractionPriority | undefined {
    return this.cache.priorities.find(p => p.priority_level === level);
  }

  // Аттракционы, доступные для выбора (не в приоритетах)
  getAvailableAttractions(): Attraction[] {
    const priorityAttractionIds = new Set(
      this.cache.priorities.flatMap(p => p.attraction_ids)
    );

    return Array.from(this.cache.attractions.values()).filter(
      attraction => !priorityAttractionIds.has(attraction.id)
    );
  }

  // ==================== ОПЕРАЦИИ ЗАПИСИ ====================

  async addAvailability(data: {
    work_date: string;
    is_full_day: boolean;
    start_time?: string;
    end_time?: string;
    comment?: string;
  }): Promise<{ success: boolean; error?: string; data?: EmployeeAvailability }> {
    // Валидация: проверка на существующую смену
    const existing = this.getAvailabilityByDate(data.work_date);
    if (existing) {
      return { success: false, error: 'На эту дату уже установлена смена' };
    }

    // Валидация времени
    if (!data.is_full_day) {
      if (!data.start_time || !data.end_time) {
        return { success: false, error: 'Укажите время начала и окончания' };
      }
      if (data.start_time >= data.end_time) {
        return { success: false, error: 'Время окончания должно быть позже начала' };
      }
    }

    // Валидация комментария
    if (data.comment && data.comment.length > 4096) {
      return { success: false, error: 'Комментарий не более 4096 символов' };
    }

    const insertData = {
      employee_id: this.employeeId,
      work_date: data.work_date,
      is_full_day: data.is_full_day,
      start_time: data.is_full_day ? null : data.start_time,
      end_time: data.is_full_day ? null : data.end_time,
      comment: data.comment?.trim() || null,
    };

    const { data: inserted, error } = await supabase
      .from('employee_availability')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Ошибка добавления смены:', error);
      return { success: false, error: error.message };
    }

    // Логирование
    await logActivity(
      'employee',
      this.employeeId,
      'shift_add',
      `Добавлена смена на ${data.work_date}`
    );

    // Обновление кэша произойдет через Realtime
    console.log('✅ Смена добавлена:', inserted.id);
    return { success: true, data: inserted };
  }

  async deleteAvailability(availabilityId: number): Promise<{ success: boolean; error?: string }> {
    const availability = this.cache.availability.find(av => av.id === availabilityId);
    if (!availability) {
      return { success: false, error: 'Смена не найдена' };
    }

    // Валидация: можно ли удалить
    const validation = this.canDeleteAvailability(availability);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    const { error } = await supabase
      .from('employee_availability')
      .delete()
      .eq('id', availabilityId);

    if (error) {
      console.error('❌ Ошибка удаления смены:', error);
      return { success: false, error: error.message };
    }

    // Логирование
    await logActivity(
      'employee',
      this.employeeId,
      'shift_delete',
      `Удалена смена на ${availability.work_date}`
    );

    console.log('✅ Смена удалена:', availabilityId);
    return { success: true };
  }

  async addActualWorkLog(data: {
    schedule_assignment_id: number;
    actual_start: string;
    actual_end: string;
  }): Promise<{ success: boolean; error?: string; data?: ActualWorkLog }> {
    // Проверка существования расписания
    const schedule = this.cache.scheduleAssignments.find(
      s => s.id === data.schedule_assignment_id
    );
    if (!schedule) {
      return { success: false, error: 'Смена в расписании не найдена' };
    }

    // Проверка: уже отмечена?
    const existing = this.getActualWorkLog(data.schedule_assignment_id);
    if (existing) {
      return { success: false, error: 'Время уже отмечено для этой смены' };
    }

    // Валидация времени
    if (data.actual_start >= data.actual_end) {
      return { success: false, error: 'Время окончания должно быть позже начала' };
    }

    // Валидация: можно ли отметить (после 22:00 в день смены или позже)
    const validation = this.canLogActualTime(schedule);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    const insertData = {
      schedule_assignment_id: data.schedule_assignment_id,
      actual_start: data.actual_start,
      actual_end: data.actual_end,
    };

    const { data: inserted, error } = await supabase
      .from('actual_work_log')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Ошибка добавления фактического времени:', error);
      return { success: false, error: error.message };
    }

    // Логирование
    await logActivity(
      'employee',
      this.employeeId,
      'actual_time_log',
      `Отмечено фактическое время для смены ${schedule.work_date}`
    );

    console.log('✅ Фактическое время добавлено:', inserted.id);
    return { success: true, data: inserted };
  }

  async setStudyGoal(attractionId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.cache.attractions.has(attractionId)) {
      return { success: false, error: 'Аттракцион не найден' };
    }

    const { data, error } = await supabase
      .from('employee_study_goals')
      .upsert(
        {
          employee_id: this.employeeId,
          attraction_id: attractionId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Ошибка установки цели обучения:', error);
      return { success: false, error: error.message };
    }

    // Логирование
    const attractionName = this.cache.attractions.get(attractionId)?.name || 'Неизвестный';
    await logActivity(
      'employee',
      this.employeeId,
      'study_goal_set',
      `Установлена цель обучения: ${attractionName}`
    );

    console.log('✅ Цель обучения установлена:', attractionId);
    return { success: true };
  }

  async deleteStudyGoal(): Promise<{ success: boolean; error?: string }> {
    if (!this.cache.studyGoal) {
      return { success: false, error: 'Цель обучения не установлена' };
    }

    const { error } = await supabase
      .from('employee_study_goals')
      .delete()
      .eq('employee_id', this.employeeId);

    if (error) {
      console.error('❌ Ошибка удаления цели обучения:', error);
      return { success: false, error: error.message };
    }

    // Логирование
    await logActivity(
      'employee',
      this.employeeId,
      'study_goal_delete',
      'Удалена цель обучения'
    );

    console.log('✅ Цель обучения удалена');
    return { success: true };
  }

  // ==================== ВАЛИДАЦИЯ ====================

  canDeleteAvailability(availability: EmployeeAvailability): { allowed: boolean; reason?: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const shiftDate = new Date(availability.work_date);
    const shiftDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());

    // Нельзя удалить прошедшую или сегодняшнюю смену
    if (shiftDay <= today) {
      return { allowed: false, reason: 'Нельзя удалить прошедшую или текущую смену' };
    }

    // До начала смены должно быть >= 22 часов
    const startTimeStr = availability.is_full_day ? '00:00:00' : (availability.start_time || '00:00:00');
    const shiftStart = new Date(`${availability.work_date}T${startTimeStr}`);
    const diffHours = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 22) {
      return { allowed: false, reason: 'До начала смены менее 22 часов — удаление невозможно' };
    }

    return { allowed: true };
  }

  canLogActualTime(schedule: ScheduleAssignment): { allowed: boolean; reason?: string } {
    const now = new Date();
    const workDate = new Date(schedule.work_date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const workDay = new Date(workDate.getFullYear(), workDate.getMonth(), workDate.getDate());

    // Можно отметить только если дата < сегодня ИЛИ (дата = сегодня И время >= 22:00)
    if (workDay < today) {
      return { allowed: true };
    }

    if (workDay.getTime() === today.getTime() && now.getHours() >= 22) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Отметить фактическое время можно только после 22:00 в день смены или на следующий день',
    };
  }

  // Активна ли дата для добавления смены
  isDateActive(dateStr: string): boolean {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Нельзя добавить смену на прошедшую дату
    if (dateStr < todayStr) return false;
    
    // Если сегодня и время >= 9:00, нельзя добавить
    if (dateStr === todayStr && now.getHours() >= 9) return false;
    
    return true;
  }

  // ==================== РАСЧЁТ ЗАРПЛАТЫ ====================

  async calculateSalary(period: 'first' | 'second'): Promise<{
    days: Array<{
      date: string;
      attractions: Array<{
        name: string;
        hours: number;
        rate: number;
        coefficient: number;
        earn: number;
      }>;
      total: number;
    }>;
    total: number;
  }> {
    const now = new Date();
    let startDate: Date, endDate: Date;

    if (period === 'first') {
      // 7-21 число текущего месяца
      startDate = new Date(now.getFullYear(), now.getMonth(), 7);
      endDate = new Date(now.getFullYear(), now.getMonth(), 21);
    } else {
      // 22 число текущего месяца - 6 число следующего
      startDate = new Date(now.getFullYear(), now.getMonth(), 22);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 6);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Получаем смены за период
    const schedules = this.getScheduleAssignments(startStr, endStr);

    if (schedules.length === 0) {
      return { days: [], total: 0 };
    }

    const baseRate = this.cache.employee?.base_hourly_rate || 250;
    const daysMap = new Map<string, any>();

    for (const schedule of schedules) {
      const log = this.getActualWorkLog(schedule.id);
      if (!log) continue; // Пропускаем неотмеченные смены

      const workDate = schedule.work_date;
      let actualStart = log.actual_start;
      let actualEnd = log.actual_end;

      // Оплата начинается с 11:00, если пришёл раньше
      const [startHour, startMin] = actualStart.split(':').map(Number);
      let payStartHour = startHour;
      let payStartMin = startMin;

      if (payStartHour < 11 || (payStartHour === 11 && payStartMin === 0)) {
        payStartHour = 11;
        payStartMin = 0;
      }

      const payStart = new Date(`${workDate}T${String(payStartHour).padStart(2, '0')}:${String(payStartMin).padStart(2, '0')}:00`);
      const payEnd = new Date(`${workDate}T${actualEnd}`);

      if (payStart >= payEnd) continue; // Некорректное время

      const minutesWorked = (payEnd.getTime() - payStart.getTime()) / (1000 * 60);
      const hoursWorked = minutesWorked / 60;

      const attraction = this.cache.attractions.get(schedule.attraction_id);
      const coefficient = attraction?.coefficient || 1.0;
      const earn = hoursWorked * baseRate * coefficient;

      if (!daysMap.has(workDate)) {
        daysMap.set(workDate, { date: workDate, attractions: [], total: 0 });
      }

      const day = daysMap.get(workDate);
      day.attractions.push({
        name: attraction?.name || 'Аттракцион',
        hours: hoursWorked,
        rate: baseRate,
        coefficient,
        earn,
      });
      day.total += earn;
    }

    const daysArray = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const totalSalary = daysArray.reduce((sum, day) => sum + day.total, 0);

    return { days: daysArray, total: totalSalary };
  }

  // ==================== ОЧИСТКА ====================
  
  destroy(): void {
    // Отписываемся от Realtime
    this.subscriptions.forEach(sub => {
      supabase.removeChannel(sub);
    });
    this.subscriptions = [];
    console.log('🧹 Подписки очищены');
  }
}

// ==================== ЭКСПОРТ ====================

let currentManager: EmployeeDataManager | null = null;

export async function initializeEmployeeData(employeeId: number): Promise<EmployeeDataManager> {
  // Если уже есть менеджер для другого сотрудника, очищаем
  if (currentManager) {
    currentManager.destroy();
  }

  currentManager = new EmployeeDataManager(employeeId);
  await currentManager.initialize();
  return currentManager;
}

export function getEmployeeDataManager(): EmployeeDataManager | null {
  return currentManager;
}

export function destroyEmployeeData(): void {
  if (currentManager) {
    currentManager.destroy();
    currentManager = null;
  }
}
