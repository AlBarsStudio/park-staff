// SuperAdminDashboard.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Log } from '../types';
import {
  Loader2,
  ShieldAlert,
  Activity,
  Star,
  Settings,
  BarChart3,
} from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { EmployeePriorities } from './EmployeePriorities';

interface SuperAdminDashboardProps {
  profile: UserProfile;
}

// Стили для типов действий в логах
const ACTION_BADGE: Record<string, string> = {
  shift_add: 'bg-green-100 text-green-800',
  shift_delete: 'bg-red-100 text-red-800',
  shift_update: 'bg-blue-100 text-blue-800',
  schedule_generate: 'bg-purple-100 text-purple-800',
  schedule_save: 'bg-indigo-100 text-indigo-800',
  login: 'bg-gray-100 text-gray-700',
  logout: 'bg-gray-100 text-gray-700',
};

// Человеко-читаемые названия действий
const ACTION_LABELS: Record<string, string> = {
  shift_add: 'Добавление смены',
  shift_delete: 'Удаление смены',
  shift_update: 'Изменение смены',
  schedule_generate: 'Генерация графика',
  schedule_save: 'Сохранение графика',
  login: 'Вход',
  logout: 'Выход',
};

// Типы пользователей
const USER_TYPE_LABELS: Record<string, string> = {
  employee: 'Сотрудник',
  admin: 'Администратор',
  superadmin: 'Супер Адм.',
};

export function SuperAdminDashboard({ profile }: SuperAdminDashboardProps) {
  // Состояние для журнала действий
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  // Активная вкладка
  const [activeTab, setActiveTab] = useState<'admin' | 'priorities' | 'statistics' | 'logs'>('admin');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  // Загружаем логи только при переходе на вкладку "Журнал действий"
  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) setLogs(data as Log[]);
    if (error) console.error(error);
    setLoadingLogs(false);
  };

  // Фильтрация логов по типу и поиску
  const filteredLogs = logs.filter(log => {
    const matchesType = logFilter === 'all' || log.action_type === logFilter;
    const matchesSearch =
      !logSearch.trim() ||
      log.description?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.user_type?.toLowerCase().includes(logSearch.toLowerCase()) ||
      String(log.user_id).includes(logSearch);
    return matchesType && matchesSearch;
  });

  // Описание вкладок
  const tabs = [
    { id: 'admin' as const, label: 'Администратор', Icon: Settings },
    { id: 'priorities' as const, label: 'Приоритеты', Icon: Star },
    { id: 'statistics' as const, label: 'Статистика', Icon: BarChart3 },
    { id: 'logs' as const, label: 'Журнал действий', Icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Баннер супер-админа */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl shadow-xl">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0"></div>
          <div className="relative px-8 py-6 flex items-center gap-4">
            <div className="flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Панель Супер Администратора</h2>
              <p className="text-sm text-indigo-100 mt-1">Полный доступ ко всем функциям системы</p>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Навигация вкладок */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
            <div className="flex overflow-x-auto hide-scrollbar">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`group relative flex-shrink-0 px-8 py-5 text-sm font-semibold flex items-center gap-3 transition-all duration-200 ${
                    activeTab === id
                      ? 'text-indigo-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-200 ${
                    activeTab === id ? 'scale-110' : 'group-hover:scale-105'
                  }`} />
                  <span>{label}</span>
                  {activeTab === id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Контент вкладок */}
          <div className="min-h-[600px]">
            {/* Вкладка "Администратор" */}
            {activeTab === 'admin' && (
              <div className="p-6">
                <AdminDashboard profile={profile} isSuperAdmin={true} />
              </div>
            )}

            {/* Вкладка "Приоритеты" */}
            {activeTab === 'priorities' && (
              <div className="p-6">
                <EmployeePriorities />
              </div>
            )}

            {/* Вкладка "Статистика" (в разработке) */}
            {activeTab === 'statistics' && (
              <div className="p-6">
                <div className="flex items-center justify-center py-24">
                  <div className="text-center max-w-md">
                    <div className="relative mx-auto mb-6 h-24 w-24">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl opacity-10 blur-xl"></div>
                      <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl h-full w-full flex items-center justify-center border border-indigo-100">
                        <BarChart3 className="h-12 w-12 text-indigo-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Статистика</h3>
                    <p className="text-gray-600 mb-6">
                      Этот раздел находится в разработке. Скоро здесь появится подробная аналитика и статистические данные системы.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl px-6 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="h-2 w-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="h-2 w-2 bg-pink-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm font-medium text-indigo-700">В разработке</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Вкладка "Журнал действий" */}
            {activeTab === 'logs' && (
              <div className="p-6 space-y-6">
                {/* Фильтры */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Поиск по описанию, пользователю..."
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                      className="block w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow shadow-sm"
                    />
                  </div>
                  <select
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm transition-shadow"
                  >
                    <option value="all">Все типы</option>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <button
                    onClick={fetchLogs}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
                  >
                    Обновить
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="flex justify-center py-24">
                    <Loader2 className="animate-spin text-indigo-600 h-10 w-10" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gradient-to-r from-gray-50 to-slate-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Дата/Время</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Тип польз.</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Действие</th>
                              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Описание</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredLogs.map(log => (
                              <tr key={log.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                  {new Date(log.created_at).toLocaleString('ru-RU')}
                                </td>
                                <td className="px-6 py-4 text-sm whitespace-nowrap">
                                  <span className="font-semibold text-gray-700">
                                    {USER_TYPE_LABELS[log.user_type] || log.user_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                  <span className="font-mono">#{log.user_id}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                    ACTION_BADGE[log.action_type] || 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {ACTION_LABELS[log.action_type] || log.action_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                                  <span className="line-clamp-2">{log.description}</span>
                                </td>
                              </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-6 py-16 text-center">
                                  <Activity className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                  <p className="text-sm text-gray-500 font-medium">Записей не найдено</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-gray-500">
                        Показано: <span className="font-semibold text-gray-700">{filteredLogs.length}</span> из <span className="font-semibold text-gray-700">{logs.length}</span> записей
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
