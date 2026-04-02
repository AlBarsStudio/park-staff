export interface UserProfile {
  id: number;
  full_name: string;
  age?: number;
  access_level: 1 | 2 | 3;
  email?: string;
}

export interface Shift {
  id: number;
  employee_id: number;
  work_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface ShiftWithEmployee extends Shift {
  employees: {
    full_name: string;
  };
}

export interface Employee {
  id: number;
  full_name: string;
  age: number;
}

export interface Priority {
  id: number;
  priority_level: number;
  attractions: {
    name: string;
  };
}

export interface Attraction {
  id: number;
  name: string;
  min_staff?: number;
  max_staff?: number;
}

export interface Log {
  id: number;
  user_type: string;
  user_id: number;
  action_type: string;
  description: string;
  created_at: string;
}

// Предложение по структуре таблицы work_schedules:
// id               SERIAL PRIMARY KEY
// schedule_date    DATE NOT NULL                 — дата рабочего дня
// attraction_id    INTEGER REFERENCES attractions(id)
// employee_id      INTEGER REFERENCES employees(id)
// work_start       TIME                          — начало работы (null = полный день)
// work_end         TIME                          — конец работы  (null = полный день)
// is_full_day      BOOLEAN DEFAULT TRUE
// created_by       INTEGER REFERENCES employees(id) — кто создал
// created_at       TIMESTAMP DEFAULT NOW()
// notes            TEXT                          — примечания
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
