// EmployeesList.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../types';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EmployeesListProps {
  isSuperAdmin: boolean;
  currentUserId?: number;
  onEmployeeUpdate?: () => void;
}

export function EmployeesList({ isSuperAdmin, currentUserId, onEmployeeUpdate }: EmployeesListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');

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

  // ---------------- FETCH ----------------
  const fetchEmployees = async () => {
    setLoading(true);
    let query = supabase
      .from('employees')
      .select('id, full_name, age, phone_number, telegram, vk, access_level, auth_uid, last_login')
      .order('full_name', { ascending: true });

    if (!isSuperAdmin && currentUserId) {
      query = query.eq('id', currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Ошибка загрузки сотрудников:', error);
    } else {
      setEmployees(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, [isSuperAdmin, currentUserId]);

  // ---------------- DELETE ----------------
  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) {
      alert('Недостаточно прав');
      return;
    }
    if (!confirm('Удалить сотрудника?')) return;

    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      alert('Ошибка удаления: ' + error.message);
    } else {
      fetchEmployees();
      onEmployeeUpdate?.();
    }
  };

  // ---------------- ADD ----------------
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setFormError('Недостаточно прав');
      return;
    }
    setFormError('');

    try {
      // 1. Создаём пользователя в Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      if (authError) {
        setFormError(authError.message);
        return;
      }
      const user = authData.user;
      if (!user) {
        setFormError('Не удалось создать пользователя');
        return;
      }

      // 2. Добавляем запись в employees
      const { error: insertError } = await supabase.from('employees').insert({
        full_name: formData.full_name,
        age: formData.age ? parseInt(formData.age) : null,
        phone_number: formData.phone_number || null,
        telegram: formData.telegram || null,
        vk: formData.vk || null,
        auth_uid: user.id,
        access_level: parseInt(formData.access_level),
      });
      if (insertError) {
        setFormError(insertError.message);
        return;
      }

      // Сброс формы и обновление списка
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
      console.error(err);
      setFormError('Неизвестная ошибка');
    }
  };

  // ---------------- UI ----------------
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  if (!isSuperAdmin && employees.length === 0) {
    return <div className="text-center py-8 text-gray-500">Нет данных о вашем профиле</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Сотрудники</h2>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Добавить
          </button>
        )}
      </div>

      {/* Модальное окно добавления */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новый сотрудник</h3>
              <button onClick={() => setShowAddForm(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <input
                placeholder="ФИО"
                className="w-full border p-2 rounded"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Возраст"
                className="w-full border p-2 rounded"
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
              />
              <input
                placeholder="Телефон"
                className="w-full border p-2 rounded"
                value={formData.phone_number}
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
              />
              <input
                placeholder="Telegram"
                className="w-full border p-2 rounded"
                value={formData.telegram}
                onChange={e => setFormData({ ...formData, telegram: e.target.value })}
              />
              <input
                placeholder="VK"
                className="w-full border p-2 rounded"
                value={formData.vk}
                onChange={e => setFormData({ ...formData, vk: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border p-2 rounded"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                className="w-full border p-2 rounded"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <select
                className="w-full border p-2 rounded"
                value={formData.access_level}
                onChange={e => setFormData({ ...formData, access_level: e.target.value })}
              >
                <option value="3">Сотрудник</option>
                <option value="2">Администратор</option>
                <option value="1">Супер-администратор</option>
              </select>
              {formError && <div className="text-red-600 text-sm">{formError}</div>}
              <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Таблица сотрудников */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">ФИО</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Возраст</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Телефон</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Telegram</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">VK</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Последний вход</th>
              {isSuperAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Действия</th>}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm">{emp.full_name || '—'}</td>
                <td className="px-4 py-2 text-sm">{emp.age ?? '—'}</td>
                <td className="px-4 py-2 text-sm">{emp.phone_number ?? '—'}</td>
                <td className="px-4 py-2 text-sm">{emp.telegram ?? '—'}</td>
                <td className="px-4 py-2 text-sm">{emp.vk ?? '—'}</td>
                <td className="px-4 py-2 text-sm">
                  {emp.last_login ? format(parseISO(emp.last_login), 'dd.MM.yyyy HH:mm') : '—'}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
