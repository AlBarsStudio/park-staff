/**
 * @fileoverview Централизованные типы данных для всего приложения.
 * Соответствуют структуре таблиц базы данных Supabase.
 */

// =============================================================================
// Пользователи и сотрудники
// =============================================================================

/**
 * Профиль текущего авторизованного пользователя.
 * Используется в контексте аутентификации и для проверки прав.
 */
export interface UserProfile {
  id: number;
  full_name: string;
  age?: number;
  access_level: 1 | 2 | 3; // 1 = суперадмин, 2 = админ, 3 = сотрудник
  email?: string;
}

/**
 * Сотрудник (полная модель из таблицы `employees`).
 * Все поля, кроме id, опциональны, так как могут отсутствовать в БД.
 */
export interface Employee {
  id: number;
  created_at?: string;
  full_name?: string;
  age?: number;
  password_hash?: string;
  /** Ссылка или юзернейм Telegram (например, @username или полная URL) */
  telegram?: string;
  /** Ссылка или ID профиля VK */
  vk?: string;
  /** Ссылка на соцсеть Max (например, https://max.ru/...) */
  max?: string;
  access_level?: number;
  auth_uid?: string;          // UUID из Supabase Auth
  phone_number?: string;
  base_hourly_rate?: number;  // Базовая почасовая ставка (руб/час)
  last_login?: string;        // ISO timestamp последнего входа
}

// =============================================================================
// Смены (старая система доступности)
// =============================================================================

/**
 * Запись о доступности сотрудника (таблица `employee_availability`).
 */
export interface Shift {
  id: number;
  employee_id: number;
  work_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Смена с присоединёнными данными сотрудника (имя).
 */
export interface ShiftWithEmployee extends Shift {
  employees: {
    full_name: string;
  } | null;
}

// =============================================================================
// График работы (schedule_assignments)
// =============================================================================

/**
 * Назначение сотрудника на аттракцион в конкретную дату.
 * Таблица `schedule_assignments`.
 */
export interface ScheduleAssignment {
  id: number;
  work_date: string;
  employee_id: number;
  attraction_id: number;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string;
  version_type?: 'original' | 'edited'; // Тип версии для истории изменений
  edited_at?: string;
  original_id?: number;       // Ссылка на исходное назначение при редактировании

  // Присоединённые данные (после JOIN)
  employees?: {
    id: number;
    full_name: string;
  } | null;
  attractions?: {
    id: number;
    name: string;
    coefficient?: number;
  } | null;
}

// =============================================================================
// Аттракционы и приоритеты
// =============================================================================

/**
 * Аттракцион (таблица `attractions`).
 */
export interface Attraction {
  id: number;
  name: string;
  min_staff_weekday?: number;  // Минимум персонала в будни
  min_staff_weekend?: number;  // Минимум персонала в выходные
  coefficient?: number;        // Коэффициент сложности/оплаты (1.0 = 100%)
  // Поля ниже могут использоваться в старом коде
  min_staff?: number;
  max_staff?: number;
}

/**
 * Приоритет сотрудника для конкретного аттракциона.
 */
export interface Priority {
  id: number;
  priority_level: number; // 1 - высший, 2 - средний, 3 - низкий
  attractions: {
    name: string;
  };
}

// =============================================================================
// Логирование
// =============================================================================

/**
 * Запись журнала действий (таблица `activity_log`).
 */
export interface Log {
  id: number;
  user_type: string;      // 'admin' или 'employee'
  user_id: number;
  action_type: string;
  description: string;
  created_at: string;
}

// =============================================================================
// Устаревшие / предлагаемые структуры
// =============================================================================

/**
 * Предлагаемая структура для таблицы `work_schedules`.
 * Пока не используется в коде, оставлена для справки.
 */
export interface WorkScheduleEntry {
  id?: number;
  schedule_date: string;
  attraction_id: number;
  employee_id: number;
  work_start: string | null;
  work_end: string | null;
  is_full_day: boolean;
  created_by?: number;
  created_at?: string;
  notes?: string;
}
