import { format } from 'date-fns';

// ============================================================
// ТИПЫ ДАННЫХ (соответствуют твоей структуре в YDB)
// ============================================================

export interface Employee {
  id: number;
  login: string;
  full_name: string;
  age: number | null;
  phone_number: string | null;
  telegram: string | null;
  vk: string | null;
  max: string | null;
  access_level: number; // 1 - SuperAdmin, 2 - Admin, 3 - Staff
  created_at: string;
}

export interface Attraction {
  id: number;
  name: string;
  min_staff_weekday: number | null;
  min_staff_weekend: number | null;
}

export interface ScheduleAssignment {
  id: number;
  work_date: string;
  employee_id: number;
  attraction_id: number;
  start_time: string;
  end_time: string | null;
  version_type: 'original' | 'edited';
  created_at: string;
  // Обогащенные данные для UI
  employees?: { id: number; full_name: string } | null;
  attractions?: { id: number; name: string } | null;
}

export class DatabaseService {
  private apiUrl = 'https://functions.yandexcloud.net/d4eg35h41j02l527l7jg';
  
  private data = {
    employees: [] as Employee[],
    attractions: [] as Attraction[],
    scheduleAssignments: [] as ScheduleAssignment[],
    currentEmployee: null as Employee | null,
  };

  private isInitialized = false;

  constructor() {
    // При создании сервиса пытаемся восстановить пользователя из памяти
    const saved = localStorage.getItem('park_staff_user');
    if (saved) {
      try {
        this.data.currentEmployee = JSON.parse(saved);
      } catch (e) {
        localStorage.removeItem('park_staff_user');
      }
    }
  }

  // Универсальный метод запроса к Яндекс Функции
  private async fetchApi(action: string, payload: any = {}) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error(`Ошибка API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[DatabaseService] Ошибка действия ${action}:`, error);
      return null;
    }
  }

  // ============================================================
  // АВТОРИЗАЦИЯ
  // ============================================================

  async login(login: string, password_hash: string): Promise<Employee | null> {
    console.log('[DB] Вход в систему...');
    const userData = await this.fetchApi('login', { login, password: password_hash });

    if (userData) {
      // Важно: приводим ID и уровень доступа к числу (YDB может вернуть строки)
      const user: Employee = {
        ...userData,
        id: Number(userData.id),
        access_level: Number(userData.access_level)
      };

      this.data.currentEmployee = user;
      localStorage.setItem('park_staff_user', JSON.stringify(user));
      
      // Сразу загружаем все данные таблиц
      await this.refresh();
      this.isInitialized = true;
      return user;
    }
    return null;
  }

  // ============================================================
  // ЗАГРУЗКА И ОБРАБОТКА ДАННЫХ
  // ============================================================

  async refresh(): Promise<boolean> {
    console.log('[DB] Загрузка таблиц из YDB...');
    const allData = await this.fetchApi('get_all_data');

    if (allData) {
      // 1. Обработка сотрудников
      this.data.employees = (allData.employees || []).map((e: any) => ({
        ...e,
        id: Number(e.id),
        access_level: Number(e.access_level)
      }));

      // 2. Обработка аттракционов
      this.data.attractions = (allData.attractions || []).map((a: any) => ({
        ...a,
        id: Number(a.id),
        min_staff_weekday: a.min_staff_weekday ? Number(a.min_staff_weekday) : null,
        min_staff_weekend: a.min_staff_weekend ? Number(a.min_staff_weekend) : null,
      }));

      // 3. Обработка расписания
      this.data.scheduleAssignments = (allData.scheduleAssignments || []).map((s: any) => ({
        ...s,
        id: Number(s.id),
        employee_id: Number(s.employee_id),
        attraction_id: Number(s.attraction_id)
      }));

      // Связываем таблицы между собой
      this.enrichData();
      
      this.isInitialized = true;
      console.log('[DB] Данные успешно синхронизированы');
      return true;
    }
    return false;
  }

  private enrichData() {
    this.data.scheduleAssignments = this.data.scheduleAssignments.map(item => {
      const emp = this.data.employees.find(e => e.id === item.employee_id);
      const attr = this.data.attractions.find(a => a.id === item.attraction_id);
      
      return {
        ...item,
        employees: emp ? { id: emp.id, full_name: emp.full_name } : null,
        attractions: attr ? { id: attr.id, name: attr.name } : null,
      };
    });
  }

  // ============================================================
  // ГЕТТЕРЫ
  // ============================================================

  getEmployees() { return this.data.employees; }
  getAttractions() { return this.data.attractions; }
  getScheduleAssignments() { return this.data.scheduleAssignments; }
  getCurrentUser() { return this.data.currentEmployee; }
  isReady() { return this.isInitialized; }

  getScheduleByDate(date: Date): ScheduleAssignment[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    return this.data.scheduleAssignments.filter(s => s.work_date === dateStr);
  }

  // ============================================================
  // ОПЕРАЦИИ (Заготовки)
  // ============================================================

  async updateEmployee(id: number, updateData: any) {
    return await this.fetchApi('update_employee', { id, data: updateData });
  }

  async createSchedule(assignment: any) {
    // Для YDB генерируем уникальный числовой ID
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    return await this.fetchApi('create_schedule', { ...assignment, id: newId });
  }

  async deleteScheduleAssignment(id: number) {
    return await this.fetchApi('delete_schedule', { id });
  }
}

// Экспортируем синглтон для всего приложения
export const dbService = new DatabaseService();
