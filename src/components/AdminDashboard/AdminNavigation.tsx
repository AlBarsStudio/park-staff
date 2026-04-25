import { useState } from 'react';
import {
  Calendar,
  LayoutGrid,
  Wand2,
  Users,
  Gamepad2,
  UserCheck,
  Star,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { TabType } from './index';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

interface AdminNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isSuperAdmin: boolean;
}

export function AdminNavigation({
  activeTab,
  onTabChange,
  isSuperAdmin,
}: AdminNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: Tab[] = [
    { id: 'shifts', label: 'Управление сменами', icon: Calendar },
    { id: 'schedule', label: 'Генератор графика', icon: Wand2 },
    { id: 'manual', label: 'Ручное составление', icon: UserCheck },
    { id: 'scheduleView', label: 'График смен', icon: LayoutGrid },
    { id: 'employees', label: 'Сотрудники', icon: Users },
    ...(isSuperAdmin
      ? [{ id: 'priorities' as TabType, label: 'Приоритеты', icon: Star }]
      : []),
  ];

  const handleTabChange = (tab: TabType) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  const activeTabData = tabs.find((t) => t.id === activeTab);

  return (
    <div>
      {/* Десктоп */}
      <div className="hidden lg:block">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
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

      {/* Мобильный */}
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
            {activeTabData && (
              <activeTabData.icon className="h-5 w-5" />
            )}
            <span className="font-medium">{activeTabData?.label}</span>
          </div>
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-64 h-full p-4 space-y-2 animate-slide-up"
              style={{ backgroundColor: 'var(--surface)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between mb-4 pb-4 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                  Разделы
                </h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg transition"
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
                    onClick={() => handleTabChange(tab.id)}
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
  );
}
