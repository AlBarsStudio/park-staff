# 🚀 Деплой и настройка

---

## Требования

| Инструмент | Версия |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Аккаунт Supabase | — |
| Аккаунт GitHub | (для деплоя на GitHub Pages) |

---

## Локальная разработка

### 1. Клонировать репозиторий

```bash
git clone https://github.com/AlBarsStudio/park-staff.git
cd park-staff

2. Установить зависимости
npm install
3. Создать файл переменных окружения
Создайте файл .env в корне проекта:
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
Где найти значения
Войдите в Supabase Dashboard
Выберите ваш проект
Перейдите в Project Settings → API
Скопируйте:
Project URL → VITE_SUPABASE_URL
anon public → VITE_SUPABASE_ANON_KEY
4. Запустить проект
npm run dev
Сайт откроется по адресу: http://localhost:5173
Сборка для продакшна
npm run build
Собранные файлы появятся в папке dist/.
Деплой на GitHub Pages
Проект настроен на автоматический деплой через GitHub Actions.

Как работает автодеплой
При каждом пуше в ветку main:

GitHub Actions запускает workflow из .github/workflows/deploy.yml
Выполняется npm run build
Содержимое dist/ деплоится на GitHub Pages
Настройка секретов GitHub
В настройках репозитория (Settings → Secrets and variables → Actions) добавьте:

Секрет	Значение
VITE_SUPABASE_URL	URL вашего Supabase проекта
VITE_SUPABASE_ANON_KEY	Anon-ключ Supabase
Ручной деплой
Bash

# Собрать
npm run build

# Задеплоить вручную (если настроен gh-pages)
npx gh-pages -d dist

Настройка Supabase
Создание таблиц
Выполните SQL-миграции в Supabase Dashboard → SQL Editor.
Структура таблиц описана в docs/database.md.

Настройка Auth
В Supabase Dashboard перейдите в Authentication → Settings
Включите Email Auth
При необходимости отключите подтверждение email для тестовой среды
Добавление пользователей
Шаг 1: Создать пользователя в Supabase Auth

Authentication → Users → Add User
Email: user@example.com
Password: пароль

Шаг 2: Добавить запись в таблицу

Для администратора — в таблицу admins:

SQL

INSERT INTO admins (full_name, auth_uid, access_level)
VALUES ('Иванов Иван Иванович', 'uuid-из-supabase-auth', 2);
Для сотрудника — в таблицу employees:

SQL

INSERT INTO employees (full_name, auth_uid, access_level, base_hourly_rate)
VALUES ('Петров Пётр Петрович', 'uuid-из-supabase-auth', 3, 250);
Row Level Security (RLS)
Рекомендуется настроить RLS-политики для защиты данных.
Сотрудники должны видеть только свои данные.

Переменные окружения
Переменная	Обязательная	Описание
VITE_SUPABASE_URL	✅	URL проекта Supabase
VITE_SUPABASE_ANON_KEY	✅	Публичный anon-ключ Supabase
Все переменные должны начинаться с VITE_ для доступа в Vite-приложении.

Используемые зависимости
dependencies:
  @supabase/supabase-js  ^2.101.1  — клиент Supabase
  react                  19.2.3    — UI фреймворк
  react-dom              19.2.3    — рендеринг React
  date-fns               ^4.1.0    — работа с датами
  lucide-react           ^1.7.0    — иконки
  clsx                   2.1.1     — утилита для классов
  tailwind-merge         3.4.0     — слияние Tailwind классов

devDependencies:
  vite                   7.2.4     — сборщик
  tailwindcss            4.1.17    — CSS фреймворк
  typescript             5.9.3     — типизация
  @vitejs/plugin-react   5.1.1     — плагин React для Vite

Документ актуален для версии ParkStaff 2.3.0
