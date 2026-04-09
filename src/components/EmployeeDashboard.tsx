import { useState, useEffect, useMemo } from 'react';
import { 
  initializeEmployeeData, 
  getEmployeeDataManager, 
  destroyEmployeeData,
  type EmployeeDataManager,
  type Employee,
  type Attraction,
  type EmployeeAvailability,
  type ScheduleAssignment,
  type ActualWorkLog,
  type EmployeeStudyGoal,
  type EmployeeAttractionPriority
} from '../lib/employeeDatabase';
import { getRandomGreeting } from '../utils/greetings';
import { format, parseISO, addMonths, subMonths, startOfDay, differenceInMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Loader2, Calendar, Star, ChevronLeft, ChevronRight,
  Trash2, X, Clock, FileText, MessageCircle,
  CheckCircle, DollarSign, Map
} from 'lucide-react';

// ======================== ТИПЫ ========================
interface EmployeeDashboardProps {
  profile: Employee;
}

interface SalaryDay {
  date: string;
  attractions: Array<{
    name: string;
    hours: number;
    rate: number;
    coefficient: number;
    earn: number;
  }>;
  total: number;
}

// ======================== УТИЛИТЫ ========================
function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

// ======================== ОСНОВНОЙ КОМПОНЕНТ ========================
export function EmployeeDashboard({ profile }: EmployeeDashboardProps) {
  // ========== STATE ==========
  const [dataManager, setDataManager] = useState<EmployeeDataManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [ping, setPing] = useState(120);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shifts' | 'priorities' | 'form' | 'salary'>('dashboard');

  // Данные из менеджера (обновляются при изменениях)
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  // Модалки - Добавление смены
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [isFullDayModal, setIsFullDayModal] = useState(true);
  const [modalStartTime, setModalStartTime] = useState('10:00');
  const [modalEndTime, setModalEndTime] = useState('22:00');
  const [modalComment, setModalComment] = useState('');
  const [modalError, setModalError] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  // Модалка - Просмотр смены
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewShift, setViewShift] = useState<EmployeeAvailability | null>(null);

  // Модалка - Отметка фактического времени
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleAssignment | null>(null);
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [timeLogError, setTimeLogError] = useState('');
  const [savingTimeLog, setSavingTimeLog] = useState(false);

  // Цель обучения
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');

  // Зарплата
  const [salaryPeriod, setSalaryPeriod] = useState<'first' | 'second'>('first');
  const [salaryData, setSalaryData] = useState<{ days: SalaryDay[]; total: number } | null>(null);
  const [loadingSalary, setLoadingSalary] = useState(false);

  // ========== КОНСТАНТЫ ==========
  const START_TIMES = useMemo(() => {
    const times: string[] = [];
    for (let h = 10; h <= 20; h++) {
      for (let m of [0, 15, 30, 45]) {
        if (h === 20 && m > 0) continue;
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return times;
  }, []);

  const END_TIMES = useMemo(() => {
    const times: string[] = [];
    for (let h = 12; h <= 23; h++) {
      for (let m of [0, 15, 30, 45]) {
        if (h === 23 && m > 0) continue;
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return times;
  }, []);

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  useEffect(() => {
    async function init() {
      try {
        const manager = await initializeEmployeeData(profile.id);
        setDataManager(manager);
        
        // Устанавливаем цель обучения, если есть
        const studyGoal = manager.getStudyGoal();
        if (studyGoal) {
          setSelectedAttractionId(studyGoal.attraction_id);
        }
      } catch (error) {
        console.error('Ошибка инициализации:', error);
        alert('Ошибка загрузки данных. Перезагрузите страницу.');
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      destroyEmployeeData();
    };
  }, [profile.id]);

  // ========== ТАЙМЕРЫ ==========
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (profile.full_name) {
      setGreeting(getRandomGreeting(profile.full_name, new Date()));
    }
  }, [profile.full_name]);

  // Подписка на обновления данных
  useEffect(() => {
    if (!dataManager) return;

    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [dataManager]);

  // ========== ПОЛУЧЕНИЕ ДАННЫХ ИЗ МЕНЕДЖЕРА ==========
  const attractions = useMemo(() => 
    dataManager?.getAttractions() || [], 
    [dataManager, updateTrigger]
  );

  const allAvailability = useMemo(() => 
    dataManager?.getAvailability() || [], 
    [dataManager, updateTrigger]
  );

  const allSchedules = useMemo(() => 
    dataManager?.getScheduleAssignments() || [], 
    [dataManager, updateTrigger]
  );

  const actualLogs = useMemo(() => 
    dataManager?.getActualWorkLogs() || [], 
    [dataManager, updateTrigger]
  );

  const studyGoal = useMemo(() => 
    dataManager?.getStudyGoal() || null, 
    [dataManager, updateTrigger]
  );

  const priorities = useMemo(() => 
    dataManager?.getPriorities() || [], 
    [dataManager, updateTrigger]
  );

  const availableAttractions = useMemo(() => {
    if (!dataManager) return [];
    
    let available = dataManager.getAvailableAttractions();
    
    // Добавляем текущую цель, если она есть
    if (studyGoal && studyGoal.attraction_id) {
      const alreadyInList = available.some(a => a.id === studyGoal.attraction_id);
      if (!alreadyInList) {
        const currentGoalAttraction = attractions.find(a => a.id === studyGoal.attraction_id);
        if (currentGoalAttraction) {
          available = [currentGoalAttraction, ...available];
        }
      }
    }
    
    return available;
  }, [dataManager, studyGoal, attractions, updateTrigger]);

  // ========== ФИЛЬТРАЦИЯ ПО МЕСЯЦУ ==========
  const shiftsForMonth = useMemo(() => {
    return allAvailability.filter(s => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth();
    });
  }, [allAvailability, currentDate]);

  const scheduleForMonth = useMemo(() => {
    return allSchedules.filter(s => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth();
    });
  }, [allSchedules, currentDate]);

  const occupiedDates = useMemo(() => 
    new Set(allAvailability.map(s => s.work_date)), 
    [allAvailability]
  );

  // ========== ОБРАБОТЧИКИ - СМЕНЫ ДОСТУПНОСТИ ==========
  const openAddModal = (dateStr: string) => {
    if (!dataManager) return;
    
    if (occupiedDates.has(dateStr)) {
      alert('На эту дату уже установлена смена. Нажмите на смену для просмотра.');
      return;
    }

    if (!dataManager.isDateActive(dateStr)) {
      alert('Нельзя добавить смену на эту дату');
      return;
    }

    setModalDate(dateStr);
    setIsFullDayModal(true);
    setModalStartTime(START_TIMES[0]);
    setModalEndTime(END_TIMES[END_TIMES.length - 1]);
    setModalComment('');
    setModalError('');
    setIsAddModalOpen(true);
  };

  const openViewModal = (shift: EmployeeAvailability) => {
    setViewShift(shift);
    setIsViewModalOpen(true);
  };

  const handleAddShift = async () => {
    if (!dataManager) return;
    
    setModalError('');
    
    if (!modalDate) {
      setModalError('Выберите дату');
      return;
    }

    if (!isFullDayModal && modalStartTime >= modalEndTime) {
      setModalError('Время окончания должно быть позже начала');
      return;
    }

    if (modalComment.length > 4096) {
      setModalError('Комментарий не более 4096 символов');
      return;
    }

    setSavingShift(true);

    const result = await dataManager.addAvailability({
      work_date: modalDate,
      is_full_day: isFullDayModal,
      start_time: isFullDayModal ? undefined : modalStartTime + ':00',
      end_time: isFullDayModal ? undefined : modalEndTime + ':00',
      comment: modalComment.trim() || undefined,
    });

    if (result.success) {
      setIsAddModalOpen(false);
      setUpdateTrigger(prev => prev + 1);
    } else {
      setModalError(result.error || 'Ошибка при добавлении смены');
    }

    setSavingShift(false);
  };

  const handleDeleteShift = async (shift: EmployeeAvailability) => {
    if (!dataManager) return;

    const validation = dataManager.canDeleteAvailability(shift);
    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }

    if (!confirm('Удалить смену?')) return;

    const result = await dataManager.deleteAvailability(shift.id);
    
    if (result.success) {
      setIsViewModalOpen(false);
      setUpdateTrigger(prev => prev + 1);
    } else {
      alert(result.error || 'Ошибка при удалении');
    }
  };

  // ========== ОБРАБОТЧИКИ - ФАКТИЧЕСКОЕ ВРЕМЯ ==========
  const openTimeLogModal = (schedule: ScheduleAssignment) => {
    if (!dataManager) return;

    const validation = dataManager.canLogActualTime(schedule);
    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }

    const existingLog = dataManager.getActualWorkLog(schedule.id);
    if (existingLog) {
      alert('Вы уже отметили время для этой смены. Изменить нельзя.');
      return;
    }

    setSelectedSchedule(schedule);
    setActualStart(schedule.start_time.slice(0, 5));
    setActualEnd(schedule.end_time.slice(0, 5));
    setTimeLogError('');
    setIsTimeLogModalOpen(true);
  };

  const handleSaveTimeLog = async () => {
    if (!dataManager || !selectedSchedule) return;

    if (actualStart >= actualEnd) {
      setTimeLogError('Время окончания должно быть позже начала');
      return;
    }

    setSavingTimeLog(true);

    const result = await dataManager.addActualWorkLog({
      schedule_assignment_id: selectedSchedule.id,
      actual_start: actualStart + ':00',
      actual_end: actualEnd + ':00',
    });

    if (result.success) {
      setIsTimeLogModalOpen(false);
      setUpdateTrigger(prev => prev + 1);
    } else {
      setTimeLogError(result.error || 'Ошибка сохранения');
    }

    setSavingTimeLog(false);
  };

  // ========== ОБРАБОТЧИКИ - ЦЕЛЬ ОБУЧЕНИЯ ==========
  const handleSaveStudyGoal = async () => {
    if (!dataManager) return;
    
    if (!selectedAttractionId) {
      setGoalError('Выберите аттракцион');
      return;
    }

    setSavingGoal(true);
    setGoalError('');

    const result = await dataManager.setStudyGoal(selectedAttractionId);

    if (result.success) {
      alert('Цель изучения сохранена');
      setUpdateTrigger(prev => prev + 1);
    } else {
      setGoalError(result.error || 'Ошибка сохранения');
    }

    setSavingGoal(false);
  };

  // ========== ОБРАБОТЧИКИ - ЗАРПЛАТА ==========
  const calculateSalary = async (period: 'first' | 'second') => {
    if (!dataManager) return;

    setLoadingSalary(true);
    
    try {
      const result = await dataManager.calculateSalary(period);
      setSalaryData(result);
    } catch (error) {
      console.error('Ошибка расчёта зарплаты:', error);
      setSalaryData(null);
    } finally {
      setLoadingSalary(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'salary' && dataManager) {
      calculateSalary(salaryPeriod);
    }
  }, [activeTab, salaryPeriod, dataManager]);

  // ========== РЕНДЕР - КАЛЕНДАРЬ МЕСЯЦА ==========
  const renderMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const days = [];

    // Пустые ячейки в начале
    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(<div key={`empty-${i}`} className="p-3"></div>);
    }

    // Дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dateObj = new Date(year, month, i);
      const isToday = dateStr === todayStr;
      const shift = allAvailability.find(s => s.work_date === dateStr);
      const active = dataManager?.isDateActive(dateStr) && !occupiedDates.has(dateStr);

      let bgClass = 'bg-white border-gray-100 shadow-sm';
      
      if (shift) {
        bgClass = shift.is_full_day 
          ? 'bg-green-50 border-green-300' 
          : 'bg-yellow-50 border-yellow-300';
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
            if (shift) {
              openViewModal(shift);
            } else if (active) {
              openAddModal(dateStr);
            }
          }}
          disabled={!active && !shift}
        >
          <span className={`text-xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'} z-10`}>
            {i}
          </span>
          <span className="text-[10px] text-gray-500 font-bold uppercase mt-1 z-10">
            {weekdays[dateObj.getDay()]}
          </span>
          {shift && (
            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
              shift.is_full_day ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
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

  // ========== РЕНДЕР - ТАБЛИЦА СМЕН ==========
  const renderShiftsTable = () => {
    if (shiftsForMonth.length === 0) {
      return (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <Calendar className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p className="text-gray-500">Смен в этом месяце пока нет</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto hide-scrollbar">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Комментарий</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shiftsForMonth.map(shift => {
              const canDelete = dataManager?.canDeleteAvailability(shift);
              
              return (
                <tr 
                  key={shift.id} 
                  className="hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => openViewModal(shift)}
                >
                  <td className="px-4 py-3 text-sm">
                    {format(parseISO(shift.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    {shift.is_full_day ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                        Полная
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                        Неполная
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {shift.is_full_day 
                      ? 'Весь день' 
                      : `${shift.start_time?.slice(0, 5)}–${shift.end_time?.slice(0, 5)}`
                    }
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {shift.comment ? (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {shift.comment.slice(0, 30)}
                        {shift.comment.length > 30 && '...'}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canDelete?.allowed ? (
                      <button
                        onClick={() => handleDeleteShift(shift)}
                        className="text-red-500 hover:text-red-700 p-2 transition"
                        title="Удалить смену"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">Блок</span>
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

  // ========== РЕНДЕР - ТАБЛИЦА РАСПИСАНИЯ ==========
  const renderScheduleTable = () => {
    if (scheduleForMonth.length === 0) {
      return (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <Calendar className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p className="text-gray-500">График от администратора не найден</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto hide-scrollbar">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Аттракцион</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Плановое время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Отметка</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {scheduleForMonth.map(schedule => {
              const log = dataManager?.getActualWorkLog(schedule.id);
              const canLog = dataManager?.canLogActualTime(schedule);
              const attraction = dataManager?.getAttraction(schedule.attraction_id);

              return (
                <tr key={schedule.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-sm">
                    {format(parseISO(schedule.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {attraction?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log 
                      ? `${log.actual_start.slice(0, 5)}–${log.actual_end.slice(0, 5)}`
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {log ? (
                      <span className="text-green-600 text-sm flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Отмечено
                      </span>
                    ) : canLog?.allowed ? (
                      <button
                        onClick={() => openTimeLogModal(schedule)}
                        className="text-blue-600 text-sm underline hover:text-blue-800 transition"
                      >
                        Отметить время
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">Недоступно</span>
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

  // ========== РЕНДЕР - ПРИОРИТЕТЫ ==========
  const renderPriorities = () => {
    const priorityMap: Record<number, string> = {
      1: 'Не задан',
      2: 'Не задан',
      3: 'Не задан'
    };

    priorities.forEach(prio => {
      if (prio.priority_level >= 1 && prio.priority_level <= 3 && prio.attractions && prio.attractions.length > 0) {
        priorityMap[prio.priority_level] = prio.attractions.map(a => a.name).join(', ');
      }
    });

    return (
      <ul className="divide-y divide-gray-100">
        {[1, 2, 3].map(level => (
          <li key={level} className="py-3 flex justify-between items-center">
            <span className="font-medium text-gray-700">{level}-й приоритет</span>
            <span className="text-sm bg-blue-50 text-blue-800 px-3 py-1 rounded-full">
              {priorityMap[level]}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  // ========== РЕНДЕР - ЦЕЛЬ ОБУЧЕНИЯ ==========
  const renderStudyGoal = () => {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Star className="text-purple-500" />
          Цель для изучения
        </h3>
        
        {goalError && (
          <div className="bg-red-50 text-red-700 text-sm p-2 rounded mb-2">
            {goalError}
          </div>
        )}

        <select
          value={selectedAttractionId || ''}
          onChange={e => setSelectedAttractionId(Number(e.target.value))}
          className="w-full border border-gray-200 rounded-lg p-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Выберите аттракцион --</option>
          {availableAttractions.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <button
          onClick={handleSaveStudyGoal}
          disabled={savingGoal || !selectedAttractionId}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingGoal ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Сохранение...
            </span>
          ) : (
            'Сохранить цель'
          )}
        </button>

        {studyGoal && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>Текущая цель:</strong> {studyGoal.attraction?.name || 'Загрузка...'}
            </p>
          </div>
        )}
      </div>
    );
  };

  // ========== РЕНДЕР - ЗАРПЛАТА ==========
  const renderSalaryBlock = () => {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
          <DollarSign className="text-green-600" />
          Примерный расчёт зарплаты
        </h3>
        
        <div className="text-xs text-gray-500 mb-4">
          *Данные носят ознакомительный характер. Точный расчёт производится бухгалтерией.
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSalaryPeriod('first')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              salaryPeriod === 'first'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            7–21 число
          </button>
          <button
            onClick={() => setSalaryPeriod('second')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              salaryPeriod === 'second'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            22–6 число
          </button>
          <button
            onClick={() => calculateSalary(salaryPeriod)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition"
          >
            Обновить
          </button>
        </div>

        {loadingSalary && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loadingSalary && salaryData && (
          <div>
            <div className="max-h-96 overflow-y-auto">
              {salaryData.days.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Нет данных за выбранный период
                </div>
              ) : (
                salaryData.days.map(day => (
                  <div key={day.date} className="border-b border-gray-100 py-3">
                    <div className="font-semibold text-gray-800 mb-2">
                      {format(parseISO(day.date), 'dd.MM.yyyy (EEEE)', { locale: ru })}
                    </div>
                    {day.attractions.map((a, idx) => (
                      <div key={idx} className="text-sm ml-4 text-gray-600">
                        🎢 {a.name}: {a.hours.toFixed(2)} ч × {a.rate}₽ × {a.coefficient} = {Math.round(a.earn)}₽
                      </div>
                    ))}
                    <div className="text-sm font-bold text-right text-blue-600 mt-1">
                      Итого за день: {Math.round(day.total)} ₽
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {salaryData.days.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-gray-200">
                <div className="text-xl font-bold text-right text-green-600">
                  Всего за период: {Math.round(salaryData.total)} ₽
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ========== РЕНДЕР - СВОДКА ==========
  const renderSummary = () => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Всего смен (самозапись):</span>
        <span className="font-bold text-gray-800">{shiftsForMonth.length}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Полных:</span>
        <span className="font-medium text-green-600">
          {shiftsForMonth.filter(s => s.is_full_day).length}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Неполных:</span>
        <span className="font-medium text-yellow-600">
          {shiftsForMonth.filter(s => !s.is_full_day).length}
        </span>
      </div>
      <div className="flex justify-between text-sm pt-2 border-t">
        <span className="text-gray-600">По графику админа:</span>
        <span className="font-bold text-blue-600">{scheduleForMonth.length}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Отмечено фактически:</span>
        <span className="font-medium text-green-600">
          {scheduleForMonth.filter(s => dataManager?.getActualWorkLog(s.id)).length}
        </span>
      </div>
    </div>
  );

  // ========== LOADING STATE ==========
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 h-12 w-12 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!dataManager) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Ошибка загрузки данных</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }

  // ========== ОСНОВНОЙ РЕНДЕР ==========
  const currentMonthLabel = format(currentDate, 'LLLL yyyy', { locale: ru });

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen pb-24 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 pt-6">
        {/* ========== ШАПКА ========== */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {greeting || profile.full_name}
            </h2>
            <p className="text-gray-500 text-sm">
              {profile.full_name} • Возраст: {profile.age ?? 'Не указан'} • 
              Ставка: {profile.base_hourly_rate}₽/ч
            </p>
          </div>
          <div className="text-right mt-4 md:mt-0">
            <div className="text-2xl font-mono text-blue-600 font-bold">
              {now.toLocaleTimeString('ru-RU')}
            </div>
            <div className="text-gray-500 text-sm">
              {now.toLocaleDateString('ru-RU', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>

        {/* ========== НАВИГАЦИЯ ПО МЕСЯЦАМ ========== */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
          <button
            onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-semibold text-gray-800 capitalize">
            {currentMonthLabel}
          </h3>
          <button
            onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* ========== ОСНОВНАЯ СЕТКА ========== */}
        <div className="md:grid md:grid-cols-3 md:gap-6">
          {/* ЛЕВАЯ КОЛОНКА - 2/3 */}
          <div className="md:col-span-2 space-y-6">
            {/* Календарь месяца */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Calendar className="text-blue-500" />
                Календарь — {currentMonthLabel}
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {renderMonthDays()}
              </div>
            </div>

            {/* Таблица смен самозаписи */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-4">Мои смены (самозапись)</h3>
              {renderShiftsTable()}
            </div>

            {/* Таблица расписания от админа */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold mb-4">График от администратора</h3>
              {renderScheduleTable()}
            </div>

            {/* Блок зарплаты (показывается при activeTab === 'salary') */}
            {activeTab === 'salary' && renderSalaryBlock()}
          </div>

          {/* ПРАВАЯ КОЛОНКА - 1/3 */}
          <div className="space-y-6 mt-6 md:mt-0">
            {/* Приоритеты */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Star className="text-yellow-500" />
                Приоритеты аттракционов
              </h3>
              {renderPriorities()}
            </div>

            {/* Цель обучения */}
            {renderStudyGoal()}

            {/* Сводка */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
              <h3 className="font-semibold text-blue-800 mb-4">
                Сводка — {currentMonthLabel}
              </h3>
              {renderSummary()}
            </div>

            {/* Опрос (Google Form) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <FileText className="text-purple-500" />
                Опрос сотрудника
              </h3>
              <div className="relative h-[590px] overflow-hidden rounded-xl border border-gray-200">
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                  className="absolute top-0 left-0 w-full h-full"
                  frameBorder="0"
                  title="Google Form"
                >
                  Загрузка…
                </iframe>
              </div>
            </div>
          </div>
        </div>

        {/* ========== FOOTER ========== */}
        <footer className="mt-12 mb-24 md:mb-8 text-center text-xs text-gray-400">
          <p>
            Hand-coded by{' '}
            <strong>
              <a
                href="https://vk.com/albars_studio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700"
              >
                AlBars
              </a>
            </strong>{' '}
            • Vite build:{' '}
            <span className="text-green-500 font-mono font-bold">{ping}</span> ms • 
            Supabase • Host: GitHub Pages
          </p>
          <p className="italic mt-1">
            Ни один искусственный интеллект не пострадал при создании
          </p>
        </footer>
      </div>

      {/* ========== МОДАЛКИ ========== */}
      
      {/* Модалка добавления смены */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-4">
              Смена на {formatDateStr(modalDate)}
            </h3>

            {modalError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
                {modalError}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setIsFullDayModal(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  isFullDayModal
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Полная
              </button>
              <button
                onClick={() => setIsFullDayModal(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  !isFullDayModal
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Неполная
              </button>
            </div>

            {!isFullDayModal && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Начало
                  </label>
                  <select
                    value={modalStartTime}
                    onChange={e => setModalStartTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {START_TIMES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Конец
                  </label>
                  <select
                    value={modalEndTime}
                    onChange={e => setModalEndTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {END_TIMES.filter(t => t > modalStartTime).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Комментарий (необязательно)
              </label>
              <textarea
                value={modalComment}
                onChange={e => setModalComment(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Напишите комментарий..."
                maxLength={4096}
              />
              <p className="text-xs text-gray-500 mt-1">
                {modalComment.length} / 4096 символов
              </p>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              ⚠️ Комментарий нельзя будет изменить после создания.
            </p>

            <button
              onClick={handleAddShift}
              disabled={savingShift}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingShift ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Добавление...
                </span>
              ) : (
                'Добавить смену'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Модалка просмотра смены */}
      {isViewModalOpen && viewShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md relative">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-4">Детали смены</h3>

            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Дата:</span>
                <p className="font-medium">
                  {format(parseISO(viewShift.work_date), 'dd MMMM yyyy (EEEE)', { locale: ru })}
                </p>
              </div>

              <div>
                <span className="text-sm text-gray-600">Тип:</span>
                <p>
                  {viewShift.is_full_day ? (
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Полная смена
                    </span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      Неполная смена
                    </span>
                  )}
                </p>
              </div>

              {!viewShift.is_full_day && (
                <div>
                  <span className="text-sm text-gray-600">Время:</span>
                  <p className="font-medium">
                    {viewShift.start_time?.slice(0, 5)} – {viewShift.end_time?.slice(0, 5)}
                  </p>
                </div>
              )}

              <div>
                <span className="text-sm text-gray-600">Комментарий:</span>
                <p className="font-medium">
                  {viewShift.comment || <span className="text-gray-400">Нет комментария</span>}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Закрыть
              </button>
              {dataManager?.canDeleteAvailability(viewShift).allowed && (
                <button
                  onClick={() => handleDeleteShift(viewShift)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка отметки фактического времени */}
      {isTimeLogModalOpen && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md relative">
            <button
              onClick={() => setIsTimeLogModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-2">Отметка фактического времени</h3>
            <p className="text-sm text-gray-600 mb-4">
              {format(parseISO(selectedSchedule.work_date), 'dd.MM.yyyy')} –{' '}
              {dataManager?.getAttraction(selectedSchedule.attraction_id)?.name}
            </p>

            {timeLogError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
                {timeLogError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Время прихода
                </label>
                <input
                  type="time"
                  value={actualStart}
                  onChange={e => setActualStart(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Время ухода
                </label>
                <input
                  type="time"
                  value={actualEnd}
                  onChange={e => setActualEnd(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm text-blue-800">
              ℹ️ Оплата начинается с 11:00. Если пришли раньше, время до 11:00 не оплачивается.
            </div>

            <button
              onClick={handleSaveTimeLog}
              disabled={savingTimeLog}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingTimeLog ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Сохранение...
                </span>
              ) : (
                'Сохранить'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========== МОБИЛЬНОЕ МЕНЮ ========== */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around h-16 z-40 shadow-lg">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 transition ${
            activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-xs mt-1">Сводка</span>
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`flex flex-col items-center justify-center flex-1 transition ${
            activeTab === 'shifts' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="text-xs mt-1">Смены</span>
        </button>
        <button
          onClick={() => setActiveTab('priorities')}
          className={`flex flex-col items-center justify-center flex-1 transition ${
            activeTab === 'priorities' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <Star className="h-5 w-5" />
          <span className="text-xs mt-1">Приоритеты</span>
        </button>
        <button
          onClick={() => setActiveTab('salary')}
          className={`flex flex-col items-center justify-center flex-1 transition ${
            activeTab === 'salary' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <DollarSign className="h-5 w-5" />
          <span className="text-xs mt-1">Зарплата</span>
        </button>
        <button
          onClick={() => setActiveTab('form')}
          className={`flex flex-col items-center justify-center flex-1 transition ${
            activeTab === 'form' ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <FileText className="h-5 w-5" />
          <span className="text-xs mt-1">Опрос</span>
        </button>
      </nav>

      {/* ========== СТИЛИ ========== */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
