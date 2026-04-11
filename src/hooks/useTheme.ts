import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type Theme = 'light' | 'dark';

export function useTheme() {
  // Режим темы (что выбрал пользователь)
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode') as ThemeMode | null;
    return saved || 'system';
  });

  // Актуальная тема (что реально применено)
  const [theme, setTheme] = useState<Theme>('light');

  // Определяем системную тему
  const getSystemTheme = (): Theme => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';
  };

  // Применяем тему к DOM
  useEffect(() => {
    const root = document.documentElement;
    let actualTheme: Theme;

    if (mode === 'system') {
      actualTheme = getSystemTheme();
    } else {
      actualTheme = mode;
    }

    // Обновляем состояние
    setTheme(actualTheme);

    // Применяем класс
    root.classList.remove('light', 'dark');
    root.classList.add(actualTheme);

    // Сохраняем режим в localStorage
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  // Слушаем изменения системной темы
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setTheme(newTheme);
      
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [mode]);

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const toggleTheme = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  return { 
    mode,        // 'light' | 'dark' | 'system'
    theme,       // актуальная примененная тема
    setThemeMode, 
    toggleTheme 
  };
}
