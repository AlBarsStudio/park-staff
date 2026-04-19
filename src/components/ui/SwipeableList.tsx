import React, { useRef, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface SwipeableListProps {
  children: React.ReactNode;
  itemWidth?: string;
  gap?: string;
  className?: string;
  showScrollbar?: boolean;
}

export const SwipeableList: React.FC<SwipeableListProps> = ({
  children,
  itemWidth = '85%',
  gap = '1rem',
  className = '',
  showScrollbar = false,
}) => {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || !isMobile) return;

    let isScrolling = false;
    let startX = 0;
    let scrollLeft = 0;

    const handleTouchStart = (e: TouchEvent) => {
      isScrolling = true;
      startX = e.touches[0].pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isScrolling) return;
      e.preventDefault();
      const x = e.touches[0].pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 2;
      scrollContainer.scrollLeft = scrollLeft - walk;
    };

    const handleTouchEnd = () => {
      isScrolling = false;
    };

    scrollContainer.addEventListener('touchstart', handleTouchStart);
    scrollContainer.addEventListener('touchmove', handleTouchMove);
    scrollContainer.addEventListener('touchend', handleTouchEnd);

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile]);

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={scrollRef}
      className={`swipeable-list ${!showScrollbar ? 'hide-scrollbar' : ''} ${className}`}
      style={{ gap }}
    >
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          style={{ flex: `0 0 ${itemWidth}`, minWidth: 0 }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

export default SwipeableList;
