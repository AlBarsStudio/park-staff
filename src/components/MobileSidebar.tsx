import React, { useEffect } from 'react';
import { X, User, LogOut, Settings, Bell, HelpCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ThemeToggle } from './ui/ThemeToggle';
import { useIsMobile } from '../hooks/useMediaQuery';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  userName = 'Пользователь',
  userRole = 'Сотрудник',
  onLogout,
}) => {
  const isMobile = useIsMobile();

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    {
      icon: User,
      label: 'Профиль',
      onClick: () => {
        console.log('Открыть профиль');
        onClose();
      },
    },
    {
      icon: Bell,
      label: 'Уведомления',
      badge: '3',
      onClick: () => {
        console.log('Открыть уведомления');
        onClose();
      },
    },
    {
      icon: Settings,
      label: 'Настройки',
      onClick: () => {
        console.log('Открыть настройки');
        onClose();
      },
    },
    {
      icon: HelpCircle,
      label: 'Помощь',
      onClick: () => {
        console.log('Открыть помощь');
        onClose();
      },
    },
  ];

  const sidebar = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 bottom-0 w-[85vw] max-w-[320px] z-50 animate-slide-right"
        style={{
          backgroundColor: 'var(--surface)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Меню навигации"
      >
        {/* Header */}
        <div 
          className="p-6 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                {userName}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {userRole}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mt-2 -mr-2 rounded-lg transition-all active:scale-95"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Закрыть меню"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Avatar */}
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar" style={{ height: 'calc(100vh - 240px)' }}>
          <nav className="p-4 space-y-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-3 p-3 rounded-lg transition-all active:scale-98"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.badge && (
                    <span 
                      className="px-2 py-0.5 text-xs font-bold rounded-full"
                      style={{
                        backgroundColor: 'var(--error)',
                        color: 'white',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Theme Toggle Section */}
          <div className="p-4 mt-4">
            <div 
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                Тема оформления
              </p>
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Footer - Logout */}
        <div 
          className="p-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => {
              onLogout?.();
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-all active:scale-98"
            style={{ color: 'var(--error)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--error-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(sidebar, document.body);
};

// Animation styles (добавить в index.css если их нет)
const style = document.createElement('style');
style.textContent = `
  @keyframes slideRight {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slide-right {
    animation: slideRight 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }
`;
if (!document.head.querySelector('style[data-sidebar-animations]')) {
  style.setAttribute('data-sidebar-animations', 'true');
  document.head.appendChild(style);
}

export default MobileSidebar;
