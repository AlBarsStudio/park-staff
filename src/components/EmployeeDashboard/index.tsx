import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  initializeEmployeeData, 
  destroyEmployeeData,
  type EmployeeDataManager,
  type Employee,
  type EmployeeAvailability,
  type ScheduleAssignment,
} from '../../lib/employeeDatabase';
import { getRandomGreeting } from '../../utils/greetings';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { EmployeeDashboardModals } from './EmployeeDashboardModals';
import { EmployeeCalendar } from './EmployeeCalendar';
import { EmployeeShiftsTable } from './EmployeeShiftsTable';
import { EmployeeScheduleTable } from './EmployeeScheduleTable';
import { EmployeeSalary } from './EmployeeSalary';
import { EmployeePriorities } from './EmployeePriorities';
import { EmployeeStudyGoal } from './EmployeeStudyGoal';
import { EmployeeStats } from './EmployeeStats';
import MobileBottomNav from '../MobileBottomNav';
import { Loader2, X, Home, Calendar, Clock, DollarSign, FileText } from 'lucide-react';
import { Card, Button } from '../ui';

interface EmployeeDashboardProps {
  profile: Employee;
}

export type TabType = 'home' | 'calendar' | 'schedule' | 'salary' | 'form';

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

export interface PendingChanges {
  additions: PendingShift[];
  deletions: PendingDelete[];
}

