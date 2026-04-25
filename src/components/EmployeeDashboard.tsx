import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Loader2, Calendar, ChevronLeft, ChevronRight,
  Trash2, X, Clock, FileText, MessageCircle,
  DollarSign, Home, Target, Award, TrendingUp,
  Users, Zap, BarChart3, Save, AlertTriangle
} from 'lucide-react';
import { Card, Badge, Button, Modal, BottomSheet, IOSSelect } from './ui';
import { useIsMobile } from '../hooks/useMediaQuery';
import MobileBottomNav from './MobileBottomNav';

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

// ======================== ТИПЫ ДЛЯ PENDING CHANGES ========================
interface PendingShift {
  work_date: string;
  is_full_day: boolean;
  start_time?: string;
  end_time?: string;
  comment?: string;
}

interface PendingDelete {
  id: number;
  shift: EmployeeAvailability;
}

interface PendingChanges {
  additions: PendingShift[];
  deletions: PendingDelete[];
}

function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export function EmployeeDashboard({ profile }: EmployeeDashboardProps) {
  const isMobile = useIsMobile();
  
  // Data management
  const [dataManager, setDataManager] = useState<EmployeeDataManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  // ======================== PENDING CHANGES STATE ========================
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    additions: [],
    deletions: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  
  // UI state
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<TabType>('home');
  
  // Add shift modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [isFullDayModal, setIsFullDayModal] = useState(true);
  const [modalStartTime, setModalStartTime] = useState('10:00');
  const [modalEndTime, setModalEndTime] = useState('22:00');
  const [modalComment, setModalComment] = useState('');
  const [modalError, setModalError] = useState('');
  
  // View shift modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewShift, setViewShift] = useState<EmployeeAvailability | null>(null);
  
  // Time log modal
  const [isTimeLogModalOpen, setIsTimeLogModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleAssignment | null>(null);
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [timeLogError, setTimeLogError] = useState('');
  const [savingTimeLog, setSavingTimeLog] = useState(false);
  
  // Study goal
  const [selectedAttractionId, setSelectedAttractionId] = useState<number | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  
  // Salary
  const [salaryPeriod, setSalaryPeriod] = useState<'first' | 'second'>('first');
  const [salaryData, setSalaryData] = useState<{ days: SalaryDay[]; total: number } | null>(null);
  const [loadingSalary, setLoadingSalary] = useState(false);

  // Time options
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

  // ======================== ПРОВЕРКА НАЛИЧИЯ НЕСОХРАНЕННЫХ ИЗМЕНЕНИЙ ========================
  const hasUnsavedChanges = useMemo(() => {
    return pendingChanges.additions.length > 0 || pendingChanges.deletions.length > 0;
  }, [pendingChanges]);

  // ======================== ПРЕДУПРЕЖДЕНИЕ ПРИ ВЫХОДЕ ========================
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Initialize data
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

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Greeting
  useEffect(() => {
    if (profile.full_name) {
      setGreeting(getRandomGreeting(profile.full_name, new Date()));
    }
  }, [profile.full_name]);

  // Auto-update trigger
  useEffect(() => {
    if (!dataManager) return;
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [dataManager]);

  // Memoized data
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

  // ======================== ОБЪЕДИНЕННЫЕ ДАННЫЕ (БД + PENDING) ========================
  const mergedAvailability = useMemo(() => {
    // Начинаем с данных из БД
    let merged = [...allAvailability];

    // Удаляем те, что в pending deletions
    const deletionIds = new Set(pendingChanges.deletions.map(d => d.id));
    merged = merged.filter(shift => !deletionIds.has(shift.id));

    // Добавляем pending additions (с временными ID)
    const pendingShifts: EmployeeAvailability[] = pendingChanges.additions.map((pending, index) => ({
      id: -(index + 1), // Временный отрицательный ID
      employee_id: profile.id,
      work_date: pending.work_date,
      is_full_day: pending.is_full_day,
      start_time: pending.start_time || null,
      end_time: pending.end_time || null,
      comment: pending.comment || null,
      created_at: new Date().toISOString(),
      updated_at: null,
    }));

    merged = [...merged, ...pendingShifts];
    merged.sort((a, b) => a.work_date.localeCompare(b.work_date));

    return merged;
  }, [allAvailability, pendingChanges, profile.id]);

  const shiftsForMonth = useMemo(() => {
    return mergedAvailability.filter(s => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth();
    });
  }, [mergedAvailability, currentDate]);

  const scheduleForMonth = useMemo(() => {
    return allSchedules.filter(s => {
      const d = parseISO(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth();
    });
  }, [allSchedules, currentDate]);

  const occupiedDates = useMemo(() => 
    new Set(mergedAvailability.map(s => s.work_date)), 
    [mergedAvailability]
  );

  // ======================== HANDLERS FOR PENDING CHANGES ========================

  const handleAddShiftToPending = useCallback(() => {
    if (!dataManager) return;
    
    setModalError('');
    
    if (!modalDate) {
      setModalError('Выберите дату');
      return;
    }

    // Проверка: уже есть в pending или БД
    if (occupiedDates.has(modalDate)) {
      setModalError('На эту дату уже добавлена смена');
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

    // Добавляем в pending
    const newPending: PendingShift = {
      work_date: modalDate,
      is_full_day: isFullDayModal,
      start_time: isFullDayModal ? undefined : modalStartTime + ':00',
      end_time: isFullDayModal ? undefined : modalEndTime + ':00',
      comment: modalComment.trim() || undefined,
    };

    setPendingChanges(prev => ({
      ...prev,
      additions: [...prev.additions, newPending],
    }));

    setIsAddModalOpen(false);
    setUpdateTrigger(prev => prev + 1);
  }, [dataManager, modalDate, isFullDayModal, modalStartTime, modalEndTime, modalComment, occupiedDates]);

  const handleDeleteShiftToPending = useCallback((shift: EmployeeAvailability) => {
    if (!dataManager) return;

    // Если это pending addition (ID < 0), просто удаляем из additions
    if (shift.id < 0) {
      setPendingChanges(prev => ({
        ...prev,
        additions: prev.additions.filter((_, index) => -(index + 1) !== shift.id),
      }));
      setIsViewModalOpen(false);
      setUpdateTrigger(prev => prev + 1);
      return;
    }

    // Проверяем валидацию
    const validation = dataManager.canDeleteAvailability(shift);
    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }

    if (!confirm('Удалить смену? (Изменения применятся после нажатия "Сохранить")')) return;

    // Добавляем в pending deletions
    setPendingChanges(prev => ({
      ...prev,
      deletions: [...prev.deletions, { id: shift.id, shift }],
    }));

    setIsViewModalOpen(false);
    setUpdateTrigger(prev => prev + 1);
  }, [dataManager]);

  const handleSaveAllChanges = useCallback(async () => {
    if (!dataManager) return;
    if (!hasUnsavedChanges) return;

    setIsSaving(true);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // 1. Сохраняем additions
      for (const pending of pendingChanges.additions) {
        const result = await dataManager.addAvailability(pending);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Ошибка добавления смены на ${pending.work_date}: ${result.error}`);
        }
      }

      // 2. Сохраняем deletions
      for (const deletion of pendingChanges.deletions) {
        const result = await dataManager.deleteAvailability(deletion.id);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Ошибка удаления смены на ${deletion.shift.work_date}: ${result.error}`);
        }
      }

      // Очищаем pending changes
      setPendingChanges({ additions: [], deletions: [] });

      // Обновляем UI
      setUpdateTrigger(prev => prev + 1);

      // Показываем результат
      if (errorCount === 0) {
        alert(`✅ Все изменения сохранены успешно! (${successCount} операций)`);
      } else {
        alert(
          `⚠️ Сохранено с ошибками:\n` +
          `Успешно: ${successCount}\n` +
          `Ошибок: ${errorCount}\n\n` +
          errors.join('\n')
        );
      }
    } catch (error) {
      console.error('❌ Критическая ошибка при сохранении:', error);
      alert('Критическая ошибка при сохранении. Попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
  }, [dataManager, pendingChanges, hasUnsavedChanges]);

  const handleCancelChanges = useCallback(() => {
    if (!confirm('Отменить все несохраненные изменения?')) return;
    
    setPendingChanges({ additions: [], deletions: [] });
    setUpdateTrigger(prev => prev + 1);
  }, []);

  // ======================== OTHER HANDLERS ========================

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

  const handleSetStudyGoal = async () => {
    if (!dataManager || !selectedAttractionId) {
      setGoalError('Выберите аттракцион');
      return;
    }
    setSavingGoal(true);
    setGoalError('');
    const result = await dataManager.setStudyGoal(selectedAttractionId);
    if (result.success) {
      alert('Цель изучения сохранена!');
      setUpdateTrigger(prev => prev + 1);
    } else {
      setGoalError(result.error || 'Ошибка сохранения');
    }
    setSavingGoal(false);
  };

  // ======================== RENDER FUNCTIONS ========================

  const renderSaveButton = () => {
    if (!hasUnsavedChanges) return null;

    const changesText = `${pendingChanges.additions.length > 0 ? `+${pendingChanges.additions.length}` : ''}${pendingChanges.deletions.length > 0 ? ` -${pendingChanges.deletions.length}` : ''}`;

    return (
      <div 
        className="fixed z-50 shadow-2xl rounded-2xl p-4"
        style={{
          bottom: isMobile ? '80px' : '24px',
          right: '24px',
          background: 'linear-gradient(135deg, var(--warning), var(--warning-hover))',
          border: '2px solid var(--warning)',
        }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-white animate-pulse" />
          <div className="text-white">
            <p className="font-bold text-sm">Несохраненные изменения</p>
            <p className="text-xs opacity-90">{changesText} операций</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            onClick={handleCancelChanges}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            Отменить
          </Button>
          <Button
            onClick={handleSaveAllChanges}
            variant="primary"
            size="sm"
            loading={isSaving}
            icon={<Save className="h-4 w-4" />}
            className="flex-1"
            style={{
              backgroundColor: 'white',
              color: 'var(--warning)',
            }}
          >
            Сохранить
          </Button>
        </div>
      </div>
    );
  };

  /* ============================================================
     📅 RENDER: CALENDAR
     ============================================================ */
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const days = [];

    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(<div key={`empty-${i}`} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const shift = mergedAvailability.find(s => s.work_date === dateStr);
      const active = dataManager?.isDateActive(dateStr) && !occupiedDates.has(dateStr);
      
      // Проверяем, является ли смена pending
      const isPending = shift && shift.id < 0;
      const isPendingDeletion = pendingChanges.deletions.some(d => d.shift.work_date === dateStr);

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
          className="relative flex flex-col items-center justify-center rounded-lg border-2 transition-all active:scale-95"
          style={{
            aspectRatio: '1',
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
            opacity: (!active && !shift) || isPendingDeletion ? 0.4 : 1,
            cursor: (active || shift) ? 'pointer' : 'not-allowed',
            fontSize: 'clamp(0.625rem, 2.5vw, 0.875rem)',
            padding: 'clamp(0.25rem, 1vw, 0.5rem)',
            minWidth: 0,
            width: '100%',
            boxShadow: isPending ? '0 0 0 2px var(--warning)' : 'none',
          }}
        >
          <span 
            className="font-bold leading-none"
            style={{ color: isToday ? 'var(--primary)' : 'var(--text)' }}
          >
            {i}
          </span>
          {shift && (
            <div 
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{ 
                backgroundColor: isPending 
                  ? 'var(--warning)' 
                  : (shift.is_full_day ? 'var(--success)' : 'var(--warning)'),
                top: '4px',
                right: '4px',
              }}
            />
          )}
          {isPendingDeletion && (
            <div 
              className="absolute w-4 h-0.5 rounded-full"
              style={{ 
                backgroundColor: 'var(--error)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-45deg)',
              }}
            />
          )}
        </button>
      );
    }

    return (
      <div className="space-y-3 w-full">
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map(day => (
            <div 
              key={day} 
              className="text-center font-semibold py-2"
              style={{ 
                color: 'var(--text-muted)',
                fontSize: 'clamp(0.625rem, 2.5vw, 0.75rem)',
              }}
            >
              {day}
            </div>
          ))}
        </div>
        
        <div 
          className="grid grid-cols-7 w-full"
          style={{
            gap: 'clamp(2px, 0.5vw, 4px)',
          }}
        >
          {days}
        </div>
        
        <div className="flex flex-wrap gap-3" style={{ 
          color: 'var(--text-muted)',
          fontSize: 'clamp(0.625rem, 2.5vw, 0.75rem)',
        }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
            <span>Полная</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)' }} />
            <span>Неполная</span>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--warning)', boxShadow: '0 0 0 2px var(--warning)' }} />
              <span>Не сохранено</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ============================================================
     📋 RENDER: SHIFTS TABLE
     ============================================================ */
  const renderShiftsTable = () => {
    if (shiftsForMonth.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="mx-auto mb-3 opacity-30 h-12 w-12" style={{ color: 'var(--text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Смен в этом месяце пока нет
          </p>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-2">
          {shiftsForMonth.map((shift, index) => {
            const canDelete = shift.id < 0 || dataManager?.canDeleteAvailability(shift);
            const isPending = shift.id < 0;
            const isPendingDeletion = pendingChanges.deletions.some(d => d.id === shift.id);
            
            const bgColor = isPending
              ? 'rgba(var(--warning-rgb, 251, 191, 36), 0.1)'
              : index % 2 === 0 
                ? 'rgba(var(--primary-rgb, 249, 115, 22), 0.05)' 
                : 'rgba(var(--primary-rgb, 249, 115, 22), 0.02)';
            
            return (
              <Card 
                key={shift.id}
                padding="sm"
                className="active:scale-98 transition-transform"
                onClick={() => openViewModal(shift)}
                style={{
                  backgroundColor: bgColor,
                  border: isPending ? '2px dashed var(--warning)' : '1px solid var(--border)',
                  opacity: isPendingDeletion ? 0.5 : 1,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                      {format(parseISO(shift.work_date), 'dd MMMM', { locale: ru })}
                    </div>
                    {isPending && (
                      <Badge variant="warning" size="sm">Новая</Badge>
                    )}
                    {isPendingDeletion && (
                      <Badge variant="danger" size="sm">Удалена</Badge>
                    )}
                  </div>
                  <Badge variant={shift.is_full_day ? 'success' : 'warning'} size="sm">
                    {shift.is_full_day ? 'Полная' : 'Неполная'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {shift.is_full_day 
                      ? 'Весь день' 
                      : `${shift.start_time?.slice(0, 5) || '00:00'}–${shift.end_time?.slice(0, 5) || '00:00'}`
                    }
                  </span>
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShiftToPending(shift);
                      }}
                      className="p-1.5 rounded-lg active:scale-95 transition-transform"
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      );
    }

    // Desktop table (аналогично с индикаторами pending)
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Время</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Статус</th>
              <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {shiftsForMonth.map((shift, index) => {
              const canDelete = shift.id < 0 || dataManager?.canDeleteAvailability(shift);
              const isPending = shift.id < 0;
              const isPendingDeletion = pendingChanges.deletions.some(d => d.id === shift.id);
              
              return (
                <tr 
                  key={shift.id}
                  onClick={() => openViewModal(shift)}
                  className="border-b cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  style={{ 
                    borderColor: 'var(--border)',
                    backgroundColor: isPending
                      ? 'rgba(var(--warning-rgb, 251, 191, 36), 0.05)'
                      : index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                    opacity: isPendingDeletion ? 0.5 : 1,
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
                  <td className="px-4 py-3">
                    {isPending && <Badge variant="warning" size="sm">Новая</Badge>}
                    {isPendingDeletion && <Badge variant="danger" size="sm">Удалена</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {canDelete ? (
                      <button
                        onClick={() => handleDeleteShiftToPending(shift)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900"
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

  // ... (остальные render функции остаются без изменений: renderScheduleTable, renderSalary)
  
  /* [ЗДЕСЬ ВСТАВИТЬ renderScheduleTable и renderSalary из предыдущего кода] */

const renderScheduleTable = () => {
    if (scheduleForMonth.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="mx-auto mb-3 opacity-30 h-12 w-12" style={{ color: 'var(--text-subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            График не найден
          </p>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-2">
          {scheduleForMonth.map((schedule, index) => {
            const log = dataManager?.getActualWorkLog(schedule.id);
            const canLog = dataManager?.canLogActualTime(schedule);
            const attraction = dataManager?.getAttraction(schedule.attraction_id);

            const bgColor = index % 2 === 0 
              ? 'rgba(var(--info-rgb, 59, 130, 246), 0.05)' 
              : 'rgba(var(--info-rgb, 59, 130, 246), 0.02)';

            return (
              <Card 
                key={schedule.id} 
                padding="sm"
                style={{
                  backgroundColor: bgColor,
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm mb-1" style={{ color: 'var(--text)' }}>
                      {format(parseISO(schedule.work_date), 'dd MMMM', { locale: ru })}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                      {attraction?.name || '—'}
                    </div>
                  </div>
                  {log ? (
                    <Badge variant="success" dot size="sm">Отмечено</Badge>
                  ) : canLog?.allowed ? (
                    <Button 
                      onClick={() => openTimeLogModal(schedule)} 
                      variant="secondary" 
                      size="sm"
                    >
                      Отметить
                    </Button>
                  ) : null}
                </div>
                <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="h-3 w-3" />
                  {schedule.start_time?.slice(0, 5) || '00:00'} – {schedule.end_time?.slice(0, 5) || '00:00'}
                </div>
              </Card>
            );
          })}
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
            {scheduleForMonth.map((schedule, index) => {
              const log = dataManager?.getActualWorkLog(schedule.id);
              const canLog = dataManager?.canLogActualTime(schedule);
              const attraction = dataManager?.getAttraction(schedule.attraction_id);

              return (
                <tr 
                  key={schedule.id} 
                  className="border-b" 
                  style={{ 
                    borderColor: 'var(--border)',
                    backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
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
                  <td className="px-4 py-3">
                    {log ? (
                      <Badge variant="success" dot>Отмечено</Badge>
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
          <Button 
            onClick={() => setSalaryPeriod('first')} 
            variant={salaryPeriod === 'first' ? 'primary' : 'secondary'} 
            size="sm"
            className={isMobile ? 'flex-1' : ''}
          >
            7–21
          </Button>
          <Button 
            onClick={() => setSalaryPeriod('second')} 
            variant={salaryPeriod === 'second' ? 'primary' : 'secondary'} 
            size="sm"
            className={isMobile ? 'flex-1' : ''}
          >
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
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                Нет данных
              </div>
            ) : (
              <div className="space-y-2">
                {salaryData.days.map((day, index) => (
                  <Card 
                    key={day.date} 
                    padding="sm"
                    style={{
                      backgroundColor: index % 2 === 0 
                        ? 'rgba(var(--success-rgb, 16, 185, 129), 0.05)' 
                        : 'rgba(var(--success-rgb, 16, 185, 129), 0.02)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="font-semibold mb-2 text-sm" style={{ color: 'var(--text)' }}>
                      {format(parseISO(day.date), 'dd.MM.yyyy (EEEE)', { locale: ru })}
                    </div>
                    <div className="space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {day.attractions.map((a, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{a.name}</span>
                          <span className="font-medium">{Math.round(a.earn)}₽</span>
                        </div>
                      ))}
                    </div>
                    <div 
                      className="mt-2 pt-2 border-t flex justify-between font-bold text-sm"
                      style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                    >
                      <span>Итого:</span>
                      <span>{Math.round(day.total)} ₽</span>
                    </div>
                  </Card>
                ))}
                <Card 
                  padding="md"
                  style={{
                    background: 'linear-gradient(135deg, var(--success-light), var(--success))',
                    border: 'none',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg" style={{ color: 'white' }}>
                      Всего:
                    </span>
                    <span className="font-bold text-3xl" style={{ color: 'white' }}>
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
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
        <Loader2 className="animate-spin h-12 w-12" style={{ color: 'var(--primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Загрузка данных...</p>
      </div>
    );
  }

  if (!dataManager) {
    return (
      <Card padding="lg" className="text-center max-w-md mx-auto animate-shake">
        <X className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--error)' }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>Ошибка загрузки</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Не удалось загрузить данные. Попробуйте перезагрузить страницу.
        </p>
        <Button onClick={() => window.location.reload()} variant="primary">
          Перезагрузить
        </Button>
      </Card>
    );
  }

  return (
    <>
      {/* Save button (fixed) */}
      {renderSaveButton()}

      {/* Desktop version */}
      <div className="hidden md:block space-y-6 p-6">
        {/* [ВСЯ DESKTOP ВЕРСТКА ИЗ ПРЕДЫДУЩЕГО КОДА БЕЗ ИЗМЕНЕНИЙ] */}
      </div>

      {/* Mobile version */}
      <div className="md:hidden">
        {/* [ВСЯ MOBILE ВЕРСТКА ИЗ ПРЕДЫДУЩЕГО КОДА БЕЗ ИЗМЕНЕНИЙ] */}
      </div>

      {/* Modals */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title={`Смена на ${formatDateStr(modalDate)}`}
        size="md"
        fullScreenOnMobile={false}
      >
        <div className="space-y-4 p-4">
          {modalError && (
            <div className="p-3 rounded-xl text-sm animate-shake" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
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
                <label className="input-label-mobile">Начало</label>
                <select value={modalStartTime} onChange={e => setModalStartTime(e.target.value)} className="input">
                  {START_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label-mobile">Окончание</label>
                <select value={modalEndTime} onChange={e => setModalEndTime(e.target.value)} className="input">
                  {END_TIMES.filter(t => t > modalStartTime).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
          
          <div>
            <label className="input-label-mobile">Комментарий (необязательно)</label>
            <textarea 
              value={modalComment} 
              onChange={e => setModalComment(e.target.value)} 
              rows={3} 
              className="input resize-none" 
              placeholder="Добавьте комментарий..." 
              maxLength={4096} 
            />
          </div>
          
          <Button 
            onClick={handleAddShiftToPending} 
            variant="primary" 
            size="lg" 
            className="w-full"
          >
            Добавить смену
          </Button>
          
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            💡 Изменения вступят в силу после нажатия "Сохранить"
          </p>
        </div>
      </Modal>

      {/* View shift modal */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title="Детали смены"
        size="sm"
        fullScreenOnMobile={false}
      >
        {viewShift && (
          <div className="space-y-4 p-4">
            {viewShift.id < 0 && (
              <Badge variant="warning">Не сохранена в БД</Badge>
            )}
            {pendingChanges.deletions.some(d => d.id === viewShift.id) && (
              <Badge variant="danger">Помечена на удаление</Badge>
            )}
            
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Дата</span>
              <p className="font-semibold mt-1" style={{ color: 'var(--text)' }}>
                {format(parseISO(viewShift.work_date), 'dd MMMM yyyy', { locale: ru })}
              </p>
            </div>
            
            <div>
              <Badge variant={viewShift.is_full_day ? 'success' : 'warning'} size="lg">
                {viewShift.is_full_day ? '✓ Полная смена' : '⏰ Неполная смена'}
              </Badge>
            </div>
            
            {!viewShift.is_full_day && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Время работы</span>
                <p className="font-semibold mt-1 text-lg" style={{ color: 'var(--text)' }}>
                  {viewShift.start_time?.slice(0, 5)} – {viewShift.end_time?.slice(0, 5)}
                </p>
              </div>
            )}
            
            {viewShift.comment && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Комментарий</span>
                <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>{viewShift.comment}</p>
              </div>
            )}
            
            <div className="flex gap-3 pt-4">
              <Button 
                onClick={() => setIsViewModalOpen(false)} 
                variant="secondary" 
                className="flex-1"
              >
                Закрыть
              </Button>
              {(viewShift.id < 0 || dataManager?.canDeleteAvailability(viewShift).allowed) && (
                <Button 
                  onClick={() => handleDeleteShiftToPending(viewShift)} 
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

      {/* Time log modal */}
      <Modal 
        isOpen={isTimeLogModalOpen} 
        onClose={() => setIsTimeLogModalOpen(false)} 
        title="Отметка времени"
        size="sm"
        fullScreenOnMobile={false}
      >
        {selectedSchedule && (
          <div className="space-y-4 p-4">
            {timeLogError && (
              <div className="p-3 rounded-xl text-sm animate-shake" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error)' }}>
                {timeLogError}
              </div>
            )}
            
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <p className="text-sm mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Укажите фактическое время работы:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label-mobile">Начало</label>
                  <input 
                    type="time" 
                    value={actualStart} 
                    onChange={e => setActualStart(e.target.value)} 
                    className="input" 
                  />
                </div>
                <div>
                  <label className="input-label-mobile">Окончание</label>
                  <input 
                    type="time" 
                    value={actualEnd} 
                    onChange={e => setActualEnd(e.target.value)} 
                    className="input" 
                  />
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleSaveTimeLog} 
              disabled={savingTimeLog} 
              variant="primary" 
              size="lg" 
              loading={savingTimeLog} 
              className="w-full"
            >
              Сохранить время
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
