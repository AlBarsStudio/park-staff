import { supabase } from './supabase';

// ======================== КОНСТАНТЫ ========================
const CACHE_VERSION = 1;
const ATTRACTIONS_CACHE_KEY = 'attractions_cache_v1';
const ATTRACTIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

// Временные диапазоны для загрузки данных
const DATA_RANGE = {
  AVAILABILITY_PAST_DAYS: 30,      // История доступности: 30 дней назад
  AVAILABILITY_FUTURE_DAYS: 90,    // Будущие смены: 3 месяца вперед
  SCHEDULE_PAST_MONTHS: 2,         // История расписания: 2 месяца назад
  SCHEDULE_FUTURE_MONTHS: 2,       // Будущее расписание: 2 месяца вперед
  ACTUAL_LOGS_MONTHS: 3,           // Фактические отметки: 3 месяца назад
};

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

export interface ActivityLog {
  id: number;
  action_type: string;
  description: string;
  created_at: string;
  employee_id: number | null;
  admin_id: number | null;
}

// ======================== УТИЛИТЫ ДЛЯ ЛОГИРОВАНИЯ ========================

/**
 * Получить текущую дату и время в формате ISO с учетом временной зоны
 */
function getCurrentDateTime(): string {
  return new Date().toISOString();
}

/**
 * Форматировать дату и время для читаемого отображения
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Логирование действий сотрудника в activity_log
 */
async function logEmployeeActivity(
  employeeId: number,
  actionType: string,
  description: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert([
        {
          employee_id: employeeId,
          admin_id: null,
          action_type: actionType,
          description: description,
          created_at: getCurrentDateTime(),
        },
      ]);

    if (error) {
      console.error('❌ Ошибка логирования:', error);
    } else {
      console.log(`📝 Залогировано: [${actionType}] ${description}`);
    }
  } catch (error) {
    console.error('❌ Критическая ошибка логирования:', error);
  }
}

// ======================== УТИЛИТЫ ДЛЯ ДАТ ========================
function getDateRange(pastDays: number, futureDays: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - pastDays);
  const end = new Date(now);
  end.setDate(end.getDate() + futureDays);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getMonthRange(pastMonths: number, futureMonths: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - pastMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + futureMonths + 1, 0);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// ======================== КЭШИРОВАНИЕ АТТРАКЦИОНОВ ========================
interface AttractionsCacheData {
  version: number;
  timestamp: number;
  data: Attraction[];
}

function getCachedAttractions(): Attraction[] | null {
  try {
    const cached = localStorage.getItem(ATTRACTIONS_CACHE_KEY);
    if (!cached) return null;

    const parsed: AttractionsCacheData = JSON.parse(cached);
    
    // Проверка версии и TTL
    if (parsed.version !== CACHE_VERSION) return null;
    if (Date.now() - parsed.timestamp > ATTRACTIONS_CACHE_TTL) return null;

    return parsed.data;
  } catch (error) {
    console.error('❌ Ошибка чтения кэша аттракционов:', error);
    return null;
  }
}

