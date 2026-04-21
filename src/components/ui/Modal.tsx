import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  fullScreenOnMobile?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  fullScreenOnMobile = false,
}: ModalProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Prevent iOS bounce
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  // Mobile: show from bottom, Desktop: center
  const modalClasses = cn(
    'relative w-full overflow-hidden',
    isMobile && !fullScreenOnMobile
      ? 'modal-mobile animate-mobile-modal'
      : fullScreenOnMobile && isMobile
      ? 'fixed inset-0 animate-fade-in'
      : 'max-h-[90vh] animate-scale-in',
    !isMobile && sizeClasses[size],
    isMobile && !fullScreenOnMobile ? '' : 'card',
    className
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" 
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={modalClasses}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Mobile drag handle (only on mobile bottom sheet) */}
        {isMobile && !fullScreenOnMobile && (
          <div className="pt-3 pb-2 flex justify-center">
            <div 
              className="w-10 h-1 rounded-full" 
              style={{ backgroundColor: 'var(--border)' }}
            />
          </div>
        )}

        {/* Header */}
        {title && (
          <div 
            className={cn(
              'flex items-center justify-between border-b',
              isMobile ? 'p-4' : 'p-6'
            )}
            style={{ borderColor: 'var(--border)' }}
          >
            <h3 
              id="modal-title"
              className={cn(
                'font-semibold',
                isMobile ? 'text-base' : 'text-lg'
              )}
              style={{ color: 'var(--text)' }}
            >
              {title}
            </h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg transition-all active:scale-95 hover:bg-opacity-10"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          className={cn(
            'overflow-y-auto',
            fullScreenOnMobile && isMobile 
              ? 'h-full' 
              : isMobile && !fullScreenOnMobile
              ? 'max-h-[85vh]'
              : 'max-h-[calc(90vh-80px)]',
            !title && (isMobile ? 'p-4' : 'p-6')
          )}
          style={{
            // iOS smooth scrolling
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
