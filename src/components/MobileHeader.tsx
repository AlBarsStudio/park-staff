import React from 'react';
import { Menu, ArrowLeft, MoreVertical } from 'lucide-react';
import { ThemeToggle } from './ui/ThemeToggle';

interface MobileHeaderProps {
  title: string;
  onMenuClick?: () => void;
  onBackClick?: () => void;
  showBack?: boolean;
  showMenu?: boolean;
  showThemeToggle?: boolean;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  onMenuClick,
  onBackClick,
  showBack = false,
  showMenu = true,
  showThemeToggle = true,
  rightAction,
}) => {
  return (
    <header className="mobile-sticky-header">
      <div className="flex items-center justify-between">
        {/* Left side - Back or Menu button */}
        <div className="flex items-center gap-2">
          {showBack && onBackClick ? (
            <button
              onClick={onBackClick}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
              aria-label="Назад"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : showMenu && onMenuClick ? (
            <button
              onClick={onMenuClick}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
              aria-label="Меню"
            >
              <Menu className="w-6 h-6" />
            </button>
          ) : null}

          {/* Title */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {title}
          </h1>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {rightAction}
          
          {showThemeToggle && (
            <div className="scale-90">
              <ThemeToggle />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
