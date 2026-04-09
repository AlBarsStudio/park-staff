// EmployeePriorities.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, X, Save, AlertCircle, Star } from 'lucide-react';

interface Employee {
  id: number;
  full_name: string;
}

interface Attraction {
  id: number;
  name: string;
}

interface PriorityData {
  id?: number;
  employee_id: number;
  priority_level: number;
  attraction_ids: number[];
}

const LEVELS = [
  { level: 1, label: '1 уровень (высший)', color: 'border-red-200 bg-red-50' },
  { level: 2, label: '2 уровень (средний)', color: 'border-yellow-200 bg-yellow-50' },
  { level: 3, label: '3 уровень (низший)', color: 'border-green-200 bg-green-50' },
];

// Используем именованный экспорт
export const EmployeePriorities = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [priorities, setPriorities] = useState<PriorityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState<{ level: number; show: boolean } | null>(null);
  const [selectedInModal, setSelectedInModal] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Загрузка списка сотрудников
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .order('full_name');
      if (!error && data) setEmployees(data);
    };
    const fetchAttractions = async () => {
      const { data, error } = await supabase
        .from('attractions')
        .select('id, name')
        .order('name');
      if (!error && data) setAttractions(data);
    };
    fetchEmployees();
    fetchAttractions();
  }, []);

  // При смене сотрудника загружаем его приоритеты
  useEffect(() => {
    if (selectedEmployee) {
      const fetchPriorities = async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from('employee_attraction_priorities')
          .select('*')
          .eq('employee_id', selectedEmployee);
        if (error) {
          setError('Ошибка загрузки приоритетов: ' + error.message);
        } else {
          const existing = data || [];
          const filled: PriorityData[] = [];
          for (const level of [1, 2, 3]) {
            const found = existing.find((p: any) => p.priority_level === level);
            filled.push(
              found || {
                employee_id: selectedEmployee,
                priority_level: level,
                attraction_ids: [],
              }
            );
          }
          setPriorities(filled);
        }
        setLoading(false);
      };
      fetchPriorities();
    } else {
      setPriorities([]);
    }
  }, [selectedEmployee]);

  const getAllSelectedAttractionIds = (): number[] => {
    return priorities.flatMap(p => p.attraction_ids);
  };

  const getAvailableAttractions = (currentLevel: number): Attraction[] => {
    const selectedIds = getAllSelectedAttractionIds();
    return attractions.filter(a => !selectedIds.includes(a.id));
  };

  const openModal = (level: number) => {
    const current = priorities.find(p => p.priority_level === level);
    setSelectedInModal(current ? current.attraction_ids : []);
    setModalOpen({ level, show: true });
  };

  const closeModal = () => {
    setModalOpen(null);
    setSelectedInModal([]);
  };

  const handleModalSave = () => {
    if (!modalOpen) return;
    const { level } = modalOpen;
    setPriorities(prev =>
      prev.map(p =>
        p.priority_level === level ? { ...p, attraction_ids: selectedInModal } : p
      )
    );
    closeModal();
  };

  const removeAttractionFromLevel = (level: number, attractionId: number) => {
    setPriorities(prev =>
      prev.map(p =>
        p.priority_level === level
          ? { ...p, attraction_ids: p.attraction_ids.filter(id => id !== attractionId) }
          : p
      )
    );
  };

  const handleSaveAll = async () => {
    if (!selectedEmployee) {
      setError('Выберите сотрудника');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Удаляем старые записи
      const { error: deleteError } = await supabase
        .from('employee_attraction_priorities')
        .delete()
        .eq('employee_id', selectedEmployee);
      if (deleteError) throw deleteError;

      // Вставляем новые
      const toInsert = priorities.filter(p => p.attraction_ids.length > 0);
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('employee_attraction_priorities')
          .insert(
            toInsert.map(p => ({
              employee_id: p.employee_id,
              priority_level: p.priority_level,
              attraction_ids: p.attraction_ids,
            }))
          );
        if (insertError) throw insertError;
      }

      setSuccessMessage('Приоритеты успешно сохранены');
      // Обновляем данные
      const { data } = await supabase
        .from('employee_attraction_priorities')
        .select('*')
        .eq('employee_id', selectedEmployee);
      if (data) {
        const filled: PriorityData[] = [];
        for (const level of [1, 2, 3]) {
          const found = data.find((p: any) => p.priority_level === level);
          filled.push(
            found || {
              employee_id: selectedEmployee,
              priority_level: level,
              attraction_ids: [],
            }
          );
        }
        setPriorities(filled);
      }
    } catch (err: any) {
      setError('Ошибка сохранения: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderLevelCard = (priority: PriorityData) => {
    const levelInfo = LEVELS.find(l => l.level === priority.priority_level)!;
    const selectedAttractions = attractions.filter(a =>
      priority.attraction_ids.includes(a.id)
    );

    return (
      <div key={priority.priority_level} className={`border rounded-xl p-4 ${levelInfo.color}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-800">{levelInfo.label}</h4>
          <button
            onClick={() => openModal(priority.priority_level)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>

        {selectedAttractions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Нет выбранных аттракционов</p>
        ) : (
          <ul className="space-y-1">
            {selectedAttractions.map(attr => (
              <li
                key={attr.id}
                className="flex items-center justify-between text-sm bg-white/70 rounded px-2 py-1"
              >
                <span>{attr.name}</span>
                <button
                  onClick={() => removeAttractionFromLevel(priority.priority_level, attr.id)}
                  className="text-gray-400 hover:text-red-600"
                  title="Удалить"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderModal = () => {
    if (!modalOpen) return null;
    const { level } = modalOpen;
    const available = getAvailableAttractions(level);
    const currentIds = selectedInModal;

    const toggleAttraction = (id: number) => {
      setSelectedInModal(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              Выберите аттракционы для {LEVELS.find(l => l.level === level)?.label}
            </h3>
            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {available.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Все аттракционы уже распределены по уровням
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {available.map(attr => (
                  <label
                    key={attr.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={currentIds.includes(attr.id)}
                      onChange={() => toggleAttraction(attr.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{attr.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Отмена
            </button>
            <button
              onClick={handleModalSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Применить
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Приоритеты аттракционов сотрудников</h2>
        <button
          onClick={handleSaveAll}
          disabled={!selectedEmployee || saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить
        </button>
      </div>

      {/* Выбор сотрудника */}
      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-1">Сотрудник</label>
        <select
          value={selectedEmployee || ''}
          onChange={e => setSelectedEmployee(e.target.value ? Number(e.target.value) : null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Выберите сотрудника --</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Сообщения */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* Карточки уровней */}
      {selectedEmployee &&
        (loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {priorities.map(p => renderLevelCard(p))}
          </div>
        ))}

      {!selectedEmployee && (
        <div className="text-center py-16 text-gray-500">
          Выберите сотрудника для настройки приоритетов
        </div>
      )}

      {renderModal()}
    </div>
  );
};
