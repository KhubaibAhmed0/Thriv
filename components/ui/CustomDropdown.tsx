'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  icon?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function CustomDropdown({
  options,
  value,
  onChange,
  prefix,
  icon,
  align = 'left',
  className = '',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== 'all' && value !== 'newest';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={[
          'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none',
          isFiltered
            ? 'bg-[#111111] text-white border border-[#111111] shadow-sm'
            : 'bg-white text-[#111111] border border-[#E2E0DC] hover:border-[#111111] shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
        ].join(' ')}
      >
        {icon && <span className={isFiltered ? 'text-white' : 'text-[#9A9A9A]'}>{icon}</span>}
        
        {selectedOption?.dotColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: selectedOption.dotColor }}
            aria-hidden="true"
          />
        )}

        <span>
          {prefix && <span className={isFiltered ? 'text-white/70 mr-1' : 'text-[#9A9A9A] mr-1'}>{prefix}:</span>}
          {selectedOption ? selectedOption.label : 'Select'}
        </span>

        <ChevronDown
          className={[
            'w-3.5 h-3.5 transition-transform duration-200 shrink-0',
            isFiltered ? 'text-white/80' : 'text-[#9A9A9A]',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          className={[
            'absolute top-full mt-2 z-50 min-w-[180px] bg-white rounded-[14px] border border-[#E2E0DC] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)] animate-in fade-in zoom-in-95 duration-100',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-[10px] text-xs font-medium transition-all flex items-center justify-between gap-3 cursor-pointer',
                    isSelected
                      ? 'bg-[#EDEBE8] text-[#111111] font-semibold'
                      : 'text-[#444444] hover:bg-[#F5F3F0] hover:text-[#111111]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    {option.dotColor && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: option.dotColor }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{option.label}</span>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#111111] stroke-[2.5] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
