// AttractionsList.tsx
/**
 * Компонент управления аттракционами
 * 
 * Функционал:
 * - Отображение списка аттракционов с их параметрами (коэффициент, минимальный персонал)
 * - CRUD операции для суперадминистратора (создание, редактирование, удаление)
 * - Inline редактирование данных
 * - Адаптивный современный UI с модальными окнами
 * 
 * @param {boolean} isSuperAdmin - Флаг прав доступа суперадминистратора
 * @param {function} onAttractionUpdate - Callback при изменении данных
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Attraction } from '../types';
import { Plus, Trash2, Loader2, X, Edit2, Check, AlertCircle } from 'lucide-react';

interface AttractionsListProps {
  isSuperAdmin: boolean;
  onAttractionUpdate?: () => void;
}

export function AttractionsList({ isSuperAdmin, onAttractionUpdate }: AttractionsListProps) {
  // ============ State Management ============
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Состояние для редактирования
  const [editName, setEditName] = useState('');
  const [editCoefficient, setEditCoefficient] = useState(1.0);
  const [editWeekday, setEditWeekday] = useState(1);
  const [editWeekend, setEditWeekend] = useState(1);
  
  // Состояние для добавления нового аттракциона
  const [newName, setNewName] = useState('');
  const [newCoefficient, setNewCoefficient] = useState(1.0);
  const [newWeekday, setNewWeekday] = useState(1);
  const [newWeekend, setNewWeekend] = useState(1);
  const [formError, setFormError] = useState('');

  // ============ Загрузка данных из Supabase ============
  const fetchAttractions = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('attractions')
      .select('id, name, min_staff_weekday, min_staff_weekend, coefficient')
      .order('name');
    
    if (fetchError) {
      setError(fetchError.message);
      setAttractions([]);
    } else {
      setAttractions(data || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchAttractions();
  }, []);

  // ============ Удаление аттракциона ============
  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) {
      alert('Недостаточно прав для выполнения операции');
      return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этот аттракцион?')) return;
    
    const { error: deleteError } = await supabase
      .from('attractions')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      alert('Ошибка удаления: ' + deleteError.message);
    } else {
      fetchAttractions();
      onAttractionUpdate?.();
    }
  };

  // ============ Добавление нового аттракциона ============
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSuperAdmin) {
      setFormError('Недостаточно прав для выполнения операции');
      return;
    }
    
    setFormError('');
    
    const { error: insertError } = await supabase
      .from('attractions')
      .insert({
        name: newName.trim(),
        min_staff_weekday: newWeekday,
        min_staff_weekend: newWeekend,
        coefficient: newCoefficient,
      });
    
    if (insertError) {
      setFormError(insertError.message);
    } else {
      // Сброс формы и обновление списка
      setShowAddForm(false);
      setNewName('');
      setNewCoefficient(1.0);
      setNewWeekday(1);
      setNewWeekend(1);
      fetchAttractions();
      onAttractionUpdate?.();
    }
  };

  // ============ Inline редактирование ============
  const startEdit = (att: Attraction) => {
    if (!isSuperAdmin) {
      alert('Недостаточно прав для выполнения операции');
      return;
    }
    
    setEditingId(att.id);
    setEditName(att.name);
    setEditCoefficient(att.coefficient);
    setEditWeekday(att.min_staff_weekday);
    setEditWeekend(att.min_staff_weekend);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    if (!isSuperAdmin) {
      alert('Недостаточно прав для выполнения операции');
      return;
    }
    
    const { error: updateError } = await supabase
      .from('attractions')
      .update({
        name: editName.trim(),
        coefficient: editCoefficient,
        min_staff_weekday: editWeekday,
        min_staff_weekend: editWeekend,
      })
      .eq('id', id);
    
    if (updateError) {
      alert('Ошибка сохранения: ' + updateError.message);
    } else {
      setEditingId(null);
      fetchAttractions();
      onAttractionUpdate?.();
    }
  };

  // ============ Render: Загрузка ============
  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 h-10 w-10 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Загрузка аттракционов...</p>
        </div>
      </div>
    );
  }

  // ============ Render: Ошибка ============
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900 mb-1">Ошибка загрузки данных</h3>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ============ Main Render ============
  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка добавления */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Аттракционы</h2>
          <p className="text-sm text-gray-500 mt-1">
            Управление списком аттракционов и их параметрами
          </p>
        </div>
        
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-lg 
                     flex items-center gap-2 hover:from-blue-700 hover:to-blue-800 
                     transition-all duration-200 shadow-md hover:shadow-lg font-medium"
          >
            <Plus className="h-5 w-5" />
            Добавить аттракцион
          </button>
        )}
      </div>

      {/* Модальное окно добавления */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
            {/* Шапка модального окна */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Новый аттракцион</h3>
                <p className="text-sm text-gray-500 mt-1">Заполните информацию об аттракционе</p>
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
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название аттракциона
                </label>
                <input
                  type="text"
                  placeholder="Например: Американские горки"
                  className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                           transition-all outline-none"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Коэффициент нагрузки
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1.0 = 100%"
                  className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                           transition-all outline-none"
                  value={newCoefficient}
                  onChange={e => setNewCoefficient(parseFloat(e.target.value) || 0)}
                  required
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Коэффициент загруженности (1.0 = стандартная нагрузка)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Персонал в будни
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Мин. сотрудников"
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             transition-all outline-none"
                    value={newWeekday}
                    onChange={e => setNewWeekday(Number(e.target.value) || 1)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Персонал в выходные
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Мин. сотрудников"
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             transition-all outline-none"
                    value={newWeekend}
                    onChange={e => setNewWeekend(Number(e.target.value) || 1)}
                    required
                  />
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-2.5 rounded-lg 
                           hover:from-green-700 hover:to-green-800 transition-all duration-200 
                           font-medium shadow-md hover:shadow-lg"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 
                           hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Таблица аттракционов */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Название
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Коэффициент
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Будни
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Выходные
                </th>
                {isSuperAdmin && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attractions.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <AlertCircle className="h-12 w-12 mb-3" />
                      <p className="text-sm font-medium">Аттракционы не найдены</p>
                      <p className="text-xs mt-1">Добавьте первый аттракцион</p>
                    </div>
                  </td>
                </tr>
              ) : (
                attractions.map(att => (
                  <tr
                    key={att.id}
                    className="hover:bg-blue-50/50 transition-colors duration-150"
                  >
                    {editingId === att.id ? (
                      // ============ Режим редактирования ============
                      <>
                        <td className="px-6 py-4">
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="w-full border border-blue-300 px-3 py-2 rounded-lg 
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                     transition-all outline-none"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editCoefficient}
                            onChange={e => setEditCoefficient(parseFloat(e.target.value) || 0)}
                            className="w-28 border border-blue-300 px-3 py-2 rounded-lg 
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                     transition-all outline-none"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            value={editWeekday}
                            onChange={e => setEditWeekday(Number(e.target.value) || 1)}
                            className="w-24 border border-blue-300 px-3 py-2 rounded-lg 
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                     transition-all outline-none"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            value={editWeekend}
                            onChange={e => setEditWeekend(Number(e.target.value) || 1)}
                            className="w-24 border border-blue-300 px-3 py-2 rounded-lg 
                                     focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                     transition-all outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => saveEdit(att.id)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg 
                                       transition-all duration-200"
                              title="Сохранить"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg 
                                       transition-all duration-200"
                              title="Отмена"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // ============ Режим просмотра ============
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 
                                          rounded-lg flex items-center justify-center mr-3">
                              <span className="text-white font-bold text-lg">
                                {att.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900">{att.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium 
                                         bg-purple-100 text-purple-800">
                            {att.coefficient.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium 
                                         bg-blue-100 text-blue-800">
                            {att.min_staff_weekday} чел.
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium 
                                         bg-orange-100 text-orange-800">
                            {att.min_staff_weekend} чел.
                          </span>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(att)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg 
                                         transition-all duration-200"
                                title="Редактировать"
                              >
                                <Edit2 className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(att.id)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg 
                                         transition-all duration-200"
                                title="Удалить"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Футер таблицы с подсчетом */}
        {attractions.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Всего аттракционов: <span className="font-semibold text-gray-900">{attractions.length}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
