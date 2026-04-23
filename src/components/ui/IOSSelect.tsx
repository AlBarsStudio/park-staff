import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface IOSSelectProps {
  value: number | null;
  onChange: (value: number) => void;
  options: Array<{ id: number; name: string }>;
  placeholder?: string;
  label?: string;
}

export const IOSSelect: React.FC<IOSSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Выберите --',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(opt => opt.id === value);

  const handleSelect = (optionId: number) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <>
      {label && (
        <label className="input-label-mobile">{label}</label>
      )}
      
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-98"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: selectedOption ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        <span className="font-medium">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
      </button>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={label || 'Выберите'}
        height="half"
      >
        <div className="p-2">
          {options.map((option) => {
            const isSelected = option.id === value;
            
            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-98 mb-1"
                style={{
                  backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                  color: isSelected ? 'var(--primary)' : 'var(--text)',
                }}
              >
                <span className="font-medium">{option.name}</span>
                {isSelected && (
                  <Check className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
};
