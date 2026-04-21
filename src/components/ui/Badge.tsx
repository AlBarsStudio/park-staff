import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  dot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ 
    children, 
    variant = 'primary', 
    dot = false,
    size = 'md',
    className, 
    ...props 
  }, ref) => {
    const variantClass = `badge-${variant}`;
    
    const sizeClasses = {
      sm: 'text-xs px-2 py-0.5',
      md: 'text-xs px-2.5 py-0.5',
      lg: 'text-sm px-3 py-1',
    };

    return (
      <span
        ref={ref}
        className={cn('badge', variantClass, sizeClasses[size], className)}
        {...props}
      >
        {dot && (
          <span 
            className="w-1.5 h-1.5 rounded-full bg-current" 
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
