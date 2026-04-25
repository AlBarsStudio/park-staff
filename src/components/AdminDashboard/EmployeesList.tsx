// EmployeesList.tsx
/**
 * Компонент управления сотрудниками
 * Функционал:
 * - Отображение списка сотрудников с контактными данными
 * - Добавление новых сотрудников (для суперадминистратора)
 * - Создание учетных записей в Supabase Auth
 * - Удаление сотрудников (для суперадминистратора)
 * - Ограничение видимости данных в зависимости от уровня доступа
 * 
 * @param {boolean} isSuperAdmin - Флаг прав суперадминистратора
 * @param {number} currentUserId - ID текущего пользователя
 * @param {function} onEmployeeUpdate - Callback при изменении данных
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Employee } from '../../types';
import { Plus, Trash2, Loader2, X, AlertCircle, UserPlus, Users, Phone, Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

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

  // ============ Вспомогательные функции ============
  const getAccessLevelBadge = (level?: number) => {
    switch (level) {
      case 1:
        return <Badge variant="error">Супер-администратор</Badge>;
      case 2:
        return <Badge variant="warning">Администратор</Badge>;
      case 3:
        return <Badge variant="info">Сотрудник</Badge>;
      default:
        return <Badge variant="neutral">Не определен</Badge>;
    }
  };

  // ============ Render: Загрузка ============
  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto mb-3" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">
            Загрузка сотрудников...
          </p>
        </div>
      </div>
    );
  }

  // ============ Render: Пустой список для обычного пользователя ============
  if (!isSuperAdmin && employees.length === 0) {
    return (
      <Card className="text-center p-8" style={{ backgroundColor: 'var(--warning-light)' }}>
        <AlertCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--warning)' }} />
        <h3 className="font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Нет данных о профиле
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Обратитесь к администратору для настройки доступа
        </p>
      </Card>
    );
  }

  // ============ Main Render ============
  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка добавления */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Сотрудники
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isSuperAdmin
              ? 'Управление персоналом и доступом к системе'
              : 'Информация о вашем профиле'
            }
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            onClick={() => setShowAddForm(true)}
            icon={<UserPlus className="h-5 w-5" />}
          >
            Добавить сотрудника
          </Button>
        )}
      </div>

      {/* Модальное окно добавления сотрудника */}
      <Modal
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setFormError('');
        }}
        title="Новый сотрудник"
        size="lg"
      >
        <form onSubmit={handleAddSubmit} className="p-6 space-y-6">
          {/* Основная информация */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--text)' }}>
              Основная информация
            </h4>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                ФИО <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <Input
                type="text"
                placeholder="Иванов Иван Иванович"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                  Возраст
                </label>
                <Input
                  type="number"
                  min="16"
                  max="100"
                  placeholder="25"
                  value={formData.age}
                  onChange={e => setFormData({ ...formData, age: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                  Уровень доступа <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  className="input w-full"
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
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <h4 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--text)' }}>
              Контактная информация
            </h4>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Телефон
              </label>
              <Input
                type="tel"
                placeholder="+7 (999) 123-45-67"
                icon={<Phone className="h-4 w-4" style={{ color: 'var(--text-subtle)' }} />}
                value={formData.phone_number}
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                  Telegram
                </label>
                <Input
                  type="text"
                  placeholder="@username"
                  value={formData.telegram}
                  onChange={e => setFormData({ ...formData, telegram: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                  VK
                </label>
                <Input
                  type="text"
                  placeholder="vk.com/username"
                  value={formData.vk}
                  onChange={e => setFormData({ ...formData, vk: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Данные для входа */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <h4 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--text)' }}>
              Данные для входа в систему
            </h4>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Email <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <Input
                type="email"
                placeholder="example@mail.com"
                icon={<Mail className="h-4 w-4" style={{ color: 'var(--text-subtle)' }} />}
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Пароль <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <Input
                type="password"
                placeholder="Минимум 6 символов"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                Пароль должен содержать минимум 6 символов
              </p>
            </div>
          </div>

          {/* Ошибка */}
          {formError && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ 
              backgroundColor: 'var(--error-light)',
              border: '1px solid var(--error)'
            }}>
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
              <p className="text-sm" style={{ color: 'var(--error)' }}>{formError}</p>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              variant="success"
              loading={isSubmitting}
              className="flex-1"
            >
              Создать сотрудника
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddForm(false);
                setFormError('');
              }}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      {/* Таблица сотрудников */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{ borderColor: 'var(--border)' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  ФИО
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Возраст
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Телефон
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Telegram
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  VK
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Последний вход
                </th>
                {isSuperAdmin && (
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center" style={{ color: 'var(--text-subtle)' }}>
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
                    className="transition-colors duration-150 hover:bg-opacity-50"
                    style={{ 
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {emp.full_name || '—'}
                      </div>
                      <div className="mt-1">
                        {getAccessLevelBadge(emp.access_level)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text)' }}>
                      {emp.age ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text)' }}>
                      {emp.phone_number ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text)' }}>
                      {emp.telegram ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text)' }}>
                      {emp.vk ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {emp.last_login 
                        ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm', { locale: ru }) 
                        : '—'
                      }
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(emp.id)}
                          icon={<Trash2 className="h-4 w-4" style={{ color: 'var(--error)' }} />}
                          title="Удалить сотрудника"
                        />
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
          <div className="px-6 py-3 border-t" style={{ 
            backgroundColor: 'var(--bg-tertiary)',
            borderColor: 'var(--border)'
          }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Всего сотрудников: <span className="font-semibold" style={{ color: 'var(--text)' }}>{employees.length}</span>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
