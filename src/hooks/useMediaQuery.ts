import { useState, useEffect } from 'react';

/**
 * Hook для отслеживания медиа-запросов
 * @param query - CSS медиа-запрос (например, '(max-width: 768px)')
 * @returns boolean - соответствует ли текущий экран запросу
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Установить начальное значение
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Создать listener для изменений
    const listener = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Поддержка старых и новых браузеров
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // Fallback для старых браузеров
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [matches, query]);

  return matches;
};

/**
 * Предопределенные breakpoints
 */
export const BREAKPOINTS = {
  mobile: '(max-width: 640px)',
  tablet: '(min-width: 641px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)',
  touch: '(hover: none) and (pointer: coarse)',
  landscape: '(orientation: landscape)',
  portrait: '(orientation: portrait)',
} as const;

/**
 * Hook для определения мобильного устройства
 */
export const useIsMobile = () => useMediaQuery(BREAKPOINTS.mobile);

/**
 * Hook для определения планшета
 */
export const useIsTablet = () => useMediaQuery(BREAKPOINTS.tablet);

/**
 * Hook для определения десктопа
 */
export const useIsDesktop = () => useMediaQuery(BREAKPOINTS.desktop);

/**
 * Hook для определения touch-устройства
 */
export const useIsTouchDevice = () => useMediaQuery(BREAKPOINTS.touch);

/**
 * Hook для определения ориентации
 */
export const useIsLandscape = () => useMediaQuery(BREAKPOINTS.landscape);
export const useIsPortrait = () => useMediaQuery(BREAKPOINTS.portrait);

/**
 * Hook для определения размера экрана с детальной информацией
 */
export const useScreenSize = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  const isTouchDevice = useIsTouchDevice();
  const isLandscape = useIsLandscape();
  const isPortrait = useIsPortrait();

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice,
    isLandscape,
    isPortrait,
    // Удобные комбинации
    isMobileOrTablet: isMobile || isTablet,
    isSmallScreen: isMobile,
    isMediumScreen: isTablet,
    isLargeScreen: isDesktop,
  };
};

/**
 * Hook для определения высоты viewport (полезно для iOS)
 */
export const useViewportHeight = () => {
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    
    // Для iOS Safari - обновить при изменении orientation
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return height;
};
