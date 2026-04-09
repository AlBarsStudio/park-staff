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
  auth_uid: string; // ✅ UUID из Supabase Auth (обязательно!)
  access_level: 1 | 2 | 3; // 1 = суперадмин, 2 = админ, 3 = сотрудник
  created_at: string; // ✅ ISO timestamp создания записи
  age?: number | null;
  email?: string;
  phone_number?: string | null;
  telegram?: string | null;
  vk?: string | null;
  max?: string | null;
  base_hourly_rate?: number | null;
  last_login?: string | null;
}

/**
 * Сотрудник (полная модель из таблицы `employees`).
 * Все поля, кроме id, опциональны, так как могут отсутствовать в БД.
 */
export interface Employee {
  id: number;
  created_at?: string;
  full_name?: string;
  age?: number | null;
  password_hash?: string;
  /** Ссылка или юзернейм Telegram (например, @username или полная URL) */
  telegram?: string | null;
  /** Ссылка или ID профиля VK */
  vk?: string | null;
  /** Ссылка на соцсеть Max (например, https://max.ru/...) */
  max?: string | null;
  access_level?: number;
  auth_uid?: string | null; // UUID из Supabase Auth
  phone_number?: string | null;
  base_hourly_rate?: number | null; // Базовая почасовая ставка (руб/час)
  last_login?: string | null; // ISO timestamp последнего входа
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
  comment?: string | null; // ✅ Комментарий к смене
  created_at?: string;
  updated_at?: string | null;
}

/**
 * Смена с присоединёнными данными сотрудника (имя).
 */
export interface ShiftWithEmployee extends Shift {
  employees: {
    id: number;
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
  end_time: string | null;
  created_at?: string;
  updated_at?: string;
  version_type?: 'original' | 'edited'; // Тип версии для истории изменений
  edited_at?: string | null;
  original_id?: number | null; // Ссылка на исходное назначение при редактировании

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
  min_staff_weekday?: number | null; // Минимум персонала в будни
  min_staff_weekend?: number | null; // Минимум персонала в выходные
  coefficient?: number; // Коэффициент сложности/оплаты (1.0 = 100%)
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

/**
 * Приоритеты аттракционов для сотрудника (таблица `employee_attraction_priorities`).
 */
export interface EmployeeAttractionPriority {
  id: number;
  employee_id: number;
  priority_level: 1 | 2 | 3; // 1 - высший, 2 - средний, 3 - низкий
  attraction_ids: number[]; // ✅ Массив ID аттракционов
  created_at?: string;
  updated_at?: string | null;
}

/**
 * Цель обучения сотрудника (таблица `employee_study_goals`).
 */
export interface EmployeeStudyGoal {
  id: number;
  employee_id: number;
  attraction_id: number;
  created_at?: string;
  updated_at?: string | null;
}

// =============================================================================
// Фактическая отработка
// =============================================================================

/**
 * Фактически отработанное время (таблица `actual_work_log`).
 */
export interface ActualWorkLog {
  id: number;
  schedule_assignment_id: number;
  actual_start: string; // Формат времени HH:MM:SS
  actual_end: string; // Формат времени HH:MM:SS
  created_at?: string;
}

// =============================================================================
// Логирование
// =============================================================================

/**
 * Запись журнала действий (таблица `activity_log`).
 */
export interface Log {
  id: number;
  user_type?: string; // 'admin' или 'employee' (опционально)
  user_id?: number; // Устаревшее поле
  admin_id?: number | null; // ✅ ID администратора
  employee_id?: number | null; // ✅ ID сотрудника
  action_type: string;
  description: string;
  created_at: string;
}

/**
 * Запись в журнал активности (расширенная).
 */
export interface ActivityLog {
  id: number;
  action_type: string;
  description: string;
  admin_id?: number | null;
  employee_id?: number | null;
  created_at: string;
}

// =============================================================================
// Администраторы
// =============================================================================

/**
 * Администратор (таблица `admins`).
 */
export interface Admin {
  id: number;
  full_name: string | null;
  auth_uid: string | null;
  access_level: number | null; // 1 = супер-админ, 2 = обычный админ
  password_hash?: string | null;
  created_at: string;
}

// =============================================================================
// Профили (для связи с auth.users)
// =============================================================================

/**
 * Профиль пользователя (таблица `profiles`).
 * Связующая таблица между auth.users и employees/admins.
 */
export interface Profile {
  id: string; // UUID (совпадает с auth.users.id)
  user_id?: number | null; // Может ссылаться на employees.id или admins.id
  created_at?: string;
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

// =============================================================================
// Вспомогательные типы
// =============================================================================

/**
 * Тип доступности сотрудника (используется в UI).
 */
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

  // Joined данные
  employees?: {
    id: number;
    full_name: string;
  } | null;
}

/**
 * Расширенные данные сотрудника с доступностью и приоритетами.
 * Используется в UI для отображения полной информации.
 */
export interface EnrichedEmployee extends Employee {
  availability?: {
    isFullDay: boolean;
    startTime: string | null;
    endTime: string | null;
    comment: string | null;
  };
  studyGoal?: string | null;
  priorities?: EmployeeAttractionPriority[];
}
