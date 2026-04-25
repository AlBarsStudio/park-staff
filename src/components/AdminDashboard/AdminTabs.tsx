import { useState } from 'react';
import { Calendar, LayoutGrid, Wand2, Users, Gamepad2, UserCheck, Menu, X } from 'lucide-react';
import { cn } from '../../utils/cn';

type TabType = 'shifts' | 'schedule' | 'manual' | 'scheduleView' | 'employees' | 'attractions';

interface AdminTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ============================================================
  // Конфигурация вкладок
  // ============================================================
  const tabs = [
    { id: 'shifts' as const, label: 'Управление сменами', icon: Calendar, color: 'var(--primary)' },
    { id: 'schedule' as const, label: 'Генератор графика', icon: Wand2, color: 'var(--info)' },
    { id: 'manual' as const, label: 'Ручное составление', icon: UserCheck, color: 'var(--warning)' },
    { id: 'scheduleView' as const, label: 'График смен', icon: LayoutGrid, color: 'var(--success)' },
    { id: 'employees' as const, label: 'Сотрудники', icon: Users, color: 'var(--primary)' },
    { id: 'attractions' as const, label: 'Аттракционы', icon: Gamepad2, color: 'var(--warning)' },
  ];

  // ============================================================
  // Обработчики
  // ============================================================
  const handleTabClick = (tabId: TabType) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  // ============================================================
  // Рендер
  // ============================================================
  return (
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
                onClick={() => handleTabClick(tab.id)}
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
            {tabs.find((t) => t.id === activeTab)?.icon && (
              <>
                {(() => {
                  const Icon = tabs.find((t) => t.id === activeTab)!.icon;
                  return <Icon className="h-5 w-5" />;
                })()}
              </>
            )}
            <span className="font-medium">{tabs.find((t) => t.id === activeTab)?.label}</span>
          </div>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
                    onClick={() => handleTabClick(tab.id)}
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