function setCachedAttractions(data: Attraction[]): void {
  try {
    const cacheData: AttractionsCacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(ATTRACTIONS_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('❌ Ошибка сохранения кэша аттракционов:', error);
  }
}

// ======================== КЛАСС ДЛЯ УПРАВЛЕНИЯ ДАННЫМИ ========================
class EmployeeDataManager {
  private employeeId: number;
  private employeeName: string = '';
  
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

  // Подписка Realtime (один канал для всех таблиц)
  private realtimeChannel: any = null;

  constructor(employeeId: number) {
    this.employeeId = employeeId;
  }

  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  async initialize(): Promise<void> {
    const startTime = Date.now();
    console.log('🔄 Инициализация данных сотрудника:', this.employeeId);
    
    try {
      // Параллельная загрузка критичных данных
      await Promise.all([
        this.loadEmployee(),
        this.loadAttractions(),
      ]);

      // Загрузка данных, зависящих от временных диапазонов
      await Promise.all([
        this.loadAvailability(),
        this.loadScheduleAssignments(),
        this.loadStudyGoal(),
        this.loadPriorities(),
      ]);

      // Загрузка фактических отметок (зависит от расписания)
      await this.loadActualWorkLogs();

      this.setupRealtimeSubscription();
      this.cache.lastUpdate = Date.now();
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ Данные сотрудника загружены за ${loadTime}ms`);

      // Логируем вход в систему
      await logEmployeeActivity(
        this.employeeId,
        'system_login',
        `Сотрудник ${this.employeeName} вошел в систему`
      );
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error);
      throw error;
    }
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
    this.employeeName = data.full_name || `Сотрудник #${this.employeeId}`;
    console.log('✅ Сотрудник загружен:', this.employeeName);
  }

  private async loadAttractions(): Promise<void> {
    // Пытаемся загрузить из кэша
    const cached = getCachedAttractions();
    if (cached) {
      this.cache.attractions.clear();
      cached.forEach(attraction => {
        this.cache.attractions.set(attraction.id, attraction);
      });
      console.log('✅ Аттракционы загружены из кэша:', cached.length);
      return;
    }

    // Загружаем из БД
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

    // Сохраняем в кэш
    if (data) {
      setCachedAttractions(data);
    }

    console.log('✅ Загружено аттракционов из БД:', data?.length || 0);
  }

  private async loadAvailability(): Promise<void> {
    const range = getDateRange(
      DATA_RANGE.AVAILABILITY_PAST_DAYS,
      DATA_RANGE.AVAILABILITY_FUTURE_DAYS
    );

    const { data, error } = await supabase
      .from('employee_availability')
      .select('*')
      .eq('employee_id', this.employeeId)
      .gte('work_date', range.start)
      .lte('work_date', range.end)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки доступности:', error);
      return;
    }

    this.cache.availability = data || [];
    console.log(`✅ Загружено смен доступности: ${data?.length || 0} (${range.start} - ${range.end})`);
  }

  private async loadScheduleAssignments(): Promise<void> {
    const range = getMonthRange(
      DATA_RANGE.SCHEDULE_PAST_MONTHS,
      DATA_RANGE.SCHEDULE_FUTURE_MONTHS
    );

    // ОПТИМИЗАЦИЯ: Используем JOIN для получения данных об аттракционах за один запрос
    const { data, error } = await supabase
      .from('schedule_assignments')
      .select(`
        *,
        attraction:attractions (
          id,
          name,
          min_staff_weekday,
          min_staff_weekend,
          coefficient
        )
      `)
      .eq('employee_id', this.employeeId)
      .gte('work_date', range.start)
      .lte('work_date', range.end)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки расписания:', error);
      return;
    }

    // Данные уже обогащены благодаря JOIN
    this.cache.scheduleAssignments = (data || []) as ScheduleAssignment[];
    console.log(`✅ Загружено смен по расписанию: ${data?.length || 0} (${range.start} - ${range.end})`);
  }

  private async loadActualWorkLogs(): Promise<void> {
    // Получаем ID смен только за последние N месяцев
    const rangeDate = new Date();
    rangeDate.setMonth(rangeDate.getMonth() - DATA_RANGE.ACTUAL_LOGS_MONTHS);
    const minDate = rangeDate.toISOString().split('T')[0];

    const recentScheduleIds = this.cache.scheduleAssignments
      .filter(s => s.work_date >= minDate)
      .map(s => s.id);
    
    if (recentScheduleIds.length === 0) {
      this.cache.actualWorkLogs = [];
      console.log('ℹ️ Нет смен для загрузки фактических отметок');
      return;
    }

    // ОПТИМИЗАЦИЯ: Батчинг запросов по 1000 ID (лимит Supabase для IN)
    const batchSize = 1000;
    const batches: number[][] = [];
    
    for (let i = 0; i < recentScheduleIds.length; i += batchSize) {
      batches.push(recentScheduleIds.slice(i, i + batchSize));
    }

    const allLogs: ActualWorkLog[] = [];

    for (const batch of batches) {
      const { data, error } = await supabase
        .from('actual_work_log')
        .select('*')
        .in('schedule_assignment_id', batch)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Ошибка загрузки фактических отметок:', error);
        continue;
      }

      if (data) {
        allLogs.push(...data);
      }
    }

    this.cache.actualWorkLogs = allLogs;
    console.log(`✅ Загружено фактических отметок: ${allLogs.length} (за последние ${DATA_RANGE.ACTUAL_LOGS_MONTHS} мес.)`);
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

    // Обогащаем данными об аттракционах из кэша
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

  // ==================== REALTIME ПОДПИСКА (ОПТИМИЗИРОВАННАЯ) ====================
  
  private setupRealtimeSubscription(): void {
    // ОПТИМИЗАЦИЯ: Один канал для всех таблиц вместо 5 отдельных
    this.realtimeChannel = supabase
      .channel(`employee_data_${this.employeeId}`)
      
      // Подписка на доступность
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_availability',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        (payload) => this.handleAvailabilityChange(payload)
      )
      
      // Подписка на расписание
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_assignments',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        (payload) => this.handleScheduleChange(payload)
      )
      
      // Подписка на фактические отметки (без фильтра, т.к. schedule_assignment_id динамический)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'actual_work_log',
        },
        (payload) => this.handleActualLogChange(payload)
      )
      
      // Подписка на цели обучения
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_study_goals',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        (payload) => this.handleStudyGoalChange(payload)
      )
      
      // Подписка на приоритеты
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_attraction_priorities',
          filter: `employee_id=eq.${this.employeeId}`,
        },
        (payload) => this.handlePriorityChange(payload)
      )
      
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime подписка установлена (unified channel)');
        }
      });
  }

  // ==================== ОБРАБОТЧИКИ REALTIME (ИНКРЕМЕНТАЛЬНОЕ ОБНОВЛЕНИЕ) ====================

  private handleAvailabilityChange(payload: any): void {
    console.log('🔄 Изменение доступности:', payload.eventType);

    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new) {
          this.cache.availability.push(payload.new);
          this.cache.availability.sort((a, b) => a.work_date.localeCompare(b.work_date));
        }
        break;

      case 'UPDATE':
        if (payload.new) {
          const index = this.cache.availability.findIndex(av => av.id === payload.new.id);
          if (index !== -1) {
            this.cache.availability[index] = payload.new;
          }
        }
        break;

      case 'DELETE':
        if (payload.old) {
          this.cache.availability = this.cache.availability.filter(av => av.id !== payload.old.id);
        }
        break;
    }

    this.cache.lastUpdate = Date.now();
  }

  private async handleScheduleChange(payload: any): Promise<void> {
    console.log('🔄 Изменение расписания:', payload.eventType);

    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new) {
          // Обогащаем данными об аттракционе
          const enriched = {
            ...payload.new,
            attraction: this.cache.attractions.get(payload.new.attraction_id),
          } as ScheduleAssignment;
          this.cache.scheduleAssignments.push(enriched);
          this.cache.scheduleAssignments.sort((a, b) => a.work_date.localeCompare(b.work_date));
        }
        break;

      case 'UPDATE':
        if (payload.new) {
          const index = this.cache.scheduleAssignments.findIndex(s => s.id === payload.new.id);
          if (index !== -1) {
            this.cache.scheduleAssignments[index] = {
              ...payload.new,
              attraction: this.cache.attractions.get(payload.new.attraction_id),
            } as ScheduleAssignment;
          }
        }
        break;

      case 'DELETE':
        if (payload.old) {
          this.cache.scheduleAssignments = this.cache.scheduleAssignments.filter(
            s => s.id !== payload.old.id
          );
          // Удаляем связанные фактические отметки
          this.cache.actualWorkLogs = this.cache.actualWorkLogs.filter(
            log => log.schedule_assignment_id !== payload.old.id
          );
        }
        break;
    }

    this.cache.lastUpdate = Date.now();
  }

  private handleActualLogChange(payload: any): void {
    console.log('🔄 Изменение фактических отметок:', payload.eventType);

    // Проверяем, относится ли это к нашим сменам
    const isOurSchedule = (scheduleId: number) => 
      this.cache.scheduleAssignments.some(s => s.id === scheduleId);

    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new && isOurSchedule(payload.new.schedule_assignment_id)) {
          this.cache.actualWorkLogs.push(payload.new);
          this.cache.actualWorkLogs.sort((a, b) => 
            b.created_at.localeCompare(a.created_at)
          );
        }
        break;

      case 'UPDATE':
        if (payload.new && isOurSchedule(payload.new.schedule_assignment_id)) {
          const index = this.cache.actualWorkLogs.findIndex(log => log.id === payload.new.id);
          if (index !== -1) {
            this.cache.actualWorkLogs[index] = payload.new;
          }
        }
        break;

      case 'DELETE':
        if (payload.old) {
          this.cache.actualWorkLogs = this.cache.actualWorkLogs.filter(
            log => log.id !== payload.old.id
          );
        }
        break;
    }

    this.cache.lastUpdate = Date.now();
  }

  private handleStudyGoalChange(payload: any): void {
    console.log('🔄 Изменение цели обучения:', payload.eventType);

    switch (payload.eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (payload.new) {
          this.cache.studyGoal = {
            ...payload.new,
            attraction: this.cache.attractions.get(payload.new.attraction_id),
          };
        }
        break;

      case 'DELETE':
        this.cache.studyGoal = null;
        break;
    }

    this.cache.lastUpdate = Date.now();
  }

  private handlePriorityChange(payload: any): void {
    console.log('🔄 Изменение приоритетов:', payload.eventType);

    switch (payload.eventType) {
      case 'INSERT':
        if (payload.new) {
          const enriched = {
            ...payload.new,
            attractions: payload.new.attraction_ids
              .map((id: number) => this.cache.attractions.get(id))
              .filter(Boolean) as Attraction[],
          } as EmployeeAttractionPriority;
          this.cache.priorities.push(enriched);
          this.cache.priorities.sort((a, b) => a.priority_level - b.priority_level);
        }
        break;

      case 'UPDATE':
        if (payload.new) {
          const index = this.cache.priorities.findIndex(p => p.id === payload.new.id);
          if (index !== -1) {
            this.cache.priorities[index] = {
              ...payload.new,
              attractions: payload.new.attraction_ids
                .map((id: number) => this.cache.attractions.get(id))
                .filter(Boolean) as Attraction[],
            } as EmployeeAttractionPriority;
          }
        }
        break;

      case 'DELETE':
        if (payload.old) {
          this.cache.priorities = this.cache.priorities.filter(p => p.id !== payload.old.id);
        }
        break;
    }

    this.cache.lastUpdate = Date.now();
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

  getAvailableAttractions(): Attraction[] {
    const priorityAttractionIds = new Set(
      this.cache.priorities.flatMap(p => p.attraction_ids)
    );

    return Array.from(this.cache.attractions.values()).filter(
      attraction => !priorityAttractionIds.has(attraction.id)
    );
  }

  // Получение времени последнего обновления
  getLastUpdate(): number {
    return this.cache.lastUpdate;
  }

  // Получение текущего времени
  getCurrentTime(): Date {
    return new Date();
  }

  // Форматирование времени для отображения
  formatTime(date: Date | string): string {
    if (typeof date === 'string') {
      return formatDateTime(date);
    }
    return formatDateTime(date.toISOString());
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
      
      // Логируем ошибку
      await logEmployeeActivity(
        this.employeeId,
        'availability_add_error',
        `Ошибка добавления смены на ${data.work_date}: ${error.message}`
      );
      
      return { success: false, error: error.message };
    }

    // Формируем описание для лога
    const timeInfo = data.is_full_day 
      ? 'весь день' 
      : `с ${data.start_time} до ${data.end_time}`;
    const commentInfo = data.comment ? ` (комментарий: ${data.comment})` : '';
    
    // Логирование успешного добавления
    await logEmployeeActivity(
      this.employeeId,
      'availability_add',
      `Добавлена желаемая смена на ${data.work_date}, ${timeInfo}${commentInfo}`
    );

    // Realtime автоматически обновит кэш
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
      // Логируем попытку удаления
      await logEmployeeActivity(
        this.employeeId,
        'availability_delete_denied',
        `Попытка удалить смену на ${availability.work_date} отклонена: ${validation.reason}`
      );
      
      return { success: false, error: validation.reason };
    }

    const { error } = await supabase
      .from('employee_availability')
      .delete()
      .eq('id', availabilityId);

    if (error) {
      console.error('❌ Ошибка удаления смены:', error);
      
      // Логируем ошибку
      await logEmployeeActivity(
        this.employeeId,
        'availability_delete_error',
        `Ошибка удаления смены на ${availability.work_date}: ${error.message}`
      );
      
      return { success: false, error: error.message };
    }

    // Формируем описание
    const timeInfo = availability.is_full_day 
      ? 'весь день' 
      : `с ${availability.start_time} до ${availability.end_time}`;
    
    // Логирование успешного удаления
    await logEmployeeActivity(
      this.employeeId,
      'availability_delete',
      `Удалена желаемая смена на ${availability.work_date}, ${timeInfo}`
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

    // Валидация: можно ли отметить
    const validation = this.canLogActualTime(schedule);
    if (!validation.allowed) {
      // Логируем попытку
      await logEmployeeActivity(
        this.employeeId,
        'actual_time_log_denied',
        `Попытка отметить время для смены ${schedule.work_date} отклонена: ${validation.reason}`
      );
      
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
      
      // Логируем ошибку
      await logEmployeeActivity(
        this.employeeId,
        'actual_time_log_error',
        `Ошибка отметки времени для смены ${schedule.work_date}: ${error.message}`
      );
      
      return { success: false, error: error.message };
    }

    // Получаем название аттракциона
    const attractionName = schedule.attraction?.name || 'Неизвестный аттракцион';
    
    // Логирование успешной отметки
    await logEmployeeActivity(
      this.employeeId,
      'actual_time_log',
      `Отмечено фактическое время для смены ${schedule.work_date} на "${attractionName}": ${data.actual_start} - ${data.actual_end}`
    );

    console.log('✅ Фактическое время добавлено:', inserted.id);
    return { success: true, data: inserted };
  }

  async setStudyGoal(attractionId: number): Promise<{ success: boolean; error?: string }> {
    const attraction = this.cache.attractions.get(attractionId);
    if (!attraction) {
      return { success: false, error: 'Аттракцион не найден' };
    }

    const { data, error } = await supabase
      .from('employee_study_goals')
      .upsert(
        {
          employee_id: this.employeeId,
          attraction_id: attractionId,
          updated_at: getCurrentDateTime(),
        },
        { onConflict: 'employee_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Ошибка установки цели обучения:', error);
      
      // Логируем ошибку
      await logEmployeeActivity(
        this.employeeId,
        'study_goal_set_error',
        `Ошибка установки цели обучения "${attraction.name}": ${error.message}`
      );
      
      return { success: false, error: error.message };
    }

    // Логирование успешной установки
    await logEmployeeActivity(
      this.employeeId,
      'study_goal_set',
      `Установлена цель обучения: "${attraction.name}"`
    );

    console.log('✅ Цель обучения установлена:', attractionId);
    return { success: true };
  }

  async deleteStudyGoal(): Promise<{ success: boolean; error?: string }> {
    if (!this.cache.studyGoal) {
      return { success: false, error: 'Цель обучения не установлена' };
    }

    const goalAttractionName = this.cache.studyGoal.attraction?.name || 'Неизвестный аттракцион';

    const { error } = await supabase
      .from('employee_study_goals')
      .delete()
      .eq('employee_id', this.employeeId);

    if (error) {
      console.error('❌ Ошибка удаления цели обучения:', error);
      
      // Логируем ошибку
      await logEmployeeActivity(
        this.employeeId,
        'study_goal_delete_error',
        `Ошибка удаления цели обучения "${goalAttractionName}": ${error.message}`
      );
      
      return { success: false, error: error.message };
    }

    // Логирование успешного удаления
    await logEmployeeActivity(
      this.employeeId,
      'study_goal_delete',
      `Удалена цель обучения: "${goalAttractionName}"`
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

    // Получаем смены за период из кэша
    const schedules = this.getScheduleAssignments(startStr, endStr);

    if (schedules.length === 0) {
      // Логируем просмотр зарплаты
      await logEmployeeActivity(
        this.employeeId,
        'salary_view',
        `Просмотр зарплаты за ${period === 'first' ? 'первую' : 'вторую'} половину месяца (${startStr} - ${endStr}): нет смен`
      );
      
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

    // Логируем просмотр зарплаты
    await logEmployeeActivity(
      this.employeeId,
      'salary_view',
      `Просмотр зарплаты за ${period === 'first' ? 'первую' : 'вторую'} половину месяца (${startStr} - ${endStr}): ${totalSalary.toFixed(2)} руб.`
    );

    return { days: daysArray, total: totalSalary };
  }

  // ==================== МЕТОДЫ ДЛЯ ЗАГРУЗКИ ИСТОРИЧЕСКИХ ДАННЫХ ====================

  /**
   * Загрузить историческую доступность за указанный период
   */
  async loadHistoricalAvailability(startDate: string, endDate: string): Promise<EmployeeAvailability[]> {
    console.log(`📚 Загрузка исторической доступности: ${startDate} - ${endDate}`);

    const { data, error } = await supabase
      .from('employee_availability')
      .select('*')
      .eq('employee_id', this.employeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки исторической доступности:', error);
      return [];
    }

    // Логируем загрузку истории
    await logEmployeeActivity(
      this.employeeId,
      'history_load',
      `Загружена историческая доступность за период ${startDate} - ${endDate}: ${data?.length || 0} записей`
    );

    console.log(`✅ Загружено исторических записей: ${data?.length || 0}`);
    return data || [];
  }

  /**
   * Загрузить историческое расписание за указанный период
   */
  async loadHistoricalSchedule(startDate: string, endDate: string): Promise<ScheduleAssignment[]> {
    console.log(`📚 Загрузка исторического расписания: ${startDate} - ${endDate}`);

    const { data, error } = await supabase
      .from('schedule_assignments')
      .select(`
        *,
        attraction:attractions (
          id,
          name,
          min_staff_weekday,
          min_staff_weekend,
          coefficient
        )
      `)
      .eq('employee_id', this.employeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки исторического расписания:', error);
      return [];
    }

    // Логируем загрузку истории
    await logEmployeeActivity(
      this.employeeId,
      'history_load',
      `Загружено историческое расписание за период ${startDate} - ${endDate}: ${data?.length || 0} смен`
    );

    console.log(`✅ Загружено исторических смен: ${data?.length || 0}`);
    return (data || []) as ScheduleAssignment[];
  }

  // ==================== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ====================

  /**
   * Принудительно обновить все данные (при перезагрузке страницы)
   */
  async refreshAllData(): Promise<void> {
    console.log('🔄 Принудительное обновление всех данных');
    
    // Очищаем кэш аттракционов для гарантии актуальности
    localStorage.removeItem(ATTRACTIONS_CACHE_KEY);
    
    await this.initialize();

    // Логируем обновление
    await logEmployeeActivity(
      this.employeeId,
      'data_refresh',
      'Выполнено принудительное обновление всех данных'
    );
  }

  // ==================== ОЧИСТКА ====================
  
  async destroy(): Promise<void> {
    // Логируем выход
    await logEmployeeActivity(
      this.employeeId,
      'system_logout',
      `Сотрудник ${this.employeeName} вышел из системы`
    );

    // Отписываемся от Realtime
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    console.log('🧹 Realtime подписка очищена');
  }
}

// ==================== ЭКСПОРТ ====================

let currentManager: EmployeeDataManager | null = null;

export async function initializeEmployeeData(employeeId: number): Promise<EmployeeDataManager> {
  // Если уже есть менеджер для другого сотрудника, очищаем
  if (currentManager) {
    await currentManager.destroy();
  }

  currentManager = new EmployeeDataManager(employeeId);
  await currentManager.initialize();
  return currentManager;
}

export function getEmployeeDataManager(): EmployeeDataManager | null {
  return currentManager;
}

export async function destroyEmployeeData(): Promise<void> {
  if (currentManager) {
    await currentManager.destroy();
    currentManager = null;
  }
}

/**
 * Принудительное обновление данных текущего сотрудника
 */
export async function refreshEmployeeData(): Promise<void> {
  if (currentManager) {
    await currentManager.refreshAllData();
  }
}

/**
 * Получить текущее время сервера (для синхронизации)
 */
export function getCurrentServerTime(): Date {
  return new Date();
}

/**
 * Форматировать время для отображения пользователю
 */
export function formatDisplayTime(date: Date | string): string {
  return formatDateTime(typeof date === 'string' ? date : date.toISOString());
}
