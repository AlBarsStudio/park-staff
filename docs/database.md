# 🗃️ Документация по базе данных ParkStaff (только для разработчиков и поддержки)

## Назначение

Документ описывает структуру базы данных проекта **ParkStaff** (Supabase/PostgreSQL), связи между таблицами, ограничения целостности, основные сценарии работы и рекомендации по сопровождению.  
База данных является центральным хранилищем всех данных системы: сотрудники, администраторы, аттракционы, доступность, график, фактическое время работы, приоритеты, цели обучения и журнал действий.

---

## Содержание

- [Обзор](#обзор)
- [Схема данных (ER-логика)](#схема-данных-er-логика)
- [Аутентификация и профили](#аутентификация-и-профили)
- [Описание таблиц](#описание-таблиц)
  - [admins — администраторы](#admins--администраторы)
  - [employees — сотрудники](#employees--сотрудники)
  - [attractions — аттракционы](#attractions--аттракционы)
  - [employee_availability — заявки на смены](#employee_availability--заявки-на-смены)
  - [schedule_assignments — график работы](#schedule_assignments--график-работы)
  - [actual_work_log — фактическое время работы](#actual_work_log--фактическое-время-работы)
  - [employee_attraction_priorities — приоритеты сотрудников](#employee_attraction_priorities--приоритеты-сотрудников)
  - [employee_study_goals — цели обучения](#employee_study_goals--цели-обучения)
  - [activity_log — журнал действий](#activity_log--журнал-действий)
  - [profiles — связующая таблица](#profiles--связующая-таблица)
- [Связи и ограничения целостности](#связи-и-ограничения-целостности)
- [Типичные сценарии работы (примеры запросов)](#типичные-сценарии-работы-примеры-запросов)
- [Realtime-подписки (синхронизация интерфейса)](#realtime-подписки-синхронизация-интерфейса)
- [Рекомендации по сопровождению](#рекомендации-по-сопровождению)
- [Примечания](#примечания)

---

## Обзор

ParkStaff использует **Supabase** как backend-as-a-service поверх **PostgreSQL**.  
Основные принципы проектирования:

- **Централизация данных:** все бизнес-сущности хранятся в одной базе;
- **Чёткое разделение ролей:** сотрудники vs администраторы (через `access_level`);
- **Историчность и аудит:** версии графика, фактическое время, журнал действий;
- **Гибкая настройка операционной логики:** приоритеты, минимальный штат, коэффициенты оплаты;
- **Интеграция с UI и ботом:** чтение/запись через единые сервисы и типизированные модели.

---

## Схема данных (ER-логика)

Краткая логика связей:

- `employees` и `admins` связаны с `auth.users` через `auth_uid`;
- `employee_availability` хранит **доступность** сотрудника на даты;
- `schedule_assignments` хранит **назначения** (кто работает, где и когда);
- `actual_work_log` хранит **фактическое время** по конкретному назначению;
- `employee_attraction_priorities` хранит **уровни приоритетов** (допуск + предпочтение);
- `employee_study_goals` хранит **единственную цель обучения** сотрудника;
- `activity_log` хранит **журнал всех действий** (админских и связанных с сотрудником).

---

## Аутентификация и профили

### `auth.users` (встроенная таблица Supabase)

Используется для аутентификации. Каждому пользователю присваивается уникальный `uuid` (`id`).

### `profiles`

Связующая таблица между `auth.users` и бизнес-сущностями (`employees`, `admins`).

| Поле | Тип | Описание |
|---|---|---|
| `id` | uuid | Первичный ключ (совпадает с `auth.users.id`) |
| `user_id` | int | Ссылка на `employees.id` или `admins.id` (в зависимости от роли) |
| `created_at` | timestamp | Дата создания |

> Рекомендуется использовать `profiles` для централизованного сопоставления учётных записей с бизнес-объектами.

---

## Описание таблиц

### `admins` — администраторы

Хранит учётные записи администраторов.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `full_name` | text | Нет | ФИО |
| `auth_uid` | uuid | Да | Ссылка на `auth.users.id` |
| `access_level` | int | Да | `1` = супер-администратор, `2` = администратор |
| `created_at` | timestamp | Да | Дата создания |

**Индексы:** по `auth_uid` (уникальный).

---

### `employees` — сотрудники

Хранит профили сотрудников.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `full_name` | text | Да | ФИО |
| `age` | int | Нет | Возраст |
| `phone_number` | text | Нет | Телефон |
| `telegram` | text | Нет | Telegram |
| `vk` | text | Нет | VK |
| `max` | text | Нет | Max |
| `base_hourly_rate` | numeric | Нет | Базовая ставка (₽/час) |
| `auth_uid` | uuid | Да | Ссылка на `auth.users.id` |
| `access_level` | int | Да | `3` = сотрудник |
| `last_login` | timestamp | Нет | Последний вход |
| `created_at` | timestamp | Да | Дата создания |

**Индексы:** по `auth_uid` (уникальный), по `full_name`.

---

### `attractions` — аттракционы

Справочник аттракционов.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `name` | text | Да | Название аттракциона |
| `min_staff_weekday` | int | Нет | Мин. сотрудников в будни |
| `min_staff_weekend` | int | Нет | Мин. сотрудников в выходные |
| `coefficient` | numeric | Да | Коэффициент к ставке (например, 1.0, 1.2) |

**Индексы:** по `name` (уникальный).

---

### `employee_availability` — заявки на смены

Хранит информацию о том, когда сотрудник может выйти на работу.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `employee_id` | int | Да | Ссылка на `employees.id` |
| `work_date` | date | Да | Дата смены |
| `is_full_day` | boolean | Да | Полный/неполный день |
| `start_time` | time | Нет | Начало (для неполного дня) |
| `end_time` | time | Нет | Конец (для неполного дня) |
| `comment` | text | Нет | Комментарий (до 4096 символов) |
| `created_at` | timestamp | Да | Дата создания |
| `updated_at` | timestamp | Нет | Дата изменения |

**Ограничения на уровне приложения (рекомендуемые):**
- один сотрудник — одна запись на дату;
- `end_time > start_time`, если `is_full_day = false`;
- недоступно создание/изменение/удаление, если дата уже прошла или до начала смены менее 22 часов.

**Индексы:** по `employee_id`, по `work_date`.

---

### `schedule_assignments` — график работы

Хранит официальные назначения сотрудников на аттракционы.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `work_date` | date | Да | Дата смены |
| `employee_id` | int | Да | Ссылка на `employees.id` |
| `attraction_id` | int | Да | Ссылка на `attractions.id` |
| `start_time` | time | Да | Начало смены |
| `end_time` | time | Нет | Конец смены |
| `version_type` | text | Да | `original` или `edited` |
| `original_id` | int | Нет | Исходное назначение (при редактировании) |
| `edited_at` | timestamp | Нет | Время редактирования |
| `created_at` | timestamp | Да | Дата создания |
| `updated_at` | timestamp | Да | Дата изменения |

**Индексы:** по `work_date`, по `employee_id`, по `attraction_id`.

---

### `actual_work_log` — фактическое время работы

Хранит отметки о реальном времени работы сотрудника по конкретному назначению.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `schedule_assignment_id` | int | Да | Ссылка на `schedule_assignments.id` |
| `actual_start` | time | Да | Фактическое начало |
| `actual_end` | time | Да | Фактическое окончание |
| `created_at` | timestamp | Да | Дата создания |

**Ограничения:** одна запись на `schedule_assignment_id`.

---

### `employee_attraction_priorities` — приоритеты сотрудников

Хранит набор аттракционов для каждого уровня приоритета сотрудника.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `employee_id` | int | Да | Ссылка на `employees.id` |
| `priority_level` | int | Да | `1`, `2`, `3` |
| `attraction_ids` | int[] | Да | Массив ID аттракционов |
| `created_at` | timestamp | Да | Дата создания |
| `updated_at` | timestamp | Нет | Дата изменения |

**Бизнес-правило:** один сотрудник может иметь максимум 3 записи (по одной на уровень).  
Аттракцион не должен одновременно присутствовать в нескольких уровнях одного сотрудника.

**Индексы:** по `employee_id`, по `priority_level`.

---

### `employee_study_goals` — цели обучения

Хранит текущую цель обучения сотрудника (один аттракцион).

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `employee_id` | int | Да | Ссылка на `employees.id` (уникальный) |
| `attraction_id` | int | Да | Ссылка на `attractions.id` |
| `created_at` | timestamp | Да | Дата создания |
| `updated_at` | timestamp | Нет | Дата изменения |

**Ограничение:** один сотрудник — одна цель обучения.

---

### `activity_log` — журнал действий

Хранит аудит всех значимых действий в системе.

| Поле | Тип | Обязательность | Описание |
|---|---|---|---|
| `id` | int | Да | Первичный ключ |
| `action_type` | text | Да | Тип действия |
| `description` | text | Да | Описание |
| `admin_id` | int | Нет | ID администратора |
| `employee_id` | int | Нет | ID сотрудника |
| `created_at` | timestamp | Да | Время действия |

**Типы `action_type`:** `availability_create`, `availability_update`, `availability_delete`, `schedule_create`, `schedule_update`, `schedule_delete`, `schedule_bulk_create`, `schedule_delete_by_date`, `attraction_create`, `attraction_update`, `attraction_delete`, `employee_update`, `shift_add`, `shift_delete`, `actual_time_log`, `study_goal_set`, `study_goal_delete`.

---

## Связи и ограничения целостности

- **`employees.auth_uid` → `auth.users.id`** (один к одному, по значению)
- **`admins.auth_uid` → `auth.users.id`** (один к одному, по значению)
- **`employee_availability.employee_id` → `employees.id`** (многие к одному)
- **`schedule_assignments.employee_id` → `employees.id`** (многие к одному)
- **`schedule_assignments.attraction_id` → `attractions.id`** (многие к одному)
- **`actual_work_log.schedule_assignment_id` → `schedule_assignments.id`** (многие к одному)
- **`employee_attraction_priorities.employee_id` → `employees.id`** (многие к одному)
- **`employee_study_goals.employee_id` → `employees.id`** (один к одному)
- **`activity_log.admin_id` → `admins.id`** (многие к одному, опционально)
- **`activity_log.employee_id` → `employees.id`** (многие к одному, опционально)

Рекомендуется дополнительно обеспечить:

- уникальность пары `(employee_id, work_date)` в `employee_availability`;
- уникальность `schedule_assignment_id` в `actual_work_log`;
- уникальность `employee_id` в `employee_study_goals`;
- проверку, что `attraction_ids` содержат только существующие `id` из `attractions` (например, через триггер или проверку на уровне приложения).

---

## Типичные сценарии работы (примеры запросов)

### 1) Получить доступность сотрудника на месяц

```sql
SELECT *
FROM employee_availability
WHERE employee_id = 42
  AND work_date BETWEEN '2026-05-01' AND '2026-05-31'
ORDER BY work_date ASC;
```

### 2) Получить график на день (с именами и аттракционами)

```sql
SELECT
  s.work_date,
  e.full_name AS employee,
  a.name AS attraction,
  s.start_time,
  s.end_time
FROM schedule_assignments s
LEFT JOIN employees e ON e.id = s.employee_id
LEFT JOIN attractions a ON a.id = s.attraction_id
WHERE s.work_date = '2026-05-12'
ORDER BY a.name ASC, s.start_time ASC;
```

### 3) Отметить фактическое время работы

```sql
INSERT INTO actual_work_log (schedule_assignment_id, actual_start, actual_end)
VALUES (123, '10:05:00', '21:50:00');
```

### 4) Получить приоритеты сотрудника

```sql
SELECT priority_level, attraction_ids
FROM employee_attraction_priorities
WHERE employee_id = 42
ORDER BY priority_level ASC;
```

### 5) Установить цель обучения

```sql
INSERT INTO employee_study_goals (employee_id, attraction_id)
VALUES (42, 15)
ON CONFLICT (employee_id) DO UPDATE SET attraction_id = 15, updated_at = NOW();
```

### 6) Получить журнал действий за последние сутки

```sql
SELECT *
FROM activity_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 200;
```

---

## Realtime-подписки (синхронизация интерфейса)

Для актуализации данных в интерфейсе используйте подписки Supabase:

- **`employee_availability`**: изменения заявок сотрудника;
- **`schedule_assignments`**: изменения графика;
- **`actual_work_log`**: изменения фактического времени;
- **`employee_attraction_priorities`**: изменения приоритетов;
- **`employee_study_goals`**: изменения целей обучения.

Пример подписки (TypeScript):

```ts
supabase
  .channel('availability-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'employee_availability', filter: 'employee_id=eq.42' },
    () => refreshData()
  )
  .subscribe();
```

---

## Рекомендации по сопровождению

- **Регулярно проверяйте индексы** и план выполнения запросов при росте данных.
- **Настройте RLS**: сотрудники должны видеть/изменять только свои записи, администраторы — все.
- **Контролируйте журнал действий**: используйте `activity_log` для аудита и расследований.
- **Поддерживайте справочники актуальными**: аттракционы, ставки, минимальный штат.
- **Используйте ограничения** (unique, foreign keys, check constraints) для защиты целостности данных.

---

## Примечания

Документ описывает текущую реализацию ParkStaff 2.3.0.  
