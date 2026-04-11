import { useState, useEffect, useCallback } from 'react';
import { dbService, Employee, Attraction, ScheduleAssignment, EmployeeAvailability } from '../lib/DatabaseService';
import { UserProfile } from '../types';
import {
  Loader2, Calendar, LayoutGrid, Wand2, Users, Gamepad2, UserCheck,
  AlertCircle, Menu, X, Activity, TrendingUp, BarChart3
} from 'lucide-react';
import { ScheduleGenerator } from './ScheduleGenerator';
import { AttractionsList } from './AttractionsList';
import { EmployeesList } from './EmployeesList';
import { ManualScheduleComposer } from './ManualScheduleComposer';
import { ScheduleView } from './ScheduleView';
import { ShiftsManagement } from './ShiftsManagement';
import { Card, Badge } from './ui';

type TabType = 'shifts' | 'schedule' | 'manual' | 'scheduleView' | 'employees' | 'attractions';

interface AdminDashboardProps {
  profile: UserProfile;
  isSuperAdmin?: boolean;
}

export function AdminDashboard({ profile, isSuperAdmin = false }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('shifts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [shifts, setShifts] = useState<EmployeeAvailability[]>([]);

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

  const tabs = [
    { id: 'shifts' as const, label: 'Управление сменами', icon: Calendar, color: 'var(--primary)' },
    { id: 'schedule' as const, label: 'Генератор графика', icon: Wand2, color: 'var(--info)' },
    { id: 'manual' as const, label: 'Ручное составление', icon: UserCheck, color: 'var(--warning)' },
    { id: 'scheduleView' as const, label: 'График смен', icon: LayoutGrid, color: 'var(--success)' },
    { id: 'employees' as const, label: 'Сотрудники', icon: Users, color: 'var(--primary)' },
    { id: 'attractions' as const, label: 'Аттракционы', icon: Gamepad2, color: 'var(--warning)' },
  ];

  const getStats = () => {
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const monthShifts = shifts.filter(s => {
      const date = new Date(s.work_date);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    });

    const monthSchedule = scheduleAssignments.filter(s => {
      const date = new Date(s.work_date);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    });

    return {
      totalEmployees: employees.length,
      activeAttractions: attractions.length,
      shiftsThisMonth: monthShifts.length,
      scheduleThisMonth: monthSchedule.length,
    };
  };

  const stats = getStats();

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

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" variant="hover">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light)' }}>
              <Users className="h-6 w-6" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Всего сотрудников
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {stats.totalEmployees}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md" variant="hover">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-light)' }}>
              <Gamepad2 className="h-6 w-6" style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Активных аттракционов
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {stats.activeAttractions}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md" variant="hover">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light)' }}>
              <Calendar className="h-6 w-6" style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Смен в этом месяце
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {stats.shiftsThisMonth}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md" variant="hover">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--info-light)' }}>
              <LayoutGrid className="h-6 w-6" style={{ color: 'var(--info)' }} />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Назначений в графике
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {stats.scheduleThisMonth}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Навигация по вкладкам */}
      <div>
        {/* Десктоп - горизонтальные вкладки */}
        <div className="hidden lg:block">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all whitespace-nowrap"
                  style={{
                    backgroundColor: isActive ? 'var(--primary-light)' : 'var(--surface)',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Мобильный - меню */}
        <div className="lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border-2"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <div className="flex items-center gap-2">
              {tabs.find(t => t.id === activeTab)?.icon && (
                <>
                  {(() => {
                    const Icon = tabs.find(t => t.id === activeTab)!.icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                </>
              )}
              <span className="font-medium">
                {tabs.find(t => t.id === activeTab)?.label}
              </span>
            </div>
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          {mobileMenuOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={() => setMobileMenuOpen(false)}>
              <div
                className="w-64 h-full p-4 space-y-2 animate-slide-up"
                style={{ backgroundColor: 'var(--surface)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                    Разделы
                  </h2>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-opacity-10 transition"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                      style={{
                        backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text)',
                      }}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

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
            <EmployeesList employees={employees} />
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
