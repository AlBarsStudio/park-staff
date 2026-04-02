import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Loader2, X } from 'lucide-react';

interface Attraction {
  id: number;
  name: string;
  min_staff_weekday: number;
  min_staff_weekend: number;
}

interface AttractionsListProps {
  isSuperAdmin: boolean;
}

export function AttractionsList({ isSuperAdmin }: AttractionsListProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWeekday, setNewWeekday] = useState(1);
  const [newWeekend, setNewWeekend] = useState(1);
  const [error, setError] = useState('');

  const fetchAttractions = async () => {
    const { data, error } = await supabase.from('attractions').select('*').order('name');
    if (!error && data) setAttractions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAttractions();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить аттракцион?')) return;
    const { error } = await supabase.from('attractions').delete().eq('id', id);
    if (error) alert('Ошибка удаления');
    else fetchAttractions();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error } = await supabase.from('attractions').insert({
      name: newName,
      min_staff_weekday: newWeekday,
      min_staff_weekend: newWeekend,
    });
    if (error) {
      setError(error.message);
    } else {
      setShowAddForm(false);
      setNewName('');
      setNewWeekday(1);
      setNewWeekend(1);
      fetchAttractions();
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Аттракционы</h2>
        {isSuperAdmin && (
          <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
            <Plus className="h-4 w-4" /> Добавить
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Новый аттракцион</h3>
              <button onClick={() => setShowAddForm(false)}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input type="text" placeholder="Название" className="w-full border p-2 rounded" value={newName} onChange={e => setNewName(e.target.value)} required />
              <input type="number" placeholder="Мин. сотрудников в будни" className="w-full border p-2 rounded" value={newWeekday} onChange={e => setNewWeekday(Number(e.target.value))} required />
              <input type="number" placeholder="Мин. сотрудников в выходные" className="w-full border p-2 rounded" value={newWeekend} onChange={e => setNewWeekend(Number(e.target.value))} required />
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <button type="submit" className="w-full bg-green-600 text-white py-2 rounded">Сохранить</button>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Название</th>
              <th className="px-4 py-3 text-left">Мин. персонал (будни)</th>
              <th className="px-4 py-3 text-left">Мин. персонал (выходные)</th>
              {isSuperAdmin && <th className="px-4 py-3 text-right">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {attractions.map(att => (
              <tr key={att.id}>
                <td className="px-4 py-2">{att.name}</td>
                <td className="px-4 py-2">{att.min_staff_weekday}</td>
                <td className="px-4 py-2">{att.min_staff_weekend}</td>
                {isSuperAdmin && (
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(att.id)} className="text-red-600">
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
