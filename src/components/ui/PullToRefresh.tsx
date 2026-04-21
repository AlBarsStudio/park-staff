import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
  disabled = false,
}) => {
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || !isMobile) return;
    
    const scrollTop = containerRef.current?.scrollTop || 0;
    
    // Only allow pull to refresh if at the top
    if (scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [disabled, isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0) {
      // Prevent default scroll behavior
      e.preventDefault();
      
      // Apply resistance
      const pullValue = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(pullValue);
      setCanRefresh(pullValue >= threshold);
    }
  }, [disabled, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) return;

    isPulling.current = false;

    if (canRefresh && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setCanRefresh(false);
      }
    } else {
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [canRefresh, disabled, isRefreshing, onRefresh, threshold]);

  if (!isMobile) {
    return <>{children}</>;
  }

  const rotation = Math.min((pullDistance / threshold) * 360, 360);
  const opacity = Math.min(pullDistance / threshold, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling.current ? 'none' : 'transform 300ms ease-out',
      }}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center"
        style={{
          height: threshold,
          marginTop: -threshold,
          opacity,
          pointerEvents: 'none',
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            backgroundColor: 'var(--surface)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <RefreshCw
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              color: 'var(--primary)',
              transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
              transition: 'transform 100ms',
            }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            {isRefreshing
              ? 'Обновление...'
              : canRefresh
              ? 'Отпустите для обновления'
              : 'Потяните для обновления'}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
};

export default PullToRefresh;
