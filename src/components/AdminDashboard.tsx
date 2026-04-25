/**
 * =====================================================================
 * AdminDashboard - Обёртка для обратной совместимости
 * 
 * ⚠️ ВНИМАНИЕ: Этот файл является обёрткой!
 * 
 * Весь функционал перенесён в модульную структуру:
 * src/components/AdminDashboard/
 * ├── index.tsx                 - Главный компонент
 * ├── AdminStats.tsx            - Статистика
 * ├── AdminTabs.tsx             - Навигация
 * ├── ShiftsManagement.tsx      - Управление сменами
 * ├── ManualScheduleComposer.tsx- Ручное составление
 * ├── ScheduleView.tsx          - Просмотр графика
 * └── EmployeesList.tsx         - Список сотрудников
 * 
 * Использование:
 * import { AdminDashboard } from './components/AdminDashboard';
 * 
 * @deprecated Этот файл оставлен только для обратной совместимости
 * @see src/components/AdminDashboard/index.tsx
 * =====================================================================
 */

// Переэкспортируем компонент из новой структуры
export { AdminDashboard } from './AdminDashboard/index';

// Переэкспортируем типы
export type { AdminDashboardProps, TabType } from './AdminDashboard/index';

// Для разработчиков: если вы видите это в редакторе,
// рекомендуется обновить импорты на:
// import { AdminDashboard } from './components/AdminDashboard';
