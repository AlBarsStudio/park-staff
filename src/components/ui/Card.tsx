import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  adaptivePadding?: boolean; // Автоматически уменьшает padding на мобильных
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    children, 
    variant = 'default', 
    padding = 'md', 
    adaptivePadding = true,
    className, 
    ...props 
  }, ref) => {
    const isMobile = useIsMobile();
    const variantClass = variant === 'default' ? 'card' : `card-${variant}`;
    
    // Адаптивный padding для мобильных
    const getPaddingClass = () => {
      if (padding === 'none') return '';
      
      if (adaptivePadding && isMobile) {
        const mobilePadding = {
          sm: 'p-2',
          md: 'p-4',
          lg: 'p-6',
        };
        return mobilePadding[padding];
      }
      
      const desktopPadding = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      };
      return desktopPadding[padding];
    };

    const paddingClass = getPaddingClass();

    return (
      <div
        ref={ref}
        className={cn(variantClass, paddingClass, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
