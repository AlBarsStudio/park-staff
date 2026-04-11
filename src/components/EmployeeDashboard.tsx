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
  CheckCircle, DollarSign, Home, Target,
  Briefcase, Award, Activity
} from 'lucide-react';
import { Card, Badge, Button, Modal } from './ui';

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

type TabType = 'home' | 'calendar' | 'schedule' | 'salary' | 'form';

function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export function EmployeeDashboard({ profile }: EmployeeDashboardProps) {
  const [dataManager, setDataManager] = useState<EmployeeDataManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabType>('home');
  
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

  const openAddModal = (dateStr: string) => {
    if (!dataManager) return;
    
    if (occupiedDates.has(dateStr)) {
      alert('На эту дату уже установлена смена.');
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

  const openTimeLogModal = (schedule: ScheduleAssignment) => {
    if (!dataManager) return;

    const validation = dataManager.canLogActualTime(schedule);
    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }

    const existingLog = dataManager.getActualWorkLog(schedule.id);
    if (existingLog) {
      alert('Вы уже отметили время для этой смены.');
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

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const days = [];

    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

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
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
        <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
            <span>Полная</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)' }} />
            <span>Неполная</span>
          </div>
        </div>
      </div>
    );
  };

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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Время</th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {shiftsForMonth.map(shift => {
              const canDelete = dataManager?.canDeleteAvailability(shift);
              
              return (
                <tr 
                  key={shift.id}
                  onClick={() => openViewModal(shift)}
                  className="border-b cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--border)' }}
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
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canDelete?.allowed ? (
                      <button
                        onClick={() => handleDeleteShift(shift)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--error)' }}
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
          <p style={{ color: 'var(--text-muted)' }}>График не найден</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Аттракцион</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {scheduleForMonth.map(schedule => {
              const log = dataManager?.getActualWorkLog(schedule.id);
              const canLog = dataManager?.canLogActualTime(schedule);
              const attraction = dataManager?.getAttraction(schedule.attraction_id);

              return (
                <tr key={schedule.id} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(schedule.work_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {attraction?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
                    {schedule.start_time?.slice(0, 5) || '00:00'} – {schedule.end_time?.slice(0, 5) || '00:00'}
                  </td>
                  <td className="px-4 py-3">
                    {log ? (
                      <Badge variant="success" dot>
                        Отмечено
                      </Badge>
                    ) : canLog?.allowed ? (
                      <Button onClick={() => openTimeLogModal(schedule)} variant="secondary" size="sm">
                        Отметить
                      </Button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Недоступно</span>
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

  const renderSalary = () => {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => setSalaryPeriod('first')} variant={salaryPeriod === 'first' ? 'primary' : 'secondary'} size="sm">
            7–21
          </Button>
          <Button onClick={() => setSalaryPeriod('second')} variant={salaryPeriod === 'second' ? 'primary' : 'secondary'} size="sm">
            22–6
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
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Нет данных</div>
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
                          <span>{Math.round(a.earn)}₽</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between font-bold" style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>
                      <span>Итого:</span>
                      <span>{Math.round(day.total)} ₽</span>
                    </div>
                  </Card>
                ))}
                <Card padding="lg">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold" style={{ color: 'var(--text)' }}>Всего:</span>
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

  const currentMonthLabel = format(currentDate, 'LLLL yyyy', { locale: ru });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="animate-spin h-12 w-12" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!dataManager) {
    return (
      <Card padding="lg" className="text-center max-w-md mx-auto">
        <X className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--error)' }} />
        <h3 className="text-lg font-bold mb-2">Ошибка загрузки</h3>
        <Button onClick={() => window.location.reload()} variant="primary">
          Перезагрузить
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="hidden md:block space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card padding="lg" className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              {greeting || `Здравствуйте, ${profile.full_name?.split(' ')[0]}!`}
            </h2>
            <div className="flex gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>Возраст: {profile.age ?? 'Не указан'}</span>
              <span>Ставка: {profile.base_hourly_rate || 250}₽/ч</span>
            </div>
          </Card>

          <Card padding="md">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
                <span className="font-bold" style={{ color: 'var(--text)' }}>{shiftsForMonth.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>По графику</span>
                <span className="font-bold" style={{ color: 'var(--text)' }}>{scheduleForMonth.length}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <Button onClick={() => setCurrentDate(prev => subMonths(prev, 1))} variant="ghost" icon={<ChevronLeft className="h-5 w-5" />} />
              <h3 className="text-xl font-semibold capitalize" style={{ color: 'var(--text)' }}>{currentMonthLabel}</h3>
              <Button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} variant="ghost" icon={<ChevronRight className="h-5 w-5" />} />
            </div>

            <Card padding="md">
              {renderCalendar()}
            </Card>

            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Мои смены</h3>
              {renderShiftsTable()}
            </Card>

            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>График от администратора</h3>
              {renderScheduleTable()}
            </Card>

            <Card padding="md">
              <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Зарплата</h3>
              {renderSalary()}
            </Card>
          </div>

          <div className="space-y-6">
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5" style={{ color: 'var(--warning)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Приоритеты</h3>
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
                    <div key={level} className="flex justify-between py-2">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{level}-й</span>
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
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Цель изучения</h3>
              </div>
              {goalError && <div className="mb-3 p-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>{goalError}</div>}
              <select value={selectedAttractionId || ''} onChange={e => setSelectedAttractionId(Number(e.target.value))} className="input mb-3">
                <option value="">-- Выберите --</option>
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
                    alert('Сохранено');
                    setUpdateTrigger(prev => prev + 1);
                  } else {
                    setGoalError(result.error || 'Ошибка');
                  }
                  setSavingGoal(false);
                }}
                disabled={savingGoal || !selectedAttractionId}
                variant="primary"
                size="sm"
                loading={savingGoal}
                className="w-full"
              >
                Сохранить
              </Button>
              {studyGoal && studyGoal.attraction && (
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
                  <p className="text-sm" style={{ color: 'var(--primary)' }}>
                    <strong>Текущая:</strong> {studyGoal.attraction.name}
                  </p>
                </div>
              )}
            </Card>

            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Опрос</h3>
              </div>
              <div className="relative h-[400px] overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  title="Google Form"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="md:hidden pb-20">
        {activeTab === 'home' && (
          <div className="space-y-4">
            <Card padding="lg">
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                {greeting || `Здравствуйте!`}
              </h2>
              <div className="text-center mt-4">
                <div className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                  {now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </Card>
            <Card padding="md">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Мои смены</span>
                  <span className="font-bold" style={{ color: 'var(--text)' }}>{shiftsForMonth.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>По графику</span>
                  <span className="font-bold" style={{ color: 'var(--text)' }}>{scheduleForMonth.length}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button onClick={() => setCurrentDate(prev => subMonths(prev, 1))} variant="ghost" size="sm" icon={<ChevronLeft className="h-4 w-4" />} />
              <h3 className="text-lg font-semibold capitalize" style={{ color: 'var(--text)' }}>{currentMonthLabel}</h3>
              <Button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} variant="ghost" size="sm" icon={<ChevronRight className="h-4 w-4" />} />
            </div>
            <Card padding="md">{renderCalendar()}</Card>
            <Card padding="md">{renderShiftsTable()}</Card>
          </div>
        )}

        {activeTab === 'schedule' && (
          <Card padding="md">{renderScheduleTable()}</Card>
        )}

        {activeTab === 'salary' && (
          <Card padding="md">{renderSalary()}</Card>
        )}

        {activeTab === 'form' && (
          <Card padding="md">
            <div className="relative h-[calc(100vh-250px)] rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                title="Form"
              />
            </div>
          </Card>
        )}

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
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
                className="flex flex-col items-center justify-center"
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

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={`Смена на ${formatDateStr(modalDate)}`}>
        <div className="p-6 space-y-4">
          {modalError && <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>{modalError}</div>}
          <div className="flex gap-2">
            <Button onClick={() => setIsFullDayModal(true)} variant={isFullDayModal ? 'primary' : 'secondary'} className="flex-1">Полная</Button>
            <Button onClick={() => setIsFullDayModal(false)} variant={!isFullDayModal ? 'primary' : 'secondary'} className="flex-1">Неполная</Button>
          </div>
          {!isFullDayModal && (
            <div className="grid grid-cols-2 gap-3">
              <select value={modalStartTime} onChange={e => setModalStartTime(e.target.value)} className="input">
                {START_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={modalEndTime} onChange={e => setModalEndTime(e.target.value)} className="input">
                {END_TIMES.filter(t => t > modalStartTime).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <textarea value={modalComment} onChange={e => setModalComment(e.target.value)} rows={3} className="input resize-none" placeholder="Комментарий..." maxLength={4096} />
          <Button onClick={handleAddShift} disabled={savingShift} variant="primary" size="lg" loading={savingShift} className="w-full">Добавить</Button>
        </div>
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Детали смены">
        {viewShift && (
          <div className="p-6 space-y-4">
            <div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Дата:</span>
              <p className="font-medium" style={{ color: 'var(--text)' }}>{format(parseISO(viewShift.work_date), 'dd MMMM yyyy', { locale: ru })}</p>
            </div>
            <div>
              <Badge variant={viewShift.is_full_day ? 'success' : 'warning'}>
                {viewShift.is_full_day ? 'Полная' : 'Неполная'}
              </Badge>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => setIsViewModalOpen(false)} variant="secondary" className="flex-1">Закрыть</Button>
              {dataManager?.canDeleteAvailability(viewShift).allowed && (
                <Button onClick={() => handleDeleteShift(viewShift)} variant="danger" className="flex-1">Удалить</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isTimeLogModalOpen} onClose={() => setIsTimeLogModalOpen(false)} title="Отметка времени">
        {selectedSchedule && (
          <div className="p-6 space-y-4">
            {timeLogError && <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>{timeLogError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <input type="time" value={actualStart} onChange={e => setActualStart(e.target.value)} className="input" />
              <input type="time" value={actualEnd} onChange={e => setActualEnd(e.target.value)} className="input" />
            </div>
            <Button onClick={handleSaveTimeLog} disabled={savingTimeLog} variant="primary" size="lg" loading={savingTimeLog} className="w-full">Сохранить</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
