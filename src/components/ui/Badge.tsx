import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'neutral', dot = false, className, ...props }, ref) => {
    const variantClass = `badge-${variant}`;

    return (
      <span
        ref={ref}
        className={cn('badge', variantClass, className)}
        {...props}
      >
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
