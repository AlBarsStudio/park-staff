// src/lib/DatabaseService.ts
import { format } from 'date-fns';

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
}

export interface Attraction {
  id: number;
  name: string;
  min_staff_weekday: number | null;
  min_staff_weekend: number | null;
}

// ... остальные интерфейсы (ScheduleAssignment и т.д.) оставить, убрав coefficient и auth_uid

export class DatabaseService {
  private data = {
    employees: [] as Employee[],
    attractions: [] as Attraction[],
    scheduleAssignments: [] as any[],
    currentEmployee: null as Employee | null,
  };

  private isInitialized = false;

  // Упрощенный вход
  async login(login: string, pass: string): Promise<Employee | null> {
    try {
      // Здесь будет запрос к твоему API, который проверит логин и пароль в YDB
      // Пока имитируем получение данных
      const response = await fetch('/api/login', { 
        method: 'POST', 
        body: JSON.stringify({ login, pass }) 
      });
      const user = await response.json();

      if (user) {
        this.data.currentEmployee = user;
        await this.refresh();
        this.isInitialized = true;
        return user;
      }
      return null;
    } catch (e) {
      console.error("Login error", e);
      return null;
    }
  }

  async refresh(): Promise<boolean> {
    // Здесь будут запросы к API для загрузки всех таблиц из YDB
    // Например: const employees = await api.query("SELECT * FROM employees");
    console.log('[DB] Данные обновлены из YDB');
    return true;
  }

  // Геттеры
  getEmployees() { return this.data.employees; }
  getAttractions() { return this.data.attractions; }
  getCurrentUser() { return this.data.currentEmployee; }
  
  isReady(): boolean { return this.isInitialized; }
}

export const dbService = new DatabaseService();
