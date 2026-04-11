import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Attraction } from '../types';
import { Plus, Trash2, Loader2, X, Edit2, Check, AlertCircle, Gamepad2 } from 'lucide-react';
import { Card, Button, Modal, Badge } from './ui';

interface AttractionsListProps {
  isSuperAdmin: boolean;
  onAttractionUpdate?: () => void;
}

export function AttractionsList({ isSuperAdmin, onAttractionUpdate }: AttractionsListProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [editName, setEditName] = useState('');
  const [editCoefficient, setEditCoefficient] = useState(1.0);
  const [editWeekday, setEditWeekday] = useState(1);
  const [editWeekend, setEditWeekend] = useState(1);
  
  const [newName, setNewName] = useState('');
  const [newCoefficient, setNewCoefficient] = useState(1.0);
  const [newWeekday, setNewWeekday] = useState(1);
  const [newWeekend, setNewWeekend] = useState(1);
  const [formError, setFormError] = useState('');

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
      setShowAddForm(false);
      setNewName('');
      setNewCoefficient(1.0);
      setNewWeekday(1);
      setNewWeekend(1);
      fetchAttractions();
      onAttractionUpdate?.();
    }
  };

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

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto mb-3" style={{ color: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загрузка аттракционов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--error-light)' }}>
            <AlertCircle className="h-6 w-6" style={{ color: 'var(--error)' }} />
          </div>
          <div>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Ошибка загрузки данных
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Аттракционы
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Управление списком аттракционов и их параметрами
          </p>
        </div>
        
        {isSuperAdmin && (
          <Button
            onClick={() => setShowAddForm(true)}
            variant="primary"
            icon={<Plus className="h-5 w-5" />}
          >
            Добавить
          </Button>
        )}
      </div>

      {/* Модальное окно добавления */}
      <Modal
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setFormError('');
        }}
        title="Новый аттракцион"
      >
        <form onSubmit={handleAdd} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
              Название аттракциона
            </label>
            <input
              type="text"
              placeholder="Например: Американские горки"
              className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
              Коэффициент нагрузки
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="1.0 = 100%"
              className="input"
              value={newCoefficient}
              onChange={e => setNewCoefficient(parseFloat(e.target.value) || 0)}
              required
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
              Коэффициент загруженности (1.0 = стандартная нагрузка)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Персонал в будни
              </label>
              <input
                type="number"
                min="1"
                placeholder="Мин. сотрудников"
                className="input"
                value={newWeekday}
                onChange={e => setNewWeekday(Number(e.target.value) || 1)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Персонал в выходные
              </label>
              <input
                type="number"
                min="1"
                placeholder="Мин. сотрудников"
                className="input"
                value={newWeekend}
                onChange={e => setNewWeekend(Number(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'var(--error-light)' }}>
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
              <p className="text-sm" style={{ color: 'var(--error)' }}>{formError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="success" className="flex-1">
              Сохранить
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddForm(false);
                setFormError('');
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      {/* Таблица */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Название
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Коэффициент
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Будни
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Выходные
                </th>
                {isSuperAdmin && (
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Действия
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {attractions.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center" style={{ color: 'var(--text-subtle)' }}>
                      <Gamepad2 className="h-12 w-12 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Аттракционы не найдены</p>
                      <p className="text-xs mt-1">Добавьте первый аттракцион</p>
                    </div>
                  </td>
                </tr>
              ) : (
                attractions.map(att => (
                  <tr
                    key={att.id}
                    className="transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {editingId === att.id ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="input"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editCoefficient}
                            onChange={e => setEditCoefficient(parseFloat(e.target.value) || 0)}
                            className="input w-28"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            value={editWeekday}
                            onChange={e => setEditWeekday(Number(e.target.value) || 1)}
                            className="input w-24"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            value={editWeekend}
                            onChange={e => setEditWeekend(Number(e.target.value) || 1)}
                            className="input w-24"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => saveEdit(att.id)}
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: 'var(--success)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--success-light)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 rounded-lg transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 flex-shrink-0 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: 'var(--primary)' }}
                            >
                              <span className="text-white font-bold text-lg">
                                {att.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                              {att.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="warning">
                            ×{att.coefficient.toFixed(2)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="info">
                            {att.min_staff_weekday} чел.
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="primary">
                            {att.min_staff_weekend} чел.
                          </Badge>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(att)}
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: 'var(--info)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--info-light)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Edit2 className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(att.id)}
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: 'var(--error)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--error-light)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
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

        {attractions.length > 0 && (
          <div className="px-6 py-3 border-t" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Всего аттракционов: <span className="font-semibold" style={{ color: 'var(--text)' }}>{attractions.length}</span>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
