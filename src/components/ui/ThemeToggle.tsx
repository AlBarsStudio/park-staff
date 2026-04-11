import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { mode, setThemeMode } = useTheme();

  const themes = [
    { 
      value: 'light' as const, 
      label: 'Светлая', 
      icon: Sun,
      color: '#f59e0b'
    },
    { 
      value: 'dark' as const, 
      label: 'Темная', 
      icon: Moon,
      color: '#6366f1'
    },
    { 
      value: 'system' as const, 
      label: 'Авто', 
      icon: Monitor,
      color: '#10b981'
    },
  ];

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      {themes.map(({ value, label, icon: Icon, color }) => {
        const isActive = mode === value;
        
        return (
          <button
            key={value}
            onClick={() => setThemeMode(value)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm font-medium"
            style={{
              backgroundColor: isActive ? 'var(--surface)' : 'transparent',
              color: isActive ? color : 'var(--text-muted)',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            }}
            title={label}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
