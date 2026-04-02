import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Log } from '../types';
import { Loader2, ShieldAlert, Activity, Users, Settings } from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';

interface SuperAdminDashboardProps {
  profile: UserProfile;
}

const ACTION_BADGE: Record<string, string> = {
  shift_add: 'bg-green-100 text-green-800',
  shift_delete: 'bg-red-100 text-red-800',
  shift_update: 'bg-blue-100 text-blue-800',
  schedule_generate: 'bg-purple-100 text-purple-800',
  schedule_save: 'bg-indigo-100 text-indigo-800',
  login: 'bg-gray-100 text-gray-700',
  logout: 'bg-gray-100 text-gray-700',
};

const ACTION_LABELS: Record<string, string> = {
  shift_add: 'Добавление смены',
  shift_delete: 'Удаление смены',
  shift_update: 'Изменение смены',
  schedule_generate: 'Генерация графика',
  schedule_save: 'Сохранение графика',
  login: 'Вход',
  logout: 'Выход',
};

const USER_TYPE_LABELS: Record<string, string> = {
  employee: 'Сотрудник',
  admin: 'Администратор',
  superadmin: 'Супер Адм.',
};

export function SuperAdminDashboard({ profile }: SuperAdminDashboardProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'shifts' | 'logs' | 'users'>('shifts');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

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

  const filteredLogs = logs.filter(log => {
    const matchesType = logFilter === 'all' || log.action_type === logFilter;
    const matchesSearch =
      !logSearch.trim() ||
      log.description?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.user_type?.toLowerCase().includes(logSearch.toLowerCase()) ||
      String(log.user_id).includes(logSearch);
    return matchesType && matchesSearch;
  });

  const tabs = [
    { id: 'shifts' as const, label: 'Управление сменами', Icon: Settings },
    { id: 'users' as const, label: 'Пользователи', Icon: Users },
    { id: 'logs' as const, label: 'Журнал действий', Icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Баннер супер-админа */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl shadow-sm flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 flex-shrink-0" />
        <div>
          <h2 className="text-lg font-bold">Панель Супер Администратора</h2>
          <p className="text-sm text-red-100">Полный доступ ко всем функциям системы</p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-shrink-0 px-6 py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-0">
          {activeTab === 'shifts' && (
            <div className="p-1">
              {/* Переиспользуем AdminDashboard с флагом суперадмина */}
              <AdminDashboard profile={profile} isSuperAdmin={true} />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="p-6">
              <div className="text-center py-16">
                <div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-800 mb-2">Управление пользователями</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  Здесь можно добавлять, редактировать и удалять сотрудников и администраторов.
                  Требуется интеграция с Supabase Auth Admin API.
                </p>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 inline-block">
                  Функция в разработке
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Поиск по описанию, пользователю..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={logFilter}
                  onChange={e => setLogFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">Все типы</option>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button
                  onClick={fetchLogs}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Обновить
                </button>
              </div>

              {loadingLogs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-purple-600 h-8 w-8" />
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Дата/Время</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Тип польз.</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Действие</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Описание</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('ru-RU')}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                            <span className="font-medium">
                              {USER_TYPE_LABELS[log.user_type] || log.user_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            #{log.user_id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ACTION_BADGE[log.action_type] || 'bg-gray-100 text-gray-700'
                            }`}>
                              {ACTION_LABELS[log.action_type] || log.action_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                            <span className="line-clamp-2">{log.description}</span>
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                            <Activity className="mx-auto h-8 w-8 mb-2 opacity-40" />
                            Записей не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-xs text-gray-400 text-right">
                Показано: {filteredLogs.length} из {logs.length} записей
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
