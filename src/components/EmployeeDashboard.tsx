import { useState, useEffect, useMemo } from 'react';
import { 
  initializeEmployeeData, 
  destroyEmployeeData,
  type EmployeeDataManager,
  type Employee,
  type EmployeeAvailability,
  type ScheduleAssignment,
} from '../lib/employeeDatabase';
import { getRandomGreeting } from '../utils/greetings';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Loader2, Calendar, Star, ChevronLeft, ChevronRight,
  Trash2, X, Clock, FileText, MessageCircle,
  CheckCircle, DollarSign, Home, Target, TrendingUp,
  Briefcase, Award, Activity
} from 'lucide-react';
import { Card, Badge, Button, Modal } from './ui';

// ========================================================================================
// ТИПЫ
// ========================================================================================

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

type TabType = 'home' | 'calendar' | 'schedule' | 'priorities' | 'salary' | 'form';

// ========================================================================================
// УТИЛИТЫ
// ========================================================================================

function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

// ========================================================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ========================================================================================

export function EmployeeDashboard({ profile }: EmployeeDashboardProps) {
  
  // ========================================================================================
  // STATE
  // ========================================================================================
  
  const [dataManager, setDataManager] = useState<EmployeeDataManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabType>('home');
  
  // Модалки
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [isFullDayModal, setIsFullDayModal] = useState(true);
  const [modalStartTime, setModalStartTime] = useState('10:00');
  const [modalEndTime, setModalEndTime] = useState('22:00');
  const [modalComment, setModalComment] = useState('');
  const [modalError, setModalError] = useState('');
  const [savingShift, setSavingShift] = useState(false);
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewShift, setViewShift] = useState<EmployeeAvailability | null>(null);
  
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleAssignment | null>(null);
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [timeLogError, setTimeLogError] = useState('');
  const [savingTimeLog, setSavingTimeLog] = useState(false);
  
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  
  const [salaryPeriod, setSalaryPeriod] = useState<'first' | 'second'>('first');
  const [salaryData, setSalaryData] = useState<{ days: SalaryDay[]; total: number } | null>(null);
  const [loadingSalary, setLoadingSalary] = useState(false);
  
  // ========================================================================================
  // ВРЕМЕННЫЕ ИНТЕРВАЛЫ
  // ========================================================================================
  
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
  
  // ========================================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ========================================================================================
  
  useEffect(() => {
    async function init() {
      try {
        const manager = await initializeEmployeeData(profile.id);
        setDataManager(manager);
        
        const studyGoal = manager.getStudyGoal();
        if (studyGoal) {
          setSelectedAttractionId(studyGoal.attraction_id);
        }
      } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        alert('Ошибка загрузки данных. Перезагрузите страницу.');
      } finally {
        setLoading(false);
      }
    }

    init();
    return () => destroyEmployeeData();
  }, [profile.id]);
  
  // ========================================================================================
  // ТАЙМЕРЫ
  // ========================================================================================
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (profile.full_name) {
      setGreeting(getRandomGreeting(profile.full_name, new Date()));
    }
  }, [profile.full_name]);

  useEffect(() => {
    if (!dataManager) return;
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [dataManager]);
  
  // ========================================================================================
  // ДАННЫЕ
  // ========================================================================================

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

  const studyGoal = useMemo(() => 
    dataManager?.getStudyGoal() || null, 
    [dataManager, updateTrigger]
  );

  const priorities = useMemo(() => 
    dataManager?.getPriorities() || [], 
    [dataManager, updateTrigger]
  );

  const availableAttractionsForGoal = useMemo(() => {
    if (!dataManager) return [];
    
    const priorityAttractionIds = new Set(
      priorities.flatMap(p => {
        if (!p.attraction_ids) return [];
        const ids = Array.isArray(p.attraction_ids) ? p.attraction_ids : [p.attraction_ids];
        return ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
      })
    );
    
    let available = attractions.filter(a => !priorityAttractionIds.has(a.id));
    
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
  }, [dataManager, studyGoal, attractions, priorities, updateTrigger]);

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
  
  // ========================================================================================
  // ЗАГРУЗКА
  // ========================================================================================
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!dataManager) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Card padding="lg" className="text-center max-w-md">
          <div className="mb-4" style={{ color: 'var(--error)' }}>
            <X className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Ошибка загрузки данных</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Не удалось загрузить информацию
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
          >
            Перезагрузить страницу
          </Button>
        </Card>
      </div>
    );
  }
  
  // ========================================================================================
  // RENDER - ГЛАВНАЯ СТРАНИЦА
  // ========================================================================================
  
  const currentMonthLabel = format(currentDate, 'LLLL yyyy', { locale: ru });

  return (
    <div className="space-y-6">
      {/* Приветствие и статистика */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Приветствие */}
        <Card padding="lg" className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                {greeting || `Здравствуйте, ${profile.full_name?.split(' ')[0]}!`}
              </h2>
              <div className="flex flex-wrap gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  <span>Возраст: {profile.age ?? 'Не указан'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  <span>Ставка: {profile.base_hourly_rate || 250}₽/ч</span>
                </div>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-3xl font-bold font-mono" style={{ color: 'var(--primary)' }}>
                {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                {format(now, 'dd MMMM yyyy', { locale: ru })}
              </div>
            </div>
          </div>
        </Card>

        {/* Быстрая статистика */}
        <Card padding="md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
                  <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {shiftsForMonth.length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--info-light)' }}>
                  <Calendar className="h-4 w-4" style={{ color: 'var(--info)' }} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>По графику</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {scheduleForMonth.length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Activity className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Отработано</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {scheduleForMonth.filter(s => dataManager?.getActualWorkLog(s.id)).length}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Текущие цели */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Приоритеты */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
              Приоритеты аттракционов
            </h3>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(level => {
              const priority = priorities.find(p => p.priority_level === level);
              const attractionIds = Array.isArray(priority?.attraction_ids) 
                ? priority.attraction_ids 
                : (priority?.attraction_ids ? [priority.attraction_ids] : []);
              
              const attractionNames = attractionIds
                .map(id => {
                  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
                  return attractions.find(a => a.id === numId)?.name || 'Неизвестный';
                })
                .join(', ') || 'Не задан';

              return (
                <div key={level} className="flex items-center justify-between py-2">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {level}-й приоритет
                  </span>
                  <Badge variant={level === 1 ? 'success' : level === 2 ? 'warning' : 'info'}>
                    {attractionNames}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Цель обучения */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
              Цель для изучения
            </h3>
          </div>

          {goalError && (
            <div className="mb-3 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
              {goalError}
            </div>
          )}

          <select
            value={selectedAttractionId || ''}
            onChange={e => setSelectedAttractionId(Number(e.target.value))}
            className="input mb-3"
          >
            <option value="">-- Выберите аттракцион --</option>
            {availableAttractionsForGoal.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <Button
            onClick={async () => {
              if (!dataManager || !selectedAttractionId) {
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
            }}
            disabled={savingGoal || !selectedAttractionId}
            variant="primary"
            size="sm"
            loading={savingGoal}
            className="w-full"
          >
            Сохранить цель
          </Button>

          {studyGoal && studyGoal.attraction && (
            <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
              <p className="text-sm" style={{ color: 'var(--primary)' }}>
                <strong>Текущая цель:</strong> {studyGoal.attraction.name}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Здесь будет остальной контент */}
      <Card padding="lg">
        <p style={{ color: 'var(--text-muted)' }} className="text-center">
          🚧 Остальные разделы в процессе рефакторинга...
        </p>
      </Card>
    </div>
  );
}
  // ========================================================================================
  // ОБРАБОТЧИКИ - СМЕНЫ ДОСТУПНОСТИ
  // ========================================================================================
  
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

  // ========================================================================================
  // ОБРАБОТЧИКИ - ФАКТИЧЕСКОЕ ВРЕМЯ
  // ========================================================================================

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
    setActualStart(schedule.start_time ? schedule.start_time.slice(0, 5) : '10:00');
    setActualEnd(schedule.end_time ? schedule.end_time.slice(0, 5) : '22:00');
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

  // ========================================================================================
  // ОБРАБОТЧИКИ - ЗАРПЛАТА
  // ========================================================================================

  const calculateSalary = async (period: 'first' | 'second') => {
    if (!dataManager) return;

    setLoadingSalary(true);
    
    try {
      const result = await dataManager.calculateSalary(period);
      setSalaryData(result);
    } catch (error) {
      console.error('❌ Ошибка расчёта зарплаты:', error);
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

  // ========================================================================================
  // RENDER - КАЛЕНДАРЬ
  // ========================================================================================

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const days = [];

    // Пустые ячейки
    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    // Дни месяца
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const shift = allAvailability.find(s => s.work_date === dateStr);
      const active = dataManager?.isDateActive(dateStr) && !occupiedDates.has(dateStr);

      days.push(
        <button
          key={dateStr}
          onClick={() => {
            if (shift) {
              openViewModal(shift);
            } else if (active) {
              openAddModal(dateStr);
            }
          }}
          disabled={!active && !shift}
          className="aspect-square flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all relative"
          style={{
            backgroundColor: shift 
              ? (shift.is_full_day ? 'var(--success-light)' : 'var(--warning-light)')
              : active 
                ? 'var(--surface)' 
                : 'var(--bg-tertiary)',
            borderColor: isToday 
              ? 'var(--primary)' 
              : shift 
                ? (shift.is_full_day ? 'var(--success)' : 'var(--warning)')
                : 'var(--border)',
            opacity: (!active && !shift) ? 0.4 : 1,
            cursor: (active || shift) ? 'pointer' : 'not-allowed',
          }}
        >
          <span 
            className="text-base font-bold"
            style={{ color: isToday ? 'var(--primary)' : 'var(--text)' }}
          >
            {i}
          </span>
          {shift && (
            <div 
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: shift.is_full_day ? 'var(--success)' : 'var(--warning)' }}
            />
          )}
          {shift?.comment && (
            <MessageCircle 
              className="absolute bottom-1 right-1 h-3 w-3"
              style={{ color: 'var(--text-subtle)' }}
            />
          )}
        </button>
      );
    }

    return (
      <div className="space-y-4">
        {/* Заголовки дней недели */}
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map(day => (
            <div 
              key={day} 
              className="text-center text-xs font-semibold py-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Дни */}
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>

        {/* Легенда */}
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
            <span>Полная смена</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)' }} />
            <span>Неполная смена</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-3 w-3" />
            <span>Есть комментарий</span>
          </div>
        </div>
      </div>
    );
  };

  // ========================================================================================
  // RENDER - ТАБЛИЦЫ
  // ========================================================================================

  const renderShiftsTable = () => {
    if (shiftsForMonth.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 mb-3 opacity-30" style={{ color: 'var(--text-subtle)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Смен в этом месяце пока нет</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Дата
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Тип
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Время
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Комментарий
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Действие
              </th>
            </tr>
          </thead>
          <tbody>
            {shiftsForMonth.map(shift => {
              const canDelete = dataManager?.canDeleteAvailability(shift);
              
              return (
                <tr 
                  key={shift.id}
                  onClick={() => openViewModal(shift)}
                  className="border-b cursor-pointer transition-colors hover:bg-opacity-50"
                  style={{ 
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(shift.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={shift.is_full_day ? 'success' : 'warning'}>
                      {shift.is_full_day ? 'Полная' : 'Неполная'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {shift.is_full_day 
                      ? 'Весь день' 
                      : `${shift.start_time?.slice(0, 5) || '00:00'}–${shift.end_time?.slice(0, 5) || '00:00'}`
                    }
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {shift.comment ? (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {shift.comment.slice(0, 30)}
                        {shift.comment.length > 30 && '...'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td 
                    className="px-4 py-3 text-right" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canDelete?.allowed ? (
                      <button
                        onClick={() => handleDeleteShift(shift)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--error)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--error-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Удалить смену"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Блок</span>
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

  const renderScheduleTable = () => {
    if (scheduleForMonth.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 mb-3 opacity-30" style={{ color: 'var(--text-subtle)' }} />
          <p style={{ color: 'var(--text-muted)' }}>График от администратора не найден</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto hide-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Дата
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Аттракцион
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Плановое время
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Отметка
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Статус
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduleForMonth.map(schedule => {
              const log = dataManager?.getActualWorkLog(schedule.id);
              const canLog = dataManager?.canLogActualTime(schedule);
              const attraction = dataManager?.getAttraction(schedule.attraction_id);

              return (
                <tr 
                  key={schedule.id}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(schedule.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {attraction?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {schedule.start_time?.slice(0, 5) || '00:00'} – {schedule.end_time?.slice(0, 5) || '00:00'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {log 
                      ? `${log.actual_start?.slice(0, 5) || '00:00'}–${log.actual_end?.slice(0, 5) || '00:00'}`
                      : '—'
                    }
                  </td>
                  <td className="px-4 py-3">
                    {log ? (
                      <Badge variant="success" dot>
                        <CheckCircle className="h-3 w-3" />
                        Отмечено
                      </Badge>
                    ) : canLog?.allowed ? (
                      <Button
                        onClick={() => openTimeLogModal(schedule)}
                        variant="secondary"
                        size="sm"
                      >
                        Отметить
                      </Button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                        Недоступно
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

  // ========================================================================================
  // RENDER - ЗАРПЛАТА
  // ========================================================================================

  const renderSalary = () => {
    return (
      <div className="space-y-4">
        <div className="text-xs p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
          ⚠️ Данные носят ознакомительный характер. Точный расчёт производится бухгалтерией.
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setSalaryPeriod('first')}
            variant={salaryPeriod === 'first' ? 'primary' : 'secondary'}
            size="sm"
          >
            7–21 число
          </Button>
          <Button
            onClick={() => setSalaryPeriod('second')}
            variant={salaryPeriod === 'second' ? 'primary' : 'secondary'}
            size="sm"
          >
            22–6 число
          </Button>
          <Button
            onClick={() => calculateSalary(salaryPeriod)}
            variant="ghost"
            size="sm"
          >
            Обновить
          </Button>
        </div>

        {loadingSalary && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}

        {!loadingSalary && salaryData && (
          <div>
            {salaryData.days.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                Нет данных за выбранный период
              </div>
            ) : (
              <div className="space-y-3">
                {salaryData.days.map(day => (
                  <Card key={day.date} padding="md">
                    <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                      {format(parseISO(day.date), 'dd.MM.yyyy (EEEE)', { locale: ru })}
                    </div>
                    <div className="space-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {day.attractions.map((a, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{a.name}</span>
                          <span className="font-mono">
                            {a.hours.toFixed(2)}ч × {a.rate}₽ × {a.coefficient} = {Math.round(a.earn)}₽
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between font-bold" style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>
                      <span>Итого за день:</span>
                      <span>{Math.round(day.total)} ₽</span>
                    </div>
                  </Card>
                ))}

                <Card padding="lg">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                      Всего за период:
                    </span>
                    <span className="text-3xl font-bold" style={{ color: 'var(--success)' }}>
                      {Math.round(salaryData.total)} ₽
                    </span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  // ========================================================================================
  // RENDER - ВКЛАДКИ (МОБИЛЬНАЯ НАВИГАЦИЯ)
  // ========================================================================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-6">
            {/* Приветствие и статистика */}
            <div className="grid grid-cols-1 gap-4">
              <Card padding="lg">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                  {greeting || `Здравствуйте, ${profile.full_name?.split(' ')[0]}!`}
                </h2>
                <div className="flex flex-wrap gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    <span>Возраст: {profile.age ?? 'Не указан'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    <span>Ставка: {profile.base_hourly_rate || 250}₽/ч</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-4xl font-bold font-mono" style={{ color: 'var(--primary)' }}>
                    {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                    {format(now, 'dd MMMM yyyy, EEEE', { locale: ru })}
                  </div>
                </div>
              </Card>

              <Card padding="md">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
                        <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                      {shiftsForMonth.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--info-light)' }}>
                        <Calendar className="h-4 w-4" style={{ color: 'var(--info)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>По графику</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                      {scheduleForMonth.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                        <Activity className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Отработано</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                      {scheduleForMonth.filter(s => dataManager?.getActualWorkLog(s.id)).length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Приоритеты и цели */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Приоритеты аттракционов
                </h3>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map(level => {
                  const priority = priorities.find(p => p.priority_level === level);
                  const attractionIds = Array.isArray(priority?.attraction_ids) 
                    ? priority.attraction_ids 
                    : (priority?.attraction_ids ? [priority.attraction_ids] : []);
                  
                  const attractionNames = attractionIds
                    .map(id => {
                      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
                      return attractions.find(a => a.id === numId)?.name || 'Неизвестный';
                    })
                    .join(', ') || 'Не задан';

                  return (
                    <div key={level} className="flex items-center justify-between py-2">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {level}-й приоритет
                      </span>
                      <Badge variant={level === 1 ? 'success' : level === 2 ? 'warning' : 'info'}>
                        {attractionNames}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Цель для изучения
                </h3>
              </div>

              {goalError && (
                <div className="mb-3 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
                  {goalError}
                </div>
              )}

              <select
                value={selectedAttractionId || ''}
                onChange={e => setSelectedAttractionId(Number(e.target.value))}
                className="input mb-3"
              >
                <option value="">-- Выберите аттракцион --</option>
                {availableAttractionsForGoal.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <Button
                onClick={async () => {
                  if (!dataManager || !selectedAttractionId) {
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
                }}
                disabled={savingGoal || !selectedAttractionId}
                variant="primary"
                size="sm"
                loading={savingGoal}
                className="w-full"
              >
                Сохранить цель
              </Button>

              {studyGoal && studyGoal.attraction && (
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <p className="text-sm" style={{ color: 'var(--primary)' }}>
                    <strong>Текущая цель:</strong> {studyGoal.attraction.name}
                  </p>
                </div>
              )}
            </Card>
          </div>
        );

      case 'calendar':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                variant="ghost"
                size="sm"
                icon={<ChevronLeft className="h-4 w-4" />}
              />
              <h3 className="text-lg font-semibold capitalize" style={{ color: 'var(--text)' }}>
                {currentMonthLabel}
              </h3>
              <Button
                onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                variant="ghost"
                size="sm"
                icon={<ChevronRight className="h-4 w-4" />}
              />
            </div>

            <Card padding="md">
              {renderCalendar()}
            </Card>

            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>
                Список смен
              </h3>
              {renderShiftsTable()}
            </Card>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                variant="ghost"
                size="sm"
                icon={<ChevronLeft className="h-4 w-4" />}
              />
              <h3 className="text-lg font-semibold capitalize" style={{ color: 'var(--text)' }}>
                {currentMonthLabel}
              </h3>
              <Button
                onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                variant="ghost"
                size="sm"
                icon={<ChevronRight className="h-4 w-4" />}
              />
            </div>

            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>
                График от администратора
              </h3>
              {renderScheduleTable()}
            </Card>
          </div>
        );

      case 'salary':
        return (
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5" style={{ color: 'var(--success)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                Расчёт зарплаты
              </h3>
            </div>
            {renderSalary()}
          </Card>
        );

      case 'form':
        return (
          <Card padding="md">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                Опрос сотрудника
              </h3>
            </div>
            <div className="relative h-[calc(100vh-250px)] overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                title="Google Form"
              >
                Загрузка…
              </iframe>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  // ========================================================================================
  // ОСНОВНОЙ RENDER
  // ========================================================================================

  return (
    <>
      {/* ДЕСКТОПНАЯ ВЕРСИЯ */}
      <div className="hidden md:block space-y-6">
        {/* Приветствие и статистика */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card padding="lg" className="lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                  {greeting || `Здравствуйте, ${profile.full_name?.split(' ')[0]}!`}
                </h2>
                <div className="flex flex-wrap gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    <span>Возраст: {profile.age ?? 'Не указан'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    <span>Ставка: {profile.base_hourly_rate || 250}₽/ч</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold font-mono" style={{ color: 'var(--primary)' }}>
                  {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                  {format(now, 'dd MMMM yyyy', { locale: ru })}
                </div>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
                    <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
                </div>
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {shiftsForMonth.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--info-light)' }}>
                    <Calendar className="h-4 w-4" style={{ color: 'var(--info)' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>По графику</span>
                </div>
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {scheduleForMonth.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                    <Activity className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Отработано</span>
                </div>
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {scheduleForMonth.filter(s => dataManager?.getActualWorkLog(s.id)).length}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Основная сетка */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Навигация по месяцам */}
            <div className="flex items-center justify-between">
              <Button
                onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                variant="ghost"
                icon={<ChevronLeft className="h-5 w-5" />}
              />
              <h3 className="text-xl font-semibold capitalize" style={{ color: 'var(--text)' }}>
                {currentMonthLabel}
              </h3>
              <Button
                onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                variant="ghost"
                icon={<ChevronRight className="h-5 w-5" />}
              />
            </div>

            {/* Календарь */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Календарь смен
                </h3>
              </div>
              {renderCalendar()}
            </Card>

            {/* Таблица смен */}
            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>
                Мои смены (самозапись)
              </h3>
              {renderShiftsTable()}
            </Card>

            {/* Таблица расписания */}
            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>
                График от администратора
              </h3>
              {renderScheduleTable()}
            </Card>

            {/* Зарплата */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5" style={{ color: 'var(--success)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Расчёт зарплаты
                </h3>
              </div>
              {renderSalary()}
            </Card>
          </div>

          {/* Правая колонка - 1/3 */}
          <div className="space-y-6">
            {/* Приоритеты */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Приоритеты
                </h3>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map(level => {
                  const priority = priorities.find(p => p.priority_level === level);
                  const attractionIds = Array.isArray(priority?.attraction_ids) 
                    ? priority.attraction_ids 
                    : (priority?.attraction_ids ? [priority.attraction_ids] : []);
                  
                  const attractionNames = attractionIds
                    .map(id => {
                      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
                      return attractions.find(a => a.id === numId)?.name || 'Неизвестный';
                    })
                    .join(', ') || 'Не задан';

                  return (
                    <div key={level} className="flex items-center justify-between py-2">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {level}-й приоритет
                      </span>
                      <Badge variant={level === 1 ? 'success' : level === 2 ? 'warning' : 'info'}>
                        {attractionNames}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Цель обучения */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Цель изучения
                </h3>
              </div>

              {goalError && (
                <div className="mb-3 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
                  {goalError}
                </div>
              )}

              <select
                value={selectedAttractionId || ''}
                onChange={e => setSelectedAttractionId(Number(e.target.value))}
                className="input mb-3"
              >
                <option value="">-- Выберите аттракцион --</option>
                {availableAttractionsForGoal.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <Button
                onClick={async () => {
                  if (!dataManager || !selectedAttractionId) {
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
                }}
                disabled={savingGoal || !selectedAttractionId}
                variant="primary"
                size="sm"
                loading={savingGoal}
                className="w-full"
              >
                Сохранить цель
              </Button>

              {studyGoal && studyGoal.attraction && (
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <p className="text-sm" style={{ color: 'var(--primary)' }}>
                    <strong>Текущая цель:</strong> {studyGoal.attraction.name}
                  </p>
                </div>
              )}
            </Card>

            {/* Опрос */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Опрос сотрудника
                </h3>
              </div>
              <div className="relative h-[500px] overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                  className="absolute top-0 left-0 w-full h-full"
                  frameBorder="0"
                  title="Google Form"
                >
                  Загрузка…
                </iframe>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* МОБИЛЬНАЯ ВЕРСИЯ */}
      <div className="md:hidden pb-20">
        {renderTabContent()}

        {/* Мобильная навигация */}
        <nav 
          className="fixed bottom-0 left-0 right-0 z-50 border-t safe-area-inset-bottom"
          style={{ 
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)'
          }}
        >
          <div className="grid grid-cols-5 h-16">
            {[
              { id: 'home' as const, icon: Home, label: 'Главная' },
              { id: 'calendar' as const, icon: Calendar, label: 'Календарь' },
              { id: 'schedule' as const, icon: Clock, label: 'График' },
              { id: 'salary' as const, icon: DollarSign, label: 'Зарплата' },
              { id: 'form' as const, icon: FileText, label: 'Опрос' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex flex-col items-center justify-center transition-all"
                style={{
                  backgroundColor: activeTab === id ? 'var(--primary-light)' : 'transparent',
                  color: activeTab === id ? 'var(--primary)' : 'var(--text-subtle)',
                }}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs mt-1">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* ========================================
          МОДАЛЬНЫЕ ОКНА
          ======================================== */}

      {/* Добавление смены */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={`Смена на ${formatDateStr(modalDate)}`}
      >
        <div className="p-6 space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
              {modalError}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setIsFullDayModal(true)}
              variant={isFullDayModal ? 'primary' : 'secondary'}
              className="flex-1"
            >
              Полная
            </Button>
            <Button
              onClick={() => setIsFullDayModal(false)}
              variant={!isFullDayModal ? 'primary' : 'secondary'}
              className="flex-1"
            >
              Неполная
            </Button>
          </div>

          {!isFullDayModal && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Начало
                </label>
                <select
                  value={modalStartTime}
                  onChange={e => setModalStartTime(e.target.value)}
                  className="input"
                >
                  {START_TIMES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Конец
                </label>
                <select
                  value={modalEndTime}
                  onChange={e => setModalEndTime(e.target.value)}
                  className="input"
                >
                  {END_TIMES.filter(t => t > modalStartTime).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Комментарий (необязательно)
            </label>
            <textarea
              value={modalComment}
              onChange={e => setModalComment(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Напишите комментарий..."
              maxLength={4096}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
              {modalComment.length} / 4096 символов
            </p>
          </div>

          <div className="text-xs p-2 rounded-lg" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            ⚠️ Комментарий нельзя будет изменить после создания.
          </div>

          <Button
            onClick={handleAddShift}
            disabled={savingShift}
            variant="primary"
            size="lg"
            loading={savingShift}
            className="w-full"
          >
            Добавить смену
          </Button>
        </div>
      </Modal>

      {/* Просмотр смены */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Детали смены"
      >
        {viewShift && (
          <div className="p-6 space-y-4">
            <div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Дата:</span>
              <p className="font-medium" style={{ color: 'var(--text)' }}>
                {format(parseISO(viewShift.work_date), 'dd MMMM yyyy (EEEE)', { locale: ru })}
              </p>
            </div>

            <div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Тип:</span>
              <div className="mt-1">
                <Badge variant={viewShift.is_full_day ? 'success' : 'warning'}>
                  {viewShift.is_full_day ? 'Полная смена' : 'Неполная смена'}
                </Badge>
              </div>
            </div>

            {!viewShift.is_full_day && (
              <div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Время:</span>
                <p className="font-medium" style={{ color: 'var(--text)' }}>
                  {viewShift.start_time?.slice(0, 5)} – {viewShift.end_time?.slice(0, 5)}
                </p>
              </div>
            )}

            <div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Комментарий:</span>
              <p className="font-medium" style={{ color: 'var(--text)' }}>
                {viewShift.comment || <span style={{ color: 'var(--text-subtle)' }}>Нет комментария</span>}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setIsViewModalOpen(false)}
                variant="secondary"
                className="flex-1"
              >
                Закрыть
              </Button>
              {dataManager?.canDeleteAvailability(viewShift).allowed && (
                <Button
                  onClick={() => handleDeleteShift(viewShift)}
                  variant="danger"
                  className="flex-1"
                >
                  Удалить
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Отметка времени */}
      <Modal
        isOpen={isTimeLogModalOpen}
        onClose={() => setIsTimeLogModalOpen(false)}
        title="Отметка фактического времени"
      >
        {selectedSchedule && (
          <div className="p-6 space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {format(parseISO(selectedSchedule.work_date), 'dd.MM.yyyy')} –{' '}
              {dataManager?.getAttraction(selectedSchedule.attraction_id)?.name}
            </p>

            {timeLogError && (
              <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
                {timeLogError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Время прихода
                </label>
                <input
                  type="time"
                  value={actualStart}
                  onChange={e => setActualStart(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Время ухода
                </label>
                <input
                  type="time"
                  value={actualEnd}
                  onChange={e => setActualEnd(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'var(--info-light)', color: 'var(--info)' }}>
              ℹ️ Оплата начинается с 11:00. Если пришли раньше, время до 11:00 не оплачивается.
            </div>

            <Button
              onClick={handleSaveTimeLog}
              disabled={savingTimeLog}
              variant="primary"
              size="lg"
              loading={savingTimeLog}
              className="w-full"
            >
              Сохранить
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
