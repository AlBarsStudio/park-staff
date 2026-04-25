/**
 * AdminEmployeePriorities — обёртка над EmployeePriorities для AdminDashboard.
 * Переводит стили на CSS-переменные для единообразия.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, X, Save, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';

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
  { level: 1, label: '1 уровень (высший)', variant: 'error' as const },
  { level: 2, label: '2 уровень (средний)', variant: 'warning' as const },
  { level: 3, label: '3 уровень (низший)', variant: 'success' as const },
];

export function AdminEmployeePriorities() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [priorities, setPriorities] = useState<PriorityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState<{ level: number } | null>(null);
  const [selectedInModal, setSelectedInModal] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ============================================================
  // Загрузка данных
  // ============================================================
  useEffect(() => {
    const fetchData = async () => {
      const [empRes, attrRes] = await Promise.all([
        supabase.from('employees').select('id, full_name').order('full_name'),
        supabase.from('attractions').select('id, name').order('name'),
      ]);
      if (!empRes.error && empRes.data) setEmployees(empRes.data);
      if (!attrRes.error && attrRes.data) setAttractions(attrRes.data);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedEmployee) {
      setPriorities([]);
      return;
    }

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
        const filled: PriorityData[] = [1, 2, 3].map((level) => {
          const found = existing.find((p: any) => p.priority_level === level);
          return (
            found || {
              employee_id: selectedEmployee,
              priority_level: level,
              attraction_ids: [],
            }
          );
        });
        setPriorities(filled);
      }

      setLoading(false);
    };

    fetchPriorities();
  }, [selectedEmployee]);

  // ============================================================
  // Вспомогательные функции
  // ============================================================
  const getAllSelectedAttractionIds = () =>
    priorities.flatMap((p) => p.attraction_ids);

  const getAvailableAttractions = () => {
    const selectedIds = getAllSelectedAttractionIds();
    return attractions.filter((a) => !selectedIds.includes(a.id));
  };

  const openModal = (level: number) => {
    const current = priorities.find((p) => p.priority_level === level);
    setSelectedInModal(current?.attraction_ids || []);
    setModalOpen({ level });
  };

  const closeModal = () => {
    setModalOpen(null);
    setSelectedInModal([]);
  };

  const handleModalSave = () => {
    if (!modalOpen) return;
    setPriorities((prev) =>
      prev.map((p) =>
        p.priority_level === modalOpen.level
          ? { ...p, attraction_ids: selectedInModal }
          : p
      )
    );
    closeModal();
  };

  const removeAttractionFromLevel = (level: number, attractionId: number) => {
    setPriorities((prev) =>
      prev.map((p) =>
        p.priority_level === level
          ? { ...p, attraction_ids: p.attraction_ids.filter((id) => id !== attractionId) }
          : p
      )
    );
  };

  // ============================================================
  // Сохранение
  // ============================================================
  const handleSaveAll = async () => {
    if (!selectedEmployee) return setError('Выберите сотрудника');

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: deleteError } = await supabase
        .from('employee_attraction_priorities')
        .delete()
        .eq('employee_id', selectedEmployee);

      if (deleteError) throw deleteError;

      const toInsert = priorities.filter((p) => p.attraction_ids.length > 0);
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('employee_attraction_priorities')
          .insert(
            toInsert.map((p) => ({
              employee_id: p.employee_id,
              priority_level: p.priority_level,
              attraction_ids: p.attraction_ids,
            }))
          );
        if (insertError) throw insertError;
      }

      setSuccessMessage('Приоритеты успешно сохранены');

      const { data } = await supabase
        .from('employee_attraction_priorities')
        .select('*')
        .eq('employee_id', selectedEmployee);

      if (data) {
        const filled: PriorityData[] = [1, 2, 3].map((level) => {
          const found = data.find((p: any) => p.priority_level === level);
          return (
            found || {
              employee_id: selectedEmployee,
              priority_level: level,
              attraction_ids: [],
            }
          );
        });
        setPriorities(filled);
      }
    } catch (err: any) {
      setError('Ошибка сохранения: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Рендер уровня
  // ============================================================
  const renderLevelCard = (priority: PriorityData) => {
    const levelInfo = LEVELS.find((l) => l.level === priority.priority_level)!;
    const selectedAttractions = attractions.filter((a) =>
      priority.attraction_ids.includes(a.id)
    );

    return (
      <Card key={priority.priority_level} padding="md">
        <div className="flex items-center justify-between mb-3">
          <Badge variant={levelInfo.variant}>{levelInfo.label}</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openModal(priority.priority_level)}
            icon={<Plus className="h-4 w-4" />}
          >
            Добавить
          </Button>
        </div>

        {selectedAttractions.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            Нет выбранных аттракционов
          </p>
        ) : (
          <ul className="space-y-1">
            {selectedAttractions.map((attr) => (
              <li
                key={attr.id}
                className="flex items-center justify-between text-sm p-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <span style={{ color: 'var(--text)' }}>{attr.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttractionFromLevel(priority.priority_level, attr.id)}
                  icon={<X className="h-4 w-4" style={{ color: 'var(--error)' }} />}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Приоритеты аттракционов
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Настройка приоритетов назначения сотрудников на аттракционы
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          variant="success"
          loading={saving}
          disabled={!selectedEmployee}
          icon={<Save className="h-4 w-4" />}
        >
          Сохранить
        </Button>
      </div>

      {/* Выбор сотрудника */}
      <Card padding="md">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          Сотрудник
        </label>
        <select
          value={selectedEmployee || ''}
          onChange={(e) =>
            setSelectedEmployee(e.target.value ? Number(e.target.value) : null)
          }
          className="input w-full max-w-md"
        >
          <option value="">-- Выберите сотрудника --</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>
      </Card>

      {/* Сообщения */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            border: '1px solid var(--error)',
          }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMessage && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            border: '1px solid var(--success)',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Карточки уровней */}
      {selectedEmployee ? (
        loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {priorities.map((p) => renderLevelCard(p))}
          </div>
        )
      ) : (
        <Card padding="lg" className="text-center">
          <p style={{ color: 'var(--text-muted)' }}>
            Выберите сотрудника для настройки приоритетов
          </p>
        </Card>
      )}

      {/* Модальное окно выбора аттракционов */}
      <Modal
        isOpen={!!modalOpen}
        onClose={closeModal}
        title={
          modalOpen
            ? `Выберите аттракционы для ${LEVELS.find((l) => l.level === modalOpen.level)?.label}`
            : ''
        }
        size="lg"
      >
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {getAvailableAttractions().length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Все аттракционы уже распределены по уровням
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getAvailableAttractions().map((attr) => (
                <label
                  key={attr.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedInModal.includes(attr.id)}
                    onChange={() => {
                      setSelectedInModal((prev) =>
                        prev.includes(attr.id)
                          ? prev.filter((x) => x !== attr.id)
                          : [...prev, attr.id]
                      );
                    }}
                    className="rounded"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>
                    {attr.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div
          className="p-4 border-t flex justify-end gap-3"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderColor: 'var(--border)',
          }}
        >
          <Button variant="secondary" onClick={closeModal}>
            Отмена
          </Button>
          <Button onClick={handleModalSave}>Применить</Button>
        </div>
      </Modal>
    </div>
  );
}
