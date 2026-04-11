import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Проверяем localStorage
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) return saved;

    // Проверяем системные настройки
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Удаляем старый класс
    root.classList.remove('light', 'dark');
    
    // Добавляем новый
    root.classList.add(theme);
    
    // Сохраняем в localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, setTheme, toggleTheme };
}
