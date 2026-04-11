import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, icon, ...props }, ref) => {
    const inputClass = error ? 'input-error' : 'input';

    if (icon) {
      return (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
          <input
            ref={ref}
            className={cn(inputClass, 'pl-10', className)}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(inputClass, className)}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
