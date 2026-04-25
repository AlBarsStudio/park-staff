/**
 * =====================================================================
 * AdminDashboard - Обёртка для обратной совместимости
 * 
 * Этот файл оставлен для совместимости со старым кодом.
 * Весь функционал перенесён в src/components/AdminDashboard/
 * 
 * @deprecated Используйте import { AdminDashboard } from './AdminDashboard'
 * =====================================================================
 */

export { AdminDashboard } from './AdminDashboard/index';

// Переэкспортируем типы, если они использовались
export type { AdminDashboardProps } from './AdminDashboard/index';
