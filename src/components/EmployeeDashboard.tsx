import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLog';
import { UserProfile, Shift, Priority } from '../types';
import { getRandomGreeting } from '../utils/greetings';
import { format, isBefore, startOfDay, parseISO, addMonths, subMonths, getYear, getMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Loader2, Calendar, Star, Map, ChevronLeft, ChevronRight,
  Plus, Trash2, X, AlertCircle, Clock, FileText, MessageCircle
} from 'lucide-react';

// Временные интервалы (оставляем без изменений)
const START_TIMES = (() => {
  const times: string[] = [];
  for (let h = 10; h <= 20; h++) {
    for (let m of [0, 15, 30, 45]) {
      if (h === 20 && m > 0) continue;
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
})();

const END_TIMES = (() => {
  const times: string[] = [];
  for (let h = 12; h <= 23; h++) {
    for (let m of [0, 15, 30, 45]) {
      if (h === 23 && m > 0) continue;
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
})();

// Вспомогательные функции
function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function canDeleteShift(shift: Shift): { allowed: boolean; reason?: string } {
  const now = new Date();
  const today = startOfDay(now);
  const shiftDate = parseISO(shift.work_date);
  const shiftDay = startOfDay(shiftDate);

  if (isBefore(shiftDay, today) || shiftDay.getTime() === today.getTime()) {
    return { allowed: false, reason: 'Нельзя удалить прошедшую или текущую смену' };
  }

  const startTimeStr = shift.is_full_day ? '00:00:00' : (shift.start_time || '00:00:00');
  const shiftStart = new Date(`${shift.work_date}T${startTimeStr}`);
  const diffHours = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 22) {
    return { allowed: false, reason: 'До начала смены менее 22 часов — удаление невозможно' };
  }

  return { allowed: true };
}

function isDateActive(dateStr: string): boolean {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  if (dateStr < todayStr) return false;
  if (dateStr === todayStr && now.getHours() >= 9) return false;
  return true;
}

// Интерфейс для цели изучения
interface StudyGoal {
  id: number;
  attraction_id: number;
  change_count: number;
  attractions?: { name: string };
}

interface EmployeeDashboardProps {
  profile: UserProfile;
}

export function EmployeeDashboard({ profile }: EmployeeDashboardProps) {
  // Состояния для дат
  const [currentDate, setCurrentDate] = useState(new Date()); // текущий выбранный месяц/год
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [studyGoal, setStudyGoal] = useState<StudyGoal | null>(null);
  const [availableAttractions, setAvailableAttractions] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState('');

  // Модальное окно добавления
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [isFullDayModal, setIsFullDayModal] = useState(true);
  const [modalStartTime, setModalStartTime] = useState(START_TIMES[0]);
  const [modalEndTime, setModalEndTime] = useState(END_TIMES[0]);
  const [modalComment, setModalComment] = useState('');
  const [modalError, setModalError] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  // Модальное окно просмотра смены
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewShift, setViewShift] = useState<Shift | null>(null);

  // Состояние для выбора цели изучения
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');

  // Мобильные табы
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shifts' | 'priorities' | 'form'>('dashboard');

  // Живой пинг (оставляем как есть)
  const [ping, setPing] = useState(120);

  // Живые часы
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Пинг-эффект (оставляем)
  useEffect(() => {
    const interval = setInterval(() => {
      setPing(prev => {
        let newPing = prev + (Math.random() * 30) - 15;
        newPing = Math.min(458, Math.max(78, newPing));
        return Math.round(newPing);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Приветствие
  useEffect(() => {
    if (profile.full_name) {
      setGreeting(getRandomGreeting(profile.full_name, new Date()));
    }
  }, [profile.full_name]);

  // Загрузка данных (смены, приоритеты, цель изучения, доступные аттракционы)
  const fetchData = useCallback(async () => {
    setLoading(true);
    // Смены
    const { data: shiftData, error: shiftError } = await supabase
      .from('employee_availability')
      .select('id, employee_id, work_date, is_full_day, start_time, end_time, comment')
      .eq('employee_id', profile.id)
      .order('work_date', { ascending: true });
    if (shiftData) setShifts(shiftData as Shift[]);
    if (shiftError) console.error(shiftError);

    // Приоритеты (допуски)
    const { data: prioData, error: prioError } = await supabase
      .from('employee_attraction_priorities')
      .select('id, priority_level, attractions(name)')
      .eq('employee_id', profile.id)
      .order('priority_level', { ascending: true });
    if (prioData) setPriorities(prioData as unknown as Priority[]);
    if (prioError) console.error(prioError);

    // Цель изучения
    const { data: goalData, error: goalError } = await supabase
      .from('employee_study_goals')
      .select('id, attraction_id, change_count, attractions(name)')
      .eq('employee_id', profile.id)
      .maybeSingle();
    if (goalError && goalError.code !== 'PGRST116') console.error(goalError);
    if (goalData) {
      setStudyGoal(goalData as StudyGoal);
      setSelectedAttractionId(goalData.attraction_id);
    } else {
      setStudyGoal(null);
      setSelectedAttractionId(null);
    }

    // Загружаем список аттракционов, на которых у сотрудника нет допуска (приоритетов)
    // Сначала получаем ID аттракционов, которые уже есть в приоритетах
    const attractionIdsWithPriority = prioData?.map(p => p.attraction_id) || [];
    const { data: allAttractions, error: attractionsError } = await supabase
      .from('attractions')
      .select('id, name')
      .not('id', 'in', `(${attractionIdsWithPriority.join(',') || 0})`);
    if (attractionsError) console.error(attractionsError);
    else setAvailableAttractions(allAttractions || []);

    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Фильтрация смен по выбранному году и месяцу
  const shiftsForMonth = useMemo(() => {
    return shifts.filter(s => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
    });
  }, [shifts, currentDate]);

  // Множество занятых дат
  const occupiedDates = useMemo(() => new Set(shifts.map(s => s.work_date)), [shifts]);

  // Удаление смены
  const handleDeleteShift = async (shift: Shift) => {
    const { allowed, reason } = canDeleteShift(shift);
    if (!allowed) {
      alert(reason);
      return;
    }
    if (!confirm('Удалить смену?')) return;

    const { error } = await supabase.from('employee_availability').delete().eq('id', shift.id);
    if (!error) {
      await logActivity(
        'employee',
        profile.id,
        'shift_delete',
        `Сотрудник ${profile.full_name} удалил смену на ${shift.work_date}`
      );
      await fetchData();
      setIsViewModalOpen(false);
    } else {
      alert('Ошибка при удалении смены');
    }
  };

  // Открыть модалку добавления смены
  const openAddModal = (dateStr: string) => {
    if (occupiedDates.has(dateStr)) {
      alert('На эту дату уже установлена смена. Нажмите на смену для просмотра.');
      return;
    }
    setModalDate(dateStr);
    setIsFullDayModal(true);
    setModalStartTime(START_TIMES[0]);
    setModalEndTime(END_TIMES[0]);
    setModalComment('');
    setModalError('');
    setIsAddModalOpen(true);
  };

  // Открыть модалку просмотра смены
  const openViewModal = (shift: Shift) => {
    setViewShift(shift);
    setIsViewModalOpen(true);
  };

  // Добавление смены (с комментарием)
  const handleAddShift = async () => {
    setModalError('');
    if (!modalDate) return;

    if (!isFullDayModal && modalStartTime >= modalEndTime) {
      setModalError('Время окончания должно быть позже начала');
      return;
    }

    if (modalComment.length > 4096) {
      setModalError('Комментарий не может превышать 4096 символов');
      return;
    }

    setSavingShift(true);
    const newShift = {
      employee_id: profile.id,
      work_date: modalDate,
      is_full_day: isFullDayModal,
      start_time: isFullDayModal ? null : modalStartTime + ':00',
      end_time: isFullDayModal ? null : modalEndTime + ':00',
      comment: modalComment.trim() || null,
    };

    const { error } = await supabase.from('employee_availability').insert([newShift]);
    if (!error) {
      await logActivity(
        'employee',
        profile.id,
        'shift_add',
        `Сотрудник ${profile.full_name} добавил смену на ${modalDate}${!isFullDayModal ? ` (${modalStartTime}–${modalEndTime})` : ' (полный день)'}`
      );
      await fetchData();
      setIsAddModalOpen(false);
    } else {
      console.error(error);
      setModalError('Ошибка при добавлении смены');
    }
    setSavingShift(false);
  };

  // Сохранение цели изучения
  const handleSaveStudyGoal = async () => {
    if (!selectedAttractionId) {
      setGoalError('Выберите аттракцион');
      return;
    }
    setSavingGoal(true);
    setGoalError('');

    try {
      if (studyGoal) {
        // Обновление существующей цели
        const newChangeCount = studyGoal.change_count + 1;
        if (newChangeCount > 3) {
          setGoalError('Вы уже использовали все 3 попытки изменения цели изучения');
          setSavingGoal(false);
          return;
        }
        // Формируем историю изменений
        const currentHistory = studyGoal.change_history || [];
        const newHistory = [...currentHistory, studyGoal.attraction_id];
        const { error } = await supabase
          .from('employee_study_goals')
          .update({
            attraction_id: selectedAttractionId,
            change_count: newChangeCount,
            change_history: newHistory,
            updated_at: new Date().toISOString(),
          })
          .eq('id', studyGoal.id);
        if (error) throw error;
      } else {
        // Создание новой цели
        const { error } = await supabase
          .from('employee_study_goals')
          .insert({
            employee_id: profile.id,
            attraction_id: selectedAttractionId,
            change_count: 1,
            change_history: [],
          });
        if (error) throw error;
      }
      await fetchData(); // перезагружаем данные
      alert('Цель изучения сохранена');
    } catch (err: any) {
      console.error(err);
      setGoalError(err.message || 'Ошибка сохранения');
    } finally {
      setSavingGoal(false);
    }
  };

  // Генерация сетки дней месяца
  const renderMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const days = [];
    // Пустые ячейки для выравнивания
    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(<div key={`empty-${i}`} className="p-3"></div>);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dateObj = new Date(year, month, i);
      const isToday = dateStr === todayStr;
      const shift = shifts.find(s => s.work_date === dateStr);
      const active = isDateActive(dateStr) && !occupiedDates.has(dateStr);

      let bgClass = 'bg-white border-gray-100 shadow-sm';
      if (shift) {
        bgClass = shift.is_full_day ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300';
      } else if (!active) {
        bgClass = 'opacity-40 bg-gray-50 border-gray-100 cursor-not-allowed';
      } else {
        bgClass = 'hover:border-blue-400 hover:bg-blue-50 cursor-pointer bg-white border-gray-100';
      }

      days.push(
        <button
          key={dateStr}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition relative overflow-hidden ${bgClass}`}
          onClick={() => {
            if (shift) openViewModal(shift);
            else if (active) openAddModal(dateStr);
          }}
        >
          <span className={`text-xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'} z-10`}>{i}</span>
          <span className="text-[10px] text-gray-500 font-bold uppercase mt-1 z-10">{weekdays[dateObj.getDay()]}</span>
          {shift && (
            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${shift.is_full_day ? 'bg-green-500' : 'bg-yellow-500'}`} />
          )}
          {shift?.comment && (
            <div className="absolute bottom-1 right-1" title="Есть комментарий">
              <MessageCircle className="h-3 w-3 text-gray-400" />
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  // Таблица смен
  const renderShiftsTable = () => {
    if (shiftsForMonth.length === 0) {
      return (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-100 border-dashed text-gray-400">
          <Calendar className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p>Смен в этом месяце пока нет</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto hide-scrollbar">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Комментарий</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shiftsForMonth.map(shift => {
              const delCheck = canDeleteShift(shift);
              return (
                <tr key={shift.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => openViewModal(shift)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {format(parseISO(shift.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {shift.is_full_day ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                        Полная
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                        Неполная
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-medium whitespace-nowrap">
                    {shift.is_full_day ? 'Весь день' : `${shift.start_time?.slice(0,5)} – ${shift.end_time?.slice(0,5)}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">
                    {shift.comment ? (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {shift.comment.length > 30 ? shift.comment.slice(0, 30) + '…' : shift.comment}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {delCheck.allowed ? (
                      <button
                        onClick={() => handleDeleteShift(shift)}
                        className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-lg transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold uppercase cursor-help bg-gray-100 px-2 py-1 rounded" title={delCheck.reason}>
                        Блок
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Сводка
  const renderSummary = () => (
    <div className="space-y-2">
      <div className="flex justify-between items-center py-1.5 border-b border-blue-100/50">
        <span className="text-blue-800 text-sm font-medium">Всего смен:</span>
        <span className="font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded shadow-sm">{shiftsForMonth.length}</span>
      </div>
      <div className="flex justify-between items-center py-1.5 border-b border-blue-100/50">
        <span className="text-blue-800 text-sm font-medium flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>Полных:
        </span>
        <span className="font-bold text-blue-900">{shiftsForMonth.filter(s => s.is_full_day).length}</span>
      </div>
      <div className="flex justify-between items-center py-1.5">
        <span className="text-blue-800 text-sm font-medium flex items-center">
          <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>Неполных:
        </span>
        <span className="font-bold text-blue-900">{shiftsForMonth.filter(s => !s.is_full_day).length}</span>
      </div>
    </div>
  );

  // Приоритеты (допуски)
  const renderPriorities = () => {
    if (priorities.length === 0) {
      return (
        <div className="text-center py-6 text-gray-400">
          <Map className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Приоритеты не заданы</p>
        </div>
      );
    }
    return (
      <ul className="divide-y divide-gray-100">
        {priorities.map(prio => {
          let badgeClass = 'bg-gray-100 text-gray-800';
          if (prio.priority_level === 1) badgeClass = 'bg-green-100 text-green-800 border-green-200';
          else if (prio.priority_level === 2) badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
          else if (prio.priority_level === 3) badgeClass = 'bg-red-100 text-red-800 border-red-200';
          return (
            <li key={prio.id} className="py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800 flex items-center">
                <Map className="mr-2 h-4 w-4 text-gray-400" />
                {prio.attractions?.name || 'Неизвестный'}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border shadow-sm ${badgeClass}`}>
                #{prio.priority_level}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  // Блок цели изучения
  const renderStudyGoal = () => {
    const remainingChanges = studyGoal ? 3 - studyGoal.change_count : 3;
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Star className="mr-2 h-5 w-5 text-purple-500" />
          Цель для изучения
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Выберите аттракцион, на котором вы хотели бы научиться работать. 
          Изменить выбор можно не более 3 раз. Осталось изменений: {remainingChanges}
        </p>
        {goalError && <div className="mb-3 text-red-600 text-sm">{goalError}</div>}
        <select
          value={selectedAttractionId || ''}
          onChange={(e) => setSelectedAttractionId(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 mb-3"
          disabled={savingGoal}
        >
          <option value="">-- Выберите аттракцион --</option>
          {availableAttractions.map(attr => (
            <option key={attr.id} value={attr.id}>{attr.name}</option>
          ))}
        </select>
        <button
          onClick={handleSaveStudyGoal}
          disabled={savingGoal || !selectedAttractionId || (studyGoal && studyGoal.change_count >= 3)}
          className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {savingGoal ? <Loader2 className="animate-spin mx-auto h-5 w-5" /> : 'Сохранить цель'}
        </button>
        {studyGoal && studyGoal.change_count >= 3 && (
          <p className="text-xs text-red-500 mt-2">Лимит изменений исчерпан. Вы не можете изменить цель.</p>
        )}
      </div>
    );
  };

  // Навигация по месяцам
  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const currentMonthLabel = format(currentDate, 'LLLL yyyy', { locale: ru });

  if (loading) {
    return (
      <div className="flex justify-center items-center p-16">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 text-gray-900 font-sans pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 pt-6">
        {/* Шапка профиля (без изменений) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {greeting || profile.full_name}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {profile.full_name} • Возраст: {profile.age ?? 'Не указан'}
            </p>
          </div>
          <div className="mt-4 md:mt-0 text-right w-full md:w-auto flex flex-row md:flex-col justify-between items-center md:items-end">
            <div className="text-2xl font-mono text-blue-600 font-semibold tracking-tight">
              {now.toLocaleTimeString('ru-RU')}
            </div>
            <div className="text-gray-500 text-sm mt-1 capitalize">
              {now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Навигация по месяцам (динамическая) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-3">
            <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h3 className="text-base font-semibold text-gray-700">{currentMonthLabel}</h3>
            <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="md:grid md:grid-cols-3 md:gap-6">
          {/* Левая колонка */}
          <div className="md:col-span-2 space-y-6">
            {/* Сетка дней месяца */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-blue-500" />
                  Даты месяца — {currentMonthLabel}
                </h3>
                <div className="flex gap-3 text-xs text-gray-500 font-medium">
                  <span className="flex items-center"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-1.5"></div> Полная</span>
                  <span className="flex items-center"><div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded mr-1.5"></div> Частичная</span>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {renderMonthDays()}
              </div>
            </div>

            {/* Таблица "Мои смены" */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Calendar className="mr-2 h-5 w-5 text-blue-500" />
                Мои смены — {currentMonthLabel}
              </h3>
              {renderShiftsTable()}
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-6">
            {/* Приоритеты аттракционов */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Star className="mr-2 h-5 w-5 text-yellow-500" />
                Приоритеты аттракционов
              </h3>
              {renderPriorities()}
            </div>

            {/* Цель изучения */}
            {renderStudyGoal()}

            {/* Сводка */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Сводка — {currentMonthLabel}</h3>
              {renderSummary()}
            </div>

            {/* Google Форма */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FileText className="mr-2 h-5 w-5 text-purple-500" />
                Опрос сотрудника
              </h3>
              <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ height: '590px' }}>
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                  className="absolute top-0 left-0 w-full h-full"
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  title="Google Form"
                >
                  Загрузка…
                </iframe>
              </div>
            </div>
          </div>
        </div>

        {/* Футер с ссылкой */}
        <footer className="mt-12 mb-24 md:mb-8 text-center text-xs text-gray-400 space-y-2">
          <p>
            Hand-coded by <strong><a href="https://vk.com/albars_studio" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700">AlBars</a></strong> • Vite build: <span className="text-green-500 font-mono font-bold">{ping}</span> ms • Supabase realtime • Host: GitHub Pages • DB: PostgreSQL
          </p>
          <p>DeepSeek • Claude Sonnet 4-6 • Gemini 3.1 Pro Preview • ChatGPT • Qwen</p>
          <p className="italic">Ни один искусственный интеллект не пострадал при создании</p>
        </footer>
      </div>

      {/* Модальное окно добавления смены */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md transform transition-all relative">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-5 pr-8">Смена на {formatDateStr(modalDate)}</h3>
            {modalError && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start"><AlertCircle className="h-4 w-4 mr-2 mt-0.5" />{modalError}</div>}
            <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-lg">
              <button onClick={() => setIsFullDayModal(true)} className={`flex-1 py-2 text-sm font-bold rounded-md shadow transition ${isFullDayModal ? 'bg-white text-blue-600 ring-1 ring-black/5' : 'text-gray-500'}`}>Полная смена</button>
              <button onClick={() => setIsFullDayModal(false)} className={`flex-1 py-2 text-sm font-bold rounded-md shadow transition ${!isFullDayModal ? 'bg-white text-blue-600 ring-1 ring-black/5' : 'text-gray-500'}`}>Неполная смена</button>
            </div>
            {!isFullDayModal && (
              <div className="space-y-5">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-xs">Для создания графика работы используются алгоритмы, приоритет которых отдается всегда полной смене.</div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Начало</label><select value={modalStartTime} onChange={(e) => { setModalStartTime(e.target.value); if (e.target.value >= modalEndTime) { const newEnd = END_TIMES.find(t => t > e.target.value); if (newEnd) setModalEndTime(newEnd); } }} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm">{START_TIMES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Окончание</label><select value={modalEndTime} onChange={(e) => setModalEndTime(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm">{END_TIMES.filter(t => t > modalStartTime).map(t => <option key={t}>{t}</option>)}</select></div>
                </div>
              </div>
            )}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Комментарий для администратора (не более 4096 символов)</label>
              <textarea
                value={modalComment}
                onChange={(e) => setModalComment(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Опишите особые пожелания или причины..."
                maxLength={4096}
              />
              <p className="text-xs text-gray-400 mt-1">Внимание: после создания смены комментарий нельзя будет изменить или удалить.</p>
            </div>
            <div className="mt-8">
              <button onClick={handleAddShift} disabled={savingShift} className="w-full flex justify-center items-center py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50">
                {savingShift ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" />Добавить смену</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра смены */}
      {isViewModalOpen && viewShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md relative">
            <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Детали смены</h3>
            <div className="space-y-3">
              <p><span className="font-semibold">Дата:</span> {format(parseISO(viewShift.work_date), 'dd.MM.yyyy')}</p>
              <p><span className="font-semibold">Тип:</span> {viewShift.is_full_day ? 'Полная смена' : 'Неполная смена'}</p>
              {!viewShift.is_full_day && <p><span className="font-semibold">Время:</span> {viewShift.start_time?.slice(0,5)} – {viewShift.end_time?.slice(0,5)}</p>}
              <p><span className="font-semibold">Комментарий:</span> {viewShift.comment || '—'}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsViewModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Закрыть</button>
              {canDeleteShift(viewShift).allowed && (
                <button onClick={() => handleDeleteShift(viewShift)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Удалить смену</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Мобильное нижнее меню с условным рендерингом */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center w-1/4 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`}><Calendar className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">Сводка</span></button>
        <button onClick={() => setActiveTab('shifts')} className={`flex flex-col items-center justify-center w-1/4 ${activeTab === 'shifts' ? 'text-blue-600' : 'text-gray-400'}`}><Clock className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">Смены</span></button>
        <button onClick={() => setActiveTab('priorities')} className={`flex flex-col items-center justify-center w-1/4 ${activeTab === 'priorities' ? 'text-blue-600' : 'text-gray-400'}`}><Star className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">Приоритеты</span></button>
        <button onClick={() => setActiveTab('form')} className={`flex flex-col items-center justify-center w-1/4 ${activeTab === 'form' ? 'text-blue-600' : 'text-gray-400'}`}><FileText className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">Опрос</span></button>
      </nav>
      {/* Условный показ контента для мобильных */}
      <div className="md:hidden">
        {activeTab !== 'dashboard' && <div className="hidden">{/* контент для других вкладок уже отрисован выше, но для чистоты можно дублировать */}</div>}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
