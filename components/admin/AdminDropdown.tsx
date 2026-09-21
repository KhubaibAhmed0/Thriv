'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface AdminDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  dotColor?: string;
}

interface AdminDropdownProps {
  options: AdminDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AdminDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  disabled = false,
}: AdminDropdownProps) {
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

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={[
          'w-full bg-[#202020] border rounded-[12px] px-3.5 py-2.5 text-sm text-white flex items-center justify-between transition-colors cursor-pointer select-none outline-none',
          isOpen ? 'border-neutral-400' : 'border-[#303030] hover:border-neutral-400',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden text-left">
          {selectedOption?.dotColor && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.dotColor }}
              aria-hidden="true"
            />
          )}

          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="text-neutral-500">{placeholder}</span>}
          </span>

          {selectedOption?.sublabel && (
            <span className="text-xs text-neutral-400 font-normal truncate hidden sm:inline">
              ({selectedOption.sublabel})
            </span>
          )}
        </div>

        <ChevronDown
          className={[
            'w-4 h-4 text-neutral-400 transition-transform duration-200 shrink-0 ml-2',
            isOpen ? 'rotate-180 text-white' : '',
          ].join(' ')}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#1c1c1c] rounded-[14px] border border-[#303030] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto"
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
                    'w-full text-left px-3 py-2.5 rounded-[10px] text-xs sm:text-sm font-medium transition-all flex items-center justify-between gap-3 cursor-pointer',
                    isSelected
                      ? 'bg-[#282828] text-white font-semibold'
                      : 'text-neutral-300 hover:bg-[#232323] hover:text-white',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {option.dotColor && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: option.dotColor }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-[11px] text-neutral-400 font-normal truncate">
                        ({option.sublabel})
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
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
