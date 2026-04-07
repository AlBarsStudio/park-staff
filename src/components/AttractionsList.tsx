// AttractionsList.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Attraction } from '../types';
import { Plus, Trash2, Loader2, X, Edit2 } from 'lucide-react';

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
      alert('Недостаточно прав');
      return;
    }
    if (!confirm('Удалить аттракцион?')) return;
    const { error: deleteError } = await supabase.from('attractions').delete().eq('id', id);
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
      setFormError('Недостаточно прав');
      return;
    }
    setFormError('');
    const { error: insertError } = await supabase.from('attractions').insert({
      name: newName,
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
      alert('Недостаточно прав');
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
      alert('Недостаточно прав');
      return;
    }
    const { error: updateError } = await supabase
      .from('attractions')
      .update({
        name: editName,
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
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4">Ошибка загрузки: {error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Аттракционы</h2>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Добавить
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новый аттракцион</h3>
              <button onClick={() => setShowAddForm(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                type="text"
                placeholder="Название"
                className="w-full border p-2 rounded"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Коэффициент (1.0 = 100%)"
                className="w-full border p-2 rounded"
                value={newCoefficient}
                onChange={e => setNewCoefficient(parseFloat(e.target.value))}
                required
              />
              <input
                type="number"
                placeholder="Мин. сотрудников в будни"
                className="w-full border p-2 rounded"
                value={newWeekday}
                onChange={e => setNewWeekday(Number(e.target.value))}
                required
              />
              <input
                type="number"
                placeholder="Мин. сотрудников в выходные"
                className="w-full border p-2 rounded"
                value={newWeekend}
                onChange={e => setNewWeekend(Number(e.target.value))}
                required
              />
              {formError && <div className="text-red-600 text-sm">{formError}</div>}
              <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Название</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Коэффициент</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Мин. персонал (будни)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Мин. персонал (выходные)</th>
              {isSuperAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Действия</th>}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {attractions.map(att => (
              <tr key={att.id} className="hover:bg-gray-50">
                {editingId === att.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="border p-1 rounded w-full"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editCoefficient}
                        onChange={e => setEditCoefficient(parseFloat(e.target.value))}
                        className="border p-1 rounded w-24"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editWeekday}
                        onChange={e => setEditWeekday(Number(e.target.value))}
                        className="border p-1 rounded w-20"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editWeekend}
                        onChange={e => setEditWeekend(Number(e.target.value))}
                        className="border p-1 rounded w-20"
                      />
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button onClick={() => saveEdit(att.id)} className="text-green-600 hover:text-green-800">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700">
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-sm">{att.name}</td>
                    <td className="px-4 py-2 text-sm">{att.coefficient}</td>
                    <td className="px-4 py-2 text-sm">{att.min_staff_weekday}</td>
                    <td className="px-4 py-2 text-sm">{att.min_staff_weekend}</td>
                    {isSuperAdmin && (
                      <td className="px-4 py-2 text-right space-x-2">
                        <button onClick={() => startEdit(att)} className="text-blue-600 hover:text-blue-800">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(att.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
