import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface DropSearchOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface DropSearchProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<DropSearchOption | string>;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  searchable?: boolean;
}

export function DropSearch({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  disabled = false,
  hasError = false,
  className = "",
  searchable,
}: DropSearchProps) {
  const isSearchable = searchable !== undefined ? searchable : options.length > 6;
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions: DropSearchOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value) ?? null;
  }, [normalizedOptions, value]);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
        opt.value.toLowerCase().includes(term)
    );
  }, [normalizedOptions, searchTerm]);

  // Collision detection: Check if dropdown would overflow the bottom of the viewport
  useEffect(() => {
    if (!isOpen) return;

    const checkCollision = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedMenuHeight = 280;

      // If space below is not enough and space above is larger, flip upward
      if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    };

    checkCollision();
    window.addEventListener("resize", checkCollision);
    window.addEventListener("scroll", checkCollision, true);
    return () => {
      window.removeEventListener("resize", checkCollision);
      window.removeEventListener("scroll", checkCollision, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    if (nextState && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < 280 && spaceAbove > spaceBelow);
    }
    setIsOpen(nextState);
    if (nextState) {
      if (isSearchable) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    } else {
      setSearchTerm("");
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg border text-sm transition-colors text-left cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
          hasError
            ? "border-red-500 focus:border-red-500"
            : isOpen
            ? "border-blue-600 ring-2 ring-blue-500/20"
            : "border-slate-300 hover:border-slate-400"
        } bg-white`}
      >
        <span
          className={`truncate ${
            selectedOption ? "text-slate-900 font-medium" : "text-slate-400"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu with collision awareness */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 w-full min-w-full max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
          style={{
            maxHeight: "min(280px, calc(100vh - 40px))",
          }}
        >
          {/* Search Input (only shown when searchable is enabled or options > 6) */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-xs bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1 text-sm divide-y divide-slate-50"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3.5 py-3 text-xs text-slate-400 text-center">
                No matching results found
              </li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-3.5 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="truncate">
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
