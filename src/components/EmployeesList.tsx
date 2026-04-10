// EmployeesList.tsx
/**
 * Компонент управления сотрудниками
 * 
 * Функционал:
 * - Отображение списка сотрудников с контактными данными
 * - Добавление новых сотрудников (для суперадминистратора)
 * - Создание учетных записей в Supabase Auth
 * - Удаление сотрудников (для суперадминистратора)
 * - Ограничение видимости данных в зависимости от уровня доступа
 * 
 * @param {boolean} isSuperAdmin - Флаг прав суперадминистратора
 * @param {number} currentUserId - ID текущего пользователя (для ограничения данных)
 * @param {function} onEmployeeUpdate - Callback при изменении данных
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../types';
import { Plus, Trash2, Loader2, X, AlertCircle, UserPlus, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EmployeesListProps {
  isSuperAdmin: boolean;
  currentUserId?: number;
  onEmployeeUpdate?: () => void;
}

export function EmployeesList({ isSuperAdmin, currentUserId, onEmployeeUpdate }: EmployeesListProps) {
  // ============ State Management ============
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Данные формы для добавления нового сотрудника
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    phone_number: '',
    telegram: '',
    vk: '',
    email: '',
    password: '',
    access_level: '3',
  });

  // ============ Загрузка списка сотрудников ============
  const fetchEmployees = async () => {
    setLoading(true);
    
    // Базовый запрос к таблице сотрудников
    let query = supabase
      .from('employees')
      .select('id, full_name, age, phone_number, telegram, vk, access_level, auth_uid, last_login')
      .order('full_name', { ascending: true });

    // Если не суперадмин - показываем только текущего пользователя
    if (!isSuperAdmin && currentUserId) {
      query = query.eq('id', currentUserId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Ошибка загрузки сотрудников:', error);
      setEmployees([]);
    } else {
      setEmployees(data || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, [isSuperAdmin, currentUserId]);

  // ============ Удаление сотрудника ============
  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) {
      alert('Недостаточно прав для выполнения операции');
      return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert('Ошибка удаления: ' + error.message);
    } else {
      fetchEmployees();
      onEmployeeUpdate?.();
    }
  };

  // ============ Добавление нового сотрудника ============
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSuperAdmin) {
      setFormError('Недостаточно прав для выполнения операции');
      return;
    }
    
    setFormError('');
    setIsSubmitting(true);

    try {
      // Шаг 1: Создание пользователя в Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      
      if (authError) {
        setFormError(authError.message);
        setIsSubmitting(false);
        return;
      }
      
      const user = authData.user;
      if (!user) {
        setFormError('Не удалось создать пользователя в системе');
        setIsSubmitting(false);
        return;
      }

      // Шаг 2: Создание записи сотрудника в базе данных
      const { error: insertError } = await supabase.from('employees').insert({
        full_name: formData.full_name.trim(),
        age: formData.age ? parseInt(formData.age) : null,
        phone_number: formData.phone_number.trim() || null,
        telegram: formData.telegram.trim() || null,
        vk: formData.vk.trim() || null,
        auth_uid: user.id,
        access_level: parseInt(formData.access_level),
      });
      
      if (insertError) {
        setFormError(insertError.message);
        setIsSubmitting(false);
        return;
      }

      // Успешное добавление - сброс формы и обновление списка
      setShowAddForm(false);
      setFormData({
        full_name: '',
        age: '',
        phone_number: '',
        telegram: '',
        vk: '',
        email: '',
        password: '',
        access_level: '3',
      });
      fetchEmployees();
      onEmployeeUpdate?.();
      
    } catch (err) {
      console.error('Ошибка при добавлении сотрудника:', err);
      setFormError('Произошла неизвестная ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ Вспомогательная функция для отображения уровня доступа ============
  const getAccessLevelText = (level: number): string => {
    switch (level) {
      case 1: return 'Супер-администратор';
      case 2: return 'Администратор';
      case 3: return 'Сотрудник';
      default: return 'Не определен';
    }
  };

  // ============ Render: Загрузка ============
  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 h-10 w-10 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Загрузка сотрудников...</p>
        </div>
      </div>
    );
  }

  // ============ Render: Пустой список для обычного пользователя ============
  if (!isSuperAdmin && employees.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="font-semibold text-yellow-900 mb-1">Нет данных о профиле</h3>
        <p className="text-yellow-700 text-sm">Обратитесь к администратору для настройки доступа</p>
      </div>
    );
  }

  // ============ Main Render ============
  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка добавления */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Сотрудники</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isSuperAdmin 
              ? 'Управление персоналом и доступом к системе' 
              : 'Информация о вашем профиле'
            }
          </p>
        </div>
        
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-lg 
                     flex items-center gap-2 hover:from-blue-700 hover:to-blue-800 
                     transition-all duration-200 shadow-md hover:shadow-lg font-medium"
          >
            <UserPlus className="h-5 w-5" />
            Добавить сотрудника
          </button>
        )}
      </div>

      {/* Модальное окно добавления сотрудника */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all max-h-[90vh] overflow-y-auto">
            {/* Шапка модального окна */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Новый сотрудник</h3>
                <p className="text-sm text-gray-500 mt-1">Заполните данные для создания учетной записи</p>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Форма */}
            <form onSubmit={handleAddSubmit} className="p-6 space-y-5">
              {/* Основная информация */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Основная информация
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ФИО <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Иванов Иван Иванович"
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             transition-all outline-none"
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Возраст
                    </label>
                    <input
                      type="number"
                      min="16"
                      max="100"
                      placeholder="25"
                      className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                               transition-all outline-none"
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Уровень доступа <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                               transition-all outline-none bg-white"
                      value={formData.access_level}
                      onChange={e => setFormData({ ...formData, access_level: e.target.value })}
                    >
                      <option value="3">Сотрудник</option>
                      <option value="2">Администратор</option>
                      <option value="1">Супер-администратор</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Контактная информация */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Контактная информация
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    placeholder="+7 (999) 123-45-67"
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             transition-all outline-none"
                    value={formData.phone_number}
                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telegram
                    </label>
                    <input
                      type="text"
                      placeholder="@username"
                      className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                               transition-all outline-none"
                      value={formData.telegram}
                      onChange={e => setFormData({ ...formData, telegram: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VK
                    </label>
                    <input
                      type="text"
                      placeholder="vk.com/username"
                      className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                               transition-all outline-none"
                      value={formData.vk}
                      onChange={e => setFormData({ ...formData, vk: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Данные для входа */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
                  Данные для входа в систему
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="example@mail.com"
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             transition-all outline-none"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Пароль <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Минимум 6 символов"
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             transition-all outline-none"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Пароль должен содержать минимум 6 символов
                  </p>
                </div>
              </div>

              {/* Ошибка */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{formError}</p>
                </div>
              )}

              {/* Кнопки */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-2.5 rounded-lg 
                           hover:from-green-700 hover:to-green-800 transition-all duration-200 
                           font-medium shadow-md hover:shadow-lg disabled:opacity-50 
                           disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    'Создать сотрудника'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                  }}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 
                           hover:bg-gray-50 transition-all duration-200 font-medium
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Таблица сотрудников */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ФИО
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Возраст
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Телефон
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Telegram
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  VK
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Последний вход
                </th>
                {isSuperAdmin && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Users className="h-12 w-12 mb-3" />
                      <p className="text-sm font-medium">Сотрудники не найдены</p>
                      <p className="text-xs mt-1">Добавьте первого сотрудника</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map(emp => (
                  <tr
                    key={emp.id}
                    className="hover:bg-blue-50/50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {emp.full_name || '—'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {getAccessLevelText(emp.access_level)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {emp.age ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {emp.phone_number ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {emp.telegram ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {emp.vk ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {emp.last_login 
                        ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm', { locale: ru }) 
                        : '—'
                      }
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg 
                                   transition-all duration-200 inline-flex items-center justify-center"
                          title="Удалить сотрудника"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Футер таблицы с подсчетом */}
        {employees.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Всего сотрудников: <span className="font-semibold text-gray-900">{employees.length}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
