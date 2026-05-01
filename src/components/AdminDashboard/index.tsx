import { useState, useEffect, useCallback } from 'react';
import { dbService, Employee, Attraction, ScheduleAssignment, EmployeeAvailability } from '../../lib/DatabaseService';
import { UserProfile } from '../../types';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card } from '../ui';
import { AdminStats } from './AdminStats';
import { AdminTabs } from './AdminTabs';
import { ShiftsManagement } from './ShiftsManagement';
import { ScheduleGenerator } from './ScheduleGenerator';
import { ManualScheduleComposer } from './ManualScheduleComposer';
import { ScheduleView } from './ScheduleView';
import { EmployeesList } from './EmployeesList';
import { AttractionsList } from '../AttractionsList';

// ============================================================
// Типы (экспортируем для совместимости)
// ============================================================
export type TabType = 'shifts' | 'schedule' | 'manual' | 'scheduleView' | 'employees' | 'attractions';

export interface AdminDashboardProps {
  profile: UserProfile;
  isSuperAdmin?: boolean;
}

// ============================================================
// Основной компонент
// ============================================================
export function AdminDashboard({ profile, isSuperAdmin = false }: AdminDashboardProps) {
  // 🔍 ОТЛАДКА - можно удалить после проверки
  console.log('🔐 AdminDashboard - isSuperAdmin:', isSuperAdmin);

  // ============================================================
  // Состояния навигации
  // ============================================================
  const [activeTab, setActiveTab] = useState<TabType>('shifts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // Состояния данных
  // ============================================================
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [shifts, setShifts] = useState<EmployeeAvailability[]>([]);

  // ============================================================
  // Инициализация данных
  // ============================================================
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!profile?.auth_uid) {
          throw new Error('auth_uid отсутствует в профиле');
        }

        const success = await dbService.init(profile.auth_uid);

        if (!success) {
          throw new Error('Не удалось инициализировать базу данных');
        }

        setEmployees(dbService.getEmployees());
        setAttractions(dbService.getAttractions());
        setScheduleAssignments(dbService.getScheduleAssignments());
        setShifts(dbService.getEmployeeAvailability());
      } catch (err: any) {
        console.error('[AdminDashboard] Ошибка инициализации:', err);
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [profile]);

  // ============================================================
  // Обновление данных
  // ============================================================
  const refreshData = useCallback(async () => {
    try {
      const success = await dbService.refresh();
      if (success) {
        setEmployees(dbService.getEmployees());
        setAttractions(dbService.getAttractions());
        setScheduleAssignments(dbService.getScheduleAssignments());
        setShifts(dbService.getEmployeeAvailability());
      }
    } catch (err) {
      console.error('[AdminDashboard] Ошибка обновления:', err);
    }
  }, []);

  // ============================================================
  // Рендер: Загрузка
  // ============================================================
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Загрузка панели управления...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Рендер: Ошибка
  // ============================================================
  if (error) {
    return (
      <Card padding="lg" className="max-w-2xl mx-auto">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--error-light)' }}>
            <AlertCircle className="h-6 w-6" style={{ color: 'var(--error)' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Ошибка загрузки
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // ============================================================
  // Рендер: Основной контент
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Статистика */}
      <AdminStats
        employees={employees}
        attractions={attractions}
        shifts={shifts}
        scheduleAssignments={scheduleAssignments}
      />

      {/* Навигация по вкладкам */}
      <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Контент вкладок */}
      <div className="animate-fade-in">
        {activeTab === 'shifts' && (
          <Card padding="md">
            <ShiftsManagement
              employees={employees}
              shifts={shifts}
              onRefreshData={refreshData}
            />
          </Card>
        )}

        {activeTab === 'schedule' && (
          <Card padding="md">
            <ScheduleGenerator
              profile={profile}
              isSuperAdmin={isSuperAdmin}
              onScheduleGenerated={refreshData}
            />
          </Card>
        )}

        {activeTab === 'manual' && (
          <Card padding="md">
            <ManualScheduleComposer
              employees={employees}
              attractions={attractions}
              scheduleAssignments={scheduleAssignments}
              onRefreshData={refreshData}
              isSuperAdmin={isSuperAdmin}
            />
          </Card>
        )}

        {activeTab === 'scheduleView' && (
          <Card padding="md">
            <ScheduleView
              employees={employees}
              attractions={attractions}
              scheduleAssignments={scheduleAssignments}
            />
          </Card>
        )}

        {activeTab === 'employees' && (
          <Card padding="md">
            <EmployeesList 
              isSuperAdmin={isSuperAdmin}
              currentUserId={profile.employee_id}
              onEmployeeUpdate={refreshData}
            />
          </Card>
        )}

        {activeTab === 'attractions' && (
          <Card padding="md">
            <AttractionsList
              isSuperAdmin={isSuperAdmin}
              onAttractionUpdate={refreshData}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
