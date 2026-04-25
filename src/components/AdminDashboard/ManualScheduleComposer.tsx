/**
 * =====================================================================
 * ManualScheduleComposer - Компонент для ручного составления графика
 * 
 * Возможности:
 * - Выбор даты в календаре
 * - Просмотр доступных сотрудников
 * - Управление работающими аттракционами
 * - Назначение сотрудников на аттракционы с учетом приоритетов
 * - Сохранение графика на выбранную дату
 * =====================================================================
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, CalendarDays, Loader2,
  AlertCircle, Gamepad2, Users, MessageSquare, Save, X,
  PlusCircle, MinusCircle, CheckCircle
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, isWeekend, getDay, isSameDay
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { dbService, Employee, Attraction, ScheduleAssignment } from '../../lib/DatabaseService';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { cn } from '../../utils/cn';
// ============================================================
// Типы
// ============================================================
interface ManualScheduleComposerProps {
  employees: Employee[];
  attractions: Attraction[];
  scheduleAssignments: ScheduleAssignment[];
  onRefreshData: () => Promise<void>;
}

interface EnrichedEmployee extends Employee {
  availability: {
    isFullDay: boolean;
    startTime: string | null;
    endTime: string | null;
    comment: string | null;
  };
  studyGoal: string | null;
}

interface AvailableEmployeesByPriority {
  priority1: EnrichedEmployee[];
  priority2: EnrichedEmployee[];
  priority3: EnrichedEmployee[];
  goals: EnrichedEmployee[];
}

// ============================================================
// Вспомогательные функции
// ============================================================
function canEditSchedule(workDate: string): boolean {
  const now = new Date();
  const date = new Date(workDate);
  const deadline = new Date(date);
  deadline.setHours(23, 0, 0, 0);
  return now < deadline;
}

// ============================================================
// Основной компонент
// ============================================================
export function ManualScheduleComposer({
  employees,
  attractions,
  scheduleAssignments,
  onRefreshData,
}: ManualScheduleComposerProps) {
  // ============================================================
  // Состояния календаря
  // ============================================================
  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // ============================================================
  // Состояния данных дня
  // ============================================================
  const [workingAttractions, setWorkingAttractions] = useState<Set<number>>(new Set());
  const [employeesForDay, setEmployeesForDay] = useState<EnrichedEmployee[]>([]);
  const [attractionAssignments, setAttractionAssignments] = useState<Map<number, number[]>>(new Map());

  // ============================================================
  // Состояния загрузки и ошибок
  // ============================================================
  const [dayDataLoading, setDayDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // Кеш данных
  // ============================================================
  const [prioritiesCache, setPrioritiesCache] = useState<any[]>([]);
  const [goalsCache, setGoalsCache] = useState<any[]>([]);

  // ============================================================
  // Модальное окно добавления
  // ============================================================
  const [showAddModal, setShowAddModal] = useState<{
    attractionId: number;
    attractionName: string;
  } | null>(null);
  const [employeeSelection, setEmployeeSelection] = useState<Set<number>>(new Set());

  // ============================================================
  // Загрузка данных для выбранного дня
  // ============================================================
  const fetchDayData = useCallback(
    async (date: Date) => {
      if (!date) return;

      setDayDataLoading(true);
      setError(null);

      try {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Получаем доступность сотрудников на эту дату
        const availData = dbService.getAvailabilityByDate(date);
        const availableEmpIds = availData.map((a) => a.employee_id);

        // Получаем цели обучения
        const allGoals = dbService.getStudyGoals();
        const goalsForDay = allGoals.filter((g) => availableEmpIds.includes(g.employee_id));
        setGoalsCache(goalsForDay);

        // Получаем приоритеты
        const allPriorities = dbService.getPriorities();
        setPrioritiesCache(allPriorities);

        // Получаем текущий график на этот день
        const daySchedule = dbService.getScheduleByDate(date);

        // Создаём карту целей обучения
        const goalsMap = new Map<number, string>();
        goalsForDay.forEach((g) => {
          const attr = attractions.find((a) => a.id === g.attraction_id);
          if (attr) goalsMap.set(g.employee_id, attr.name);
        });

        // Обогащаем данные сотрудников
        const enrichedEmployees = availData
          .map((avail) => {
            const emp = employees.find((e) => e.id === avail.employee_id);
            if (!emp) return null;

            return {
              ...emp,
              availability: {
                isFullDay: avail.is_full_day,
                startTime: avail.start_time,
                endTime: avail.end_time,
                comment: avail.comment,
              },
              studyGoal: goalsMap.get(avail.employee_id) || null,
            } as EnrichedEmployee;
          })
          .filter((emp): emp is EnrichedEmployee => emp !== null)
          .sort((a, b) => a.full_name.localeCompare(b.full_name));

        setEmployeesForDay(enrichedEmployees);

        // Формируем данные о работающих аттракционах и назначениях
        const workingAttrSet = new Set<number>();
        const assignMap = new Map<number, number[]>();

        daySchedule.forEach((assignment) => {
          workingAttrSet.add(assignment.attraction_id);
          const list = assignMap.get(assignment.attraction_id) || [];
          list.push(assignment.employee_id);
          assignMap.set(assignment.attraction_id, list);
        });

        setWorkingAttractions(workingAttrSet);
        setAttractionAssignments(assignMap);
      } catch (err: any) {
        console.error('[ManualScheduleComposer] Ошибка загрузки данных дня:', err);
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setDayDataLoading(false);
      }
    },
    [employees, attractions]
  );

  // ============================================================
  // Обработчики
  // ============================================================
  const handleDaySelect = (day: Date) => {
    setSelectedDay(day);
    fetchDayData(day);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setMonth((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const toggleAttractionWorking = (attractionId: number) => {
    setWorkingAttractions((prev) => {
      const next = new Set(prev);
      if (next.has(attractionId)) {
        next.delete(attractionId);
        // Удаляем назначения при выключении аттракциона
        setAttractionAssignments((prevAssign) => {
          const newAssign = new Map(prevAssign);
          newAssign.delete(attractionId);
          return newAssign;
        });
      } else {
        next.add(attractionId);
      }
      return next;
    });
  };

  const handleAddEmployeesToAttraction = (attractionId: number, employeeIds: number[]) => {
    setAttractionAssignments((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(attractionId) || [];
      const combined = [...new Set([...existing, ...employeeIds])];
      newMap.set(attractionId, combined);
      return newMap;
    });
    setShowAddModal(null);
    setEmployeeSelection(new Set());
  };

  const removeEmployeeFromAttraction = (attractionId: number, employeeId: number) => {
    setAttractionAssignments((prev) => {
      const newMap = new Map(prev);
      const list = newMap.get(attractionId) || [];
      const filtered = list.filter((id) => id !== employeeId);
      
      if (filtered.length === 0) {
        newMap.delete(attractionId);
      } else {
        newMap.set(attractionId, filtered);
      }
      
      return newMap;
    });
  };

  const getAvailableEmployeesForAttraction = (attractionId: number): AvailableEmployeesByPriority => {
    // Получаем уже назначенных сотрудников
    const assignedEmployeeIds = new Set<number>();
    attractionAssignments.forEach((ids) => ids.forEach((id) => assignedEmployeeIds.add(id)));

    // Фильтруем доступных
    const available = employeesForDay.filter((emp) => !assignedEmployeeIds.has(emp.id));

    // Группируем по приоритетам
    const priorityMap = new Map<number, number[]>();
    prioritiesCache.forEach((p) => {
      if (p.attraction_ids && Array.isArray(p.attraction_ids) && p.attraction_ids.includes(attractionId)) {
        const list = priorityMap.get(p.priority_level) || [];
        list.push(p.employee_id);
        priorityMap.set(p.priority_level, list);
      }
    });

    // Получаем сотрудников с целью обучения на этом аттракционе
    const goalEmployeeIds = goalsCache
      .filter((g) => g.attraction_id === attractionId)
      .map((g) => g.employee_id);

    const getEmpsByIds = (ids: number[]) => {
      return available.filter((emp) => ids.includes(emp.id));
    };

    return {
      priority1: getEmpsByIds(priorityMap.get(1) || []),
      priority2: getEmpsByIds(priorityMap.get(2) || []),
      priority3: getEmpsByIds(priorityMap.get(3) || []),
      goals: getEmpsByIds(goalEmployeeIds),
    };
  };

  const handleSaveSchedule = async () => {
    if (!selectedDay) {
      setError('Выберите день для сохранения');
      return;
    }

    const dateStr = format(selectedDay, 'yyyy-MM-dd');

    if (!canEditSchedule(dateStr)) {
      setError('Редактирование невозможно: прошло 23:00 предыдущего дня');
      return;
    }

    if (!confirm(`Сохранить график на ${format(selectedDay, 'dd.MM.yyyy', { locale: ru })}?`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const assignmentsToInsert: Array<{
        employee_id: number;
        attraction_id: number;
        work_date: string;
        start_time: string;
        end_time: string | null;
      }> = [];

      // Формируем назначения
      attractionAssignments.forEach((employeeIds, attractionId) => {
        employeeIds.forEach((empId) => {
          const empAvail = employeesForDay.find((e) => e.id === empId);
          let startTime = '10:00';
          let endTime = '22:00';

          if (empAvail && !empAvail.availability.isFullDay) {
            startTime = empAvail.availability.startTime || '10:00';
            endTime = empAvail.availability.endTime || '22:00';
          }

          assignmentsToInsert.push({
            employee_id: empId,
            attraction_id: attractionId,
            work_date: dateStr,
            start_time: startTime,
            end_time: endTime,
          });
        });
      });

      // Удаляем старый график на эту дату
      await dbService.deleteScheduleByDate(dateStr);

      // Создаём новые назначения
      if (assignmentsToInsert.length > 0) {
        const success = await dbService.bulkCreateScheduleAssignments(assignmentsToInsert);
        if (!success) {
          throw new Error('Ошибка сохранения графика');
        }
      }

      // Обновляем данные
      await onRefreshData();
      
      // Перезагружаем данные дня
      fetchDayData(selectedDay);

      alert('График успешно сохранён!');
    } catch (err: any) {
      console.error('[ManualScheduleComposer] Ошибка сохранения:', err);
      setError(err.message || 'Ошибка сохранения графика');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Вычисления
  // ============================================================
  const monthDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const dayHasSchedule = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return scheduleAssignments.some((a) => a.work_date === dateStr);
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========================================== */}
        {/* Календарь */}
        {/* ========================================== */}
        <Card className="lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            Выбор даты
          </h3>

          {/* Навигация по месяцам */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange('prev')}
              icon={<ChevronLeft className="h-5 w-5" />}
            />
            <span className="font-medium text-lg capitalize" style={{ color: 'var(--text)' }}>
              {format(month, 'LLLL yyyy', { locale: ru })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMonthChange('next')}
              icon={<ChevronRight className="h-5 w-5" />}
            />
          </div>

          {/* Заголовки дней недели */}
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
              <div key={day} className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Сетка календаря */}
          <div className="grid grid-cols-7 gap-1">
            {/* Пустые ячейки до первого дня месяца */}
            {Array.from({ length: (getDay(startOfMonth(month)) + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {/* Дни месяца */}
            {monthDays.map((day) => {
              const isWeekendDay = isWeekend(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const hasSchedule = dayHasSchedule(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDaySelect(day)}
                  className={cn(
                    'h-10 rounded-lg flex items-center justify-center relative transition text-sm font-medium',
                    isSelected && 'ring-2',
                  )}
                  style={{
                    backgroundColor: isWeekendDay ? 'var(--error-light)' : 'var(--bg-tertiary)',
                    color: isWeekendDay ? 'var(--error)' : 'var(--text)',
                    borderColor: isSelected ? 'var(--primary)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = isWeekendDay ? '#fecaca' : 'var(--border-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = isWeekendDay ? 'var(--error-light)' : 'var(--bg-tertiary)';
                    }
                  }}
                >
                  <span>{format(day, 'd')}</span>
                  {hasSchedule && (
                    <CheckCircle 
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full" 
                      style={{ 
                        color: 'var(--success)',
                        backgroundColor: 'var(--surface)'
                      }} 
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Легенда */}
          <div className="mt-4 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} /> 
            — график составлен
          </div>
        </Card>

        {/* ========================================== */}
        {/* Рабочая область */}
        {/* ========================================== */}
        <div className="lg:col-span-2">
          {!selectedDay ? (
            <Card className="text-center p-8">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--text-subtle)' }} />
              <p style={{ color: 'var(--text-subtle)' }}>Выберите день для составления графика</p>
            </Card>
          ) : dayDataLoading ? (
            <Card className="p-8 flex justify-center">
              <Loader2 className="animate-spin h-8 w-8" style={{ color: 'var(--primary)' }} />
            </Card>
          ) : (
            <Card className="space-y-6">
              {/* Заголовок и кнопка сохранения */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                  График на {format(selectedDay, 'd MMMM yyyy', { locale: ru })}
                </h3>
                <Button
                  variant="success"
                  onClick={handleSaveSchedule}
                  loading={saving}
                  icon={<Save className="h-4 w-4" />}
                >
                  Сохранить график
                </Button>
              </div>

              {/* Ошибки */}
              {error && (
                <div 
                  className="p-3 rounded-lg text-sm flex items-start gap-2" 
                  style={{ 
                    backgroundColor: 'var(--error-light)',
                    color: 'var(--error)'
                  }}
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Работающие аттракционы */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Gamepad2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  Работающие аттракционы
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {attractions.map((attr) => (
                    <label
                      key={attr.id}
                      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition"
                      style={{ border: '1px solid var(--border)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={workingAttractions.has(attr.id)}
                        onChange={() => toggleAttractionWorking(attr.id)}
                        className="rounded focus:ring-2"
                        style={{ 
                          accentColor: 'var(--primary)',
                        }}
                      />
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{attr.name}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-subtle)' }}>
                        x{attr.coefficient}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Доступные сотрудники */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Users className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  Доступные сотрудники ({employeesForDay.length})
                </h4>
                {employeesForDay.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    Нет сотрудников с доступностью на эту дату
                  </p>
                ) : (
                  <div 
                    className="max-h-60 overflow-y-auto rounded-lg divide-y" 
                    style={{ 
                      border: '1px solid var(--border)',
                      borderColor: 'var(--border)'
                    }}
                  >
                    {employeesForDay.map((emp) => (
                      <div 
                        key={emp.id} 
                        className="p-3 transition"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-medium" style={{ color: 'var(--text)' }}>
                              {emp.full_name}
                            </span>
                            {emp.studyGoal && (
                              <Badge variant="info" className="ml-2">
                                Цель: {emp.studyGoal}
                              </Badge>
                            )}
                            {!emp.availability.isFullDay && (
                              <Badge variant="warning" className="ml-2">
                                {emp.availability.startTime?.slice(0, 5)}-
                                {emp.availability.endTime?.slice(0, 5)}
                              </Badge>
                            )}
                          </div>
                          {emp.availability.comment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => alert(emp.availability.comment)}
                              icon={<MessageSquare className="h-4 w-4" />}
                              title="Просмотреть комментарий"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Назначения на аттракционы */}
              <div className="space-y-4">
                <h4 className="font-medium" style={{ color: 'var(--text)' }}>
                  Назначения на аттракционы
                </h4>
                {Array.from(workingAttractions).length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    Выберите работающие аттракционы
                  </p>
                ) : (
                  Array.from(workingAttractions).map((attrId) => {
                    const attr = attractions.find((a) => a.id === attrId);
                    if (!attr) return null;

                    const assignedIds = attractionAssignments.get(attrId) || [];
                    const assignedEmployees = employeesForDay.filter((e) =>
                      assignedIds.includes(e.id)
                    );

                    return (
                      <div 
                        key={attrId} 
                        className="rounded-lg p-3" 
                        style={{ border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium" style={{ color: 'var(--text)' }}>
                            {attr.name}
                          </h5>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setShowAddModal({
                                attractionId: attrId,
                                attractionName: attr.name,
                              })
                            }
                            icon={<PlusCircle className="h-4 w-4" />}
                          >
                            Добавить
                          </Button>
                        </div>

                        {assignedEmployees.length === 0 ? (
                          <p className="text-sm py-2" style={{ color: 'var(--text-subtle)' }}>
                            Нет назначений
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {assignedEmployees.map((emp) => (
                              <div
                                key={emp.id}
                                className="flex items-center justify-between p-2 rounded"
                                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                              >
                                <span className="text-sm" style={{ color: 'var(--text)' }}>
                                  {emp.full_name}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeEmployeeFromAttraction(attrId, emp.id)}
                                  icon={<MinusCircle className="h-4 w-4" style={{ color: 'var(--error)' }} />}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* Модальное окно добавления сотрудников */}
      {/* ========================================== */}
      <Modal
        isOpen={!!showAddModal}
        onClose={() => {
          setShowAddModal(null);
          setEmployeeSelection(new Set());
        }}
        title={showAddModal ? `Добавить сотрудников на «${showAddModal.attractionName}»` : ''}
        size="lg"
      >
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {showAddModal && (() => {
            const available = getAvailableEmployeesForAttraction(showAddModal.attractionId);
            const allEmpty =
              !available.priority1.length &&
              !available.priority2.length &&
              !available.priority3.length &&
              !available.goals.length;

            if (allEmpty) {
              return (
                <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  Нет доступных сотрудников для назначения
                </p>
              );
            }

            const renderEmployeeList = (title: string, employees: EnrichedEmployee[], variant: 'success' | 'info' | 'neutral' | 'warning') => {
              if (employees.length === 0) return null;

              return (
                <div className="mb-4">
                  <Badge variant={variant} className="mb-2">{title}</Badge>
                  <div className="space-y-1">
                    {employees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 p-2 rounded cursor-pointer transition"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={employeeSelection.has(emp.id)}
                          onChange={(e) => {
                            const newSet = new Set(employeeSelection);
                            e.target.checked ? newSet.add(emp.id) : newSet.delete(emp.id);
                            setEmployeeSelection(newSet);
                          }}
                          className="rounded focus:ring-2"
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ color: 'var(--text)' }}>{emp.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-4">
                {renderEmployeeList('Приоритет 1', available.priority1, 'success')}
                {renderEmployeeList('Приоритет 2', available.priority2, 'info')}
                {renderEmployeeList('Приоритет 3', available.priority3, 'neutral')}
                {renderEmployeeList('Цель обучения', available.goals, 'warning')}
              </div>
            );
          })()}
        </div>

        <div className="p-4 border-t flex justify-end gap-3" style={{ 
          backgroundColor: 'var(--bg-tertiary)',
          borderColor: 'var(--border)'
        }}>
          <Button
            variant="secondary"
            onClick={() => {
              setShowAddModal(null);
              setEmployeeSelection(new Set());
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={() => {
              const selectedIds = Array.from(employeeSelection);
              if (selectedIds.length > 0 && showAddModal) {
                handleAddEmployeesToAttraction(showAddModal.attractionId, selectedIds);
              }
            }}
            disabled={employeeSelection.size === 0}
          >
            Добавить ({employeeSelection.size})
          </Button>
        </div>
      </Modal>
    </div>
  );
}
