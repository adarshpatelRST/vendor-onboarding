import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiDropSearchOption {
  value: string;
  label: string;
  sublabel?: string;
  description?: string;
}

interface MultiDropSearchProps {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiDropSearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  openDirection?: "auto" | "down" | "up";
}

export function MultiDropSearch({
  id,
  values,
  onChange,
  options,
  placeholder = "Select options...",
  searchPlaceholder = "Search business types...",
  disabled = false,
  className = "",
  openDirection = "auto",
}: MultiDropSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
        (opt.description && opt.description.toLowerCase().includes(term)) ||
        opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  useEffect(() => {
    if (!isOpen) return;

    const checkCollision = () => {
      if (openDirection === "down") {
        setOpenUpward(false);
        return;
      }
      if (openDirection === "up") {
        setOpenUpward(true);
        return;
      }
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimatedMenuHeight = 280;

      if (spaceBelow < estimatedMenuHeight && spaceAbove > 320) {
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
  }, [isOpen, openDirection]);

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
      if (openDirection === "down") {
        setOpenUpward(false);
      } else if (openDirection === "up") {
        setOpenUpward(true);
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 280 && spaceAbove > 320);
      }
    }
    setIsOpen(nextState);
    if (nextState) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  };

  const handleToggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    const allOptionValues = filteredOptions.map((o) => o.value);
    const merged = Array.from(new Set([...values, ...allOptionValues]));
    onChange(merged);
  };

  const handleClearAll = () => {
    if (searchTerm) {
      const filteredSet = new Set(filteredOptions.map((o) => o.value));
      onChange(values.filter((v) => !filteredSet.has(v)));
    } else {
      onChange([]);
    }
  };

  const selectedLabels = useMemo(() => {
    return options
      .filter((o) => values.includes(o.value))
      .map((o) => o.label);
  }, [options, values]);

  return (
    <div className={`w-full ${className}`}>
      <div ref={containerRef} className="relative w-full">
        {/* Trigger Button */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            isOpen
              ? "border-blue-600 ring-2 ring-blue-500/20 bg-white"
              : "border-slate-300 hover:border-slate-400 bg-white text-slate-700"
          }`}
        >
          <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 items-center">
            {values.length === 0 ? (
              <span className="text-slate-400">{placeholder}</span>
            ) : (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200 shrink-0">
                  {values.length} selected
                </span>
                <span className="text-xs text-slate-700 truncate max-w-[240px]">
                  {selectedLabels.join(", ")}
                </span>
              </>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu directly attached to trigger button */}
        {isOpen && (
          <div
            className={`absolute left-0 z-50 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
              openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            {/* Search Box Header */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Quick bulk actions */}
              <div className="flex items-center justify-between pt-1.5 px-1 text-[11px] text-slate-600">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Options List */}
            <ul
              role="listbox"
              aria-multiselectable="true"
              className="max-h-48 sm:max-h-52 overflow-y-auto divide-y divide-slate-100 p-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-slate-400">
                  No matching business types found
                </li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = values.includes(opt.value);
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleToggleOption(opt.value)}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                        isSelected
                          ? "bg-blue-50/70 hover:bg-blue-50"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-medium ${
                              isSelected ? "text-blue-900" : "text-slate-900"
                            }`}
                          >
                            {opt.label}
                          </span>
                          {opt.sublabel && (
                            <span className="font-mono text-[10px] text-slate-400 uppercase">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Selected Tags Chips (when options are chosen) - rendered cleanly below the trigger */}
      {values.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {options
            .filter((o) => values.includes(o.value))
            .map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium"
              >
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span className="font-mono text-[10px] text-slate-400">
                    ({opt.sublabel})
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleOption(opt.value);
                  }}
                  className="hover:text-red-600 p-0.5 rounded cursor-pointer transition-colors"
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
