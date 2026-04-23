import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { mode, setThemeMode } = useTheme();

  const themes = [
    { 
      value: 'light' as const, 
      label: 'Светлая', 
      icon: Sun,
      gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    },
    { 
      value: 'dark' as const, 
      label: 'Темная', 
      icon: Moon,
      gradient: 'linear-gradient(135deg, #818cf8, #6366f1)',
    },
    { 
      value: 'system' as const, 
      label: 'Авто', 
      icon: Monitor,
      gradient: 'linear-gradient(135deg, #34d399, #10b981)',
    },
  ];

  return (
    <div 
      className="grid grid-cols-3 gap-2 p-1.5 rounded-xl"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {themes.map(({ value, label, icon: Icon, gradient }) => {
        const isActive = mode === value;
        
        return (
          <button
            key={value}
            onClick={() => setThemeMode(value)}
            className="relative flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all active:scale-95"
            style={{
              backgroundColor: isActive ? 'var(--surface)' : 'transparent',
              boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
            }}
            title={label}
          >
            {/* Icon with gradient background */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform"
              style={{
                background: isActive ? gradient : 'var(--bg-tertiary)',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <Icon 
                className="w-4 h-4" 
                style={{ color: isActive ? 'white' : 'var(--text-muted)' }}
              />
            </div>
            
            {/* Label */}
            <span 
              className="text-xs font-medium"
              style={{ 
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {label}
            </span>

            {/* Active indicator */}
            {isActive && (
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ background: gradient }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
