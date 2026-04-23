import React from 'react';
import { Menu, ArrowLeft } from 'lucide-react';

interface MobileHeaderProps {
  title?: string;
  showLogo?: boolean;
  onMenuClick?: () => void;
  onBackClick?: () => void;
  showBack?: boolean;
  showMenu?: boolean;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showLogo = true,
  onMenuClick,
  onBackClick,
  showBack = false,
  showMenu = true,
  rightAction,
}) => {
  return (
    <header 
      className="sticky top-0 z-40 border-b backdrop-blur-lg"
      style={{
        backgroundColor: 'rgba(var(--surface-rgb, 255, 255, 255), 0.95)',
        borderColor: 'var(--border)',
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between px-4 h-16">
        {/* Left side - Back or Menu button */}
        <div className="flex items-center gap-3 flex-1">
          {showBack && onBackClick ? (
            <button
              onClick={onBackClick}
              className="p-2 -ml-2 rounded-lg active:scale-95 transition-all"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Назад"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : showMenu && onMenuClick ? (
            <button
              onClick={onMenuClick}
              className="p-2 -ml-2 rounded-lg active:scale-95 transition-all"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Меню"
            >
              <Menu className="w-6 h-6" />
            </button>
          ) : null}

          {/* Logo and Title */}
          {showLogo ? (
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  color: 'white',
                }}
              >
                P
              </div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                Park Staff
              </h1>
            </div>
          ) : title ? (
            <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>
              {title}
            </h1>
          ) : null}
        </div>

        {/* Right side - Actions */}
        {rightAction && (
          <div className="flex items-center gap-2">
            {rightAction}
          </div>
        )}
      </div>
    </header>
  );
};

export default MobileHeader;
