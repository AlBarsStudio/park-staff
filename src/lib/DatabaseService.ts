import { format } from 'date-fns';

// ============================================================
// ТИПЫ ДАННЫХ (согласно новой структуре YDB)
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
  access_level: number; // 1 - Super, 2 - Admin, 3 - Staff
  created_at: string;
  last_login?: string | null;
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
  // Данные из JOIN (заполняются на фронте или бэке)
  employees?: { id: number; full_name: string } | null;
  attractions?: { id: number; name: string } | null;
}

// ... другие интерфейсы (Availability, ActivityLog) остаются похожими

export class DatabaseService {
  private apiUrl = 'https://functions.yandexcloud.net/d4eg35h41j02l527l7jg';
  
  private data = {
    employees: [] as Employee[],
    attractions: [] as Attraction[],
    scheduleAssignments: [] as ScheduleAssignment[],
    currentEmployee: null as Employee | null,
  };

  private isInitialized = false;

  // Вспомогательный метод для запросов к Яндекс Функции
  private async fetchApi(action: string, payload: any = {}) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          ...payload
        }),
      });

      if (!response.ok) {
        if (response.status === 401) return null;
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[DB] Error performing action ${action}:`, error);
      return null;
    }
  }

  // ============================================================
  // АВТОРИЗАЦИЯ
  // ============================================================

  async login(login: string, password_hash: string): Promise<Employee | null> {
    console.log('[DB] Попытка входа для:', login);
    
    const userData = await this.fetchApi('login', { login, password: password_hash });

    if (userData) {
      // YDB возвращает ключи в разном регистре в зависимости от настроек, 
      // приводим к нашему интерфейсу если нужно
      this.data.currentEmployee = userData;
      localStorage.setItem('park_staff_user', JSON.stringify(userData));
      
      // После успешного входа загружаем все данные
      await this.refresh();
      this.isInitialized = true;
      return userData;
    }

    return null;
  }

  // ============================================================
  // ЗАГРУЗКА ДАННЫХ
  // ============================================================

  async refresh(): Promise<boolean> {
    console.log('[DB] Загрузка данных из YDB...');
    
    // Запрашиваем все данные одним махом (нужно будет добавить этот action в Python функцию)
    const allData = await this.fetchApi('get_all_data');

    if (allData) {
      this.data.employees = allData.employees || [];
      this.data.attractions = allData.attractions || [];
      this.data.scheduleAssignments = allData.scheduleAssignments || [];
      // Обогащаем расписание именами
      this.enrichData();
      return true;
    }
    return false;
  }

  private enrichData() {
    this.data.scheduleAssignments = this.data.scheduleAssignments.map(item => ({
      ...item,
      employees: this.data.employees.find(e => e.id === item.employee_id) || null,
      attractions: this.data.attractions.find(a => a.id === item.attraction_id) || null,
    }));
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
  // CRUD ОПЕРАЦИИ (Примеры)
  // ============================================================

  async updateEmployee(id: number, data: any) {
    return await this.fetchApi('update_employee', { id, data });
  }

  async createSchedule(data: any) {
    // Важно: в YDB нужно генерировать ID самостоятельно
    const newId = Date.now(); 
    return await this.fetchApi('create_schedule', { id: newId, ...data });
  }
}

export const dbService = new DatabaseService();