export function EmployeeDashboard({ profile }: EmployeeDashboardProps) {
  const isMobile = useIsMobile();
  
  // Data management
  const [dataManager, setDataManager] = useState<EmployeeDataManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  // Pending changes
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    additions: [],
    deletions: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  
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
  const [salaryData, setSalaryData] = useState<any>(null);
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

  const hasUnsavedChanges = useMemo(() => {
    return pendingChanges.additions.length > 0 || pendingChanges.deletions.length > 0;
  }, [pendingChanges]);

  // Warning on exit
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

  const mergedAvailability = useMemo(() => {
    let merged = [...allAvailability];
    const deletionIds = new Set(pendingChanges.deletions.map(d => d.id));
    merged = merged.filter(shift => !deletionIds.has(shift.id));

    const pendingShifts: EmployeeAvailability[] = pendingChanges.additions.map((pending, index) => ({
      id: -(index + 1),
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
      const d = new Date(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth();
    });
  }, [mergedAvailability, currentDate]);

  const scheduleForMonth = useMemo(() => {
    return allSchedules.filter(s => {
      const d = new Date(s.work_date);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth();
    });
  }, [allSchedules, currentDate]);

  const occupiedDates = useMemo(() => 
    new Set(mergedAvailability.map(s => s.work_date)), 
    [mergedAvailability]
  );

  // Handlers
  const handleAddShiftToPending = useCallback(() => {
    if (!dataManager) return;
    
    setModalError('');
    
    if (!modalDate) {
      setModalError('Выберите дату');
      return;
    }

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

    if (shift.id < 0) {
      setPendingChanges(prev => ({
        ...prev,
        additions: prev.additions.filter((_, index) => -(index + 1) !== shift.id),
      }));
      setIsViewModalOpen(false);
      setUpdateTrigger(prev => prev + 1);
      return;
    }

    const validation = dataManager.canDeleteAvailability(shift);
    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }

    if (!confirm('Удалить смену? (Изменения применятся после нажатия "Сохранить")')) return;

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

      for (const pending of pendingChanges.additions) {
        const result = await dataManager.addAvailability(pending);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Ошибка добавления смены на ${pending.work_date}: ${result.error}`);
        }
      }

      for (const deletion of pendingChanges.deletions) {
        const result = await dataManager.deleteAvailability(deletion.id);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`Ошибка удаления смены на ${deletion.shift.work_date}: ${result.error}`);
        }
      }

      setPendingChanges({ additions: [], deletions: [] });
      setUpdateTrigger(prev => prev + 1);

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
      <SaveChangesButton
        pendingChanges={pendingChanges}
        isSaving={isSaving}
        onSave={handleSaveAllChanges}
        onCancel={handleCancelChanges}
      />

      {/* DESKTOP VERSION */}
      <div className="hidden md:block space-y-6 p-6">
        <EmployeeStats
          profile={profile}
          greeting={greeting}
          shiftsCount={shiftsForMonth.length}
          scheduleCount={scheduleForMonth.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <EmployeeCalendar
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              mergedAvailability={mergedAvailability}
              occupiedDates={occupiedDates}
              pendingChanges={pendingChanges}
              dataManager={dataManager}
              openAddModal={openAddModal}
              openViewModal={openViewModal}
            />

            <EmployeeShiftsTable
              shiftsForMonth={shiftsForMonth}
              pendingChanges={pendingChanges}
              dataManager={dataManager}
              openViewModal={openViewModal}
            />

            <EmployeeScheduleTable
              scheduleForMonth={scheduleForMonth}
              dataManager={dataManager}
              openTimeLogModal={openTimeLogModal}
            />

            <EmployeeSalary
              salaryPeriod={salaryPeriod}
              setSalaryPeriod={setSalaryPeriod}
              salaryData={salaryData}
              loadingSalary={loadingSalary}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <EmployeePriorities
              priorities={priorities}
              attractions={attractions}
            />

            <EmployeeStudyGoal
              studyGoal={studyGoal}
              availableAttractions={availableAttractionsForGoal}
              selectedAttractionId={selectedAttractionId}
              setSelectedAttractionId={setSelectedAttractionId}
              handleSetStudyGoal={handleSetStudyGoal}
              savingGoal={savingGoal}
              goalError={goalError}
            />

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

      {/* MOBILE VERSION */}
      <div className="md:hidden">
        <div className="has-mobile-bottom-nav">
          {activeTab === 'home' && (
            <div className="space-y-3 p-3">
              <EmployeeStats
                profile={profile}
                greeting={greeting}
                shiftsCount={shiftsForMonth.length}
                scheduleCount={scheduleForMonth.length}
                now={now}
              />

              <EmployeePriorities
                priorities={priorities}
                attractions={attractions}
              />

              <EmployeeStudyGoal
                studyGoal={studyGoal}
                availableAttractions={availableAttractionsForGoal}
                selectedAttractionId={selectedAttractionId}
                setSelectedAttractionId={setSelectedAttractionId}
                handleSetStudyGoal={handleSetStudyGoal}
                savingGoal={savingGoal}
                goalError={goalError}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-3 p-3">
              <EmployeeCalendar
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                mergedAvailability={mergedAvailability}
                occupiedDates={occupiedDates}
                pendingChanges={pendingChanges}
                dataManager={dataManager}
                openAddModal={openAddModal}
                openViewModal={openViewModal}
              />

              <EmployeeShiftsTable
                shiftsForMonth={shiftsForMonth}
                pendingChanges={pendingChanges}
                dataManager={dataManager}
                openViewModal={openViewModal}
              />
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="p-3">
              <EmployeeScheduleTable
                scheduleForMonth={scheduleForMonth}
                dataManager={dataManager}
                openTimeLogModal={openTimeLogModal}
              />
            </div>
          )}

          {activeTab === 'salary' && (
            <div className="p-3">
              <EmployeeSalary
                salaryPeriod={salaryPeriod}
                setSalaryPeriod={setSalaryPeriod}
                salaryData={salaryData}
                loadingSalary={loadingSalary}
              />
            </div>
          )}

          {activeTab === 'form' && (
            <div className="p-3">
              <Card padding="sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Опрос</h3>
                </div>
                <div className="relative rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)', height: 'calc(100vh - 180px)' }}>
                  <iframe
                    src="https://docs.google.com/forms/d/e/1FAIpQLSczZC5_pSsbgQrjhKpfis9K0kBD6qLMWa6gWn11brFQ-v-YNQ/viewform?embedded=true"
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    title="Form"
                  />
                </div>
              </Card>
            </div>
          )}
        </div>

        <MobileBottomNav
          activeTab={activeTab}
          items={[
            {
              id: 'home',
              label: 'Главная',
              icon: <Home className="w-6 h-6" />,
              onClick: () => setActiveTab('home')
            },
            {
              id: 'calendar',
              label: 'Календарь',
              icon: <Calendar className="w-6 h-6" />,
              onClick: () => setActiveTab('calendar')
            },
            {
              id: 'schedule',
              label: 'График',
              icon: <Clock className="w-6 h-6" />,
              onClick: () => setActiveTab('schedule')
            },
            {
              id: 'salary',
              label: 'Зарплата',
              icon: <DollarSign className="w-6 h-6" />,
              onClick: () => setActiveTab('salary')
            },
            {
              id: 'form',
              label: 'Опрос',
              icon: <FileText className="w-6 h-6" />,
              onClick: () => setActiveTab('form')
            },
          ]}
        />
      </div>

      <EmployeeDashboardModals
        isAddModalOpen={isAddModalOpen}
        setIsAddModalOpen={setIsAddModalOpen}
        modalDate={modalDate}
        isFullDayModal={isFullDayModal}
        setIsFullDayModal={setIsFullDayModal}
        modalStartTime={modalStartTime}
        setModalStartTime={setModalStartTime}
        modalEndTime={modalEndTime}
        setModalEndTime={setModalEndTime}
        modalComment={modalComment}
        setModalComment={setModalComment}
        modalError={modalError}
        handleAddShiftToPending={handleAddShiftToPending}
        START_TIMES={START_TIMES}
        END_TIMES={END_TIMES}
        isViewModalOpen={isViewModalOpen}
        setIsViewModalOpen={setIsViewModalOpen}
        viewShift={viewShift}
        handleDeleteShiftToPending={handleDeleteShiftToPending}
        pendingChanges={pendingChanges}
        dataManager={dataManager}
        isTimeLogModalOpen={isTimeLogModalOpen}
        setIsTimeLogModalOpen={setIsTimeLogModalOpen}
        selectedSchedule={selectedSchedule}
        actualStart={actualStart}
        setActualStart={setActualStart}
        actualEnd={actualEnd}
        setActualEnd={setActualEnd}
        timeLogError={timeLogError}
        handleSaveTimeLog={handleSaveTimeLog}
        savingTimeLog={savingTimeLog}
      />
    </>
  );
}
