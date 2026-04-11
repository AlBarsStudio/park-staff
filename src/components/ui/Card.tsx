import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', padding = 'md', className, ...props }, ref) => {
    const variantClass = variant === 'default' ? 'card' : `card-${variant}`;
    
    const paddingClass = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }[padding];

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
