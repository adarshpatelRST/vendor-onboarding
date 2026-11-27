import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | boolean;
  align?: "left" | "right";
  widthClass?: string;
  render: (row: T) => React.ReactNode;
}

export interface RowAction<T> {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: (row: T) => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  getRowActions?: (row: T) => RowAction<T>[];
  getRowLabel?: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
  compact?: boolean;
}

interface MenuPosition {
  rowId: string;
  top: number;
  right: number;
  openUpward: boolean;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  getRowActions,
  getRowLabel,
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your filters or search criteria.",
  emptyAction,
  defaultSortKey,
  defaultSortDirection = "desc",
  compact = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(
    defaultSortKey ?? null
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDirection);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [openMenu, setOpenMenu] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortable) return data;

    const copy = [...data];
    copy.sort((a, b) => {
      const va = col.sortValue
        ? col.sortValue(a)
        : String((a as Record<string, unknown>)[sortKey] ?? "");
      const vb = col.sortValue
        ? col.sortValue(b)
        : String((b as Record<string, unknown>)[sortKey] ?? "");

      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      if (typeof va === "boolean" && typeof vb === "boolean") {
        return sortDir === "asc"
          ? Number(va) - Number(vb)
          : Number(vb) - Number(va);
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      const cmp = sa.localeCompare(sb);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, columns, sortKey, sortDir]);

  const total = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
    setPageInput(String(safePage));
  }, [safePage, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [data.length]);

  useEffect(() => {
    if (!openMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement | null;
        if (target?.closest("[data-row-menu-trigger='true']")) {
          return;
        }
        setOpenMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    const handleScroll = () => setOpenMenu(null);

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openMenu]);

  const paginatedRows = useMemo(() => {
    const startIdx = (safePage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, safePage, pageSize]);

  const startResult = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endResult = Math.min(safePage * pageSize, total);

  const handleSort = (col: ColumnDef<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const commitPageInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(safePage));
      return;
    }
    const clamped = Math.min(Math.max(1, parsed), totalPages);
    setCurrentPage(clamped);
    setPageInput(String(clamped));
  };

  const openMenuRow = openMenu
    ? paginatedRows.find((r) => getRowId(r) === openMenu.rowId) ?? null
    : null;
  const openMenuActions =
    openMenuRow && getRowActions ? getRowActions(openMenuRow) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {total === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
          <p className="text-sm text-slate-500 mt-1">{emptyDescription}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                {columns.map((col, colIdx) => {
                  const isSorted = sortKey === col.key;
                  const padClass = compact
                    ? colIdx === 0
                      ? "pl-4 pr-2 py-3"
                      : "px-2 py-3"
                    : "px-4 py-3";
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={`${padClass} text-[11px] font-semibold text-slate-600 whitespace-nowrap ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.widthClass ?? ""}`}
                    >
                      {col.header}
                    </th>
                  );
                })}
                {getRowActions && (
                  <th
                    scope="col"
                    className={`${compact ? "pl-2 pr-4 py-3" : "px-4 py-3"} text-[11px] font-semibold text-slate-600 text-right w-12 whitespace-nowrap`}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedRows.map((row) => {
                const rowId = getRowId(row);
                const actions = getRowActions ? getRowActions(row) : [];
                const isMenuOpen = openMenu?.rowId === rowId;
                const rowAriaName = getRowLabel ? getRowLabel(row) : rowId;

                return (
                  <tr
                    key={rowId}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`${
                          compact
                            ? colIdx === 0
                              ? "pl-4 pr-2 py-3"
                              : "px-2 py-3"
                            : "px-4 py-3"
                        } text-sm text-slate-700 align-middle ${
                          col.align === "right" ? "text-right" : "text-left"
                        } ${col.widthClass ?? ""}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                    {getRowActions && (
                      <td className={`${compact ? "pl-2 pr-4 py-3" : "px-4 py-3"} text-right align-middle`}>
                        {actions.length > 0 && (
                          <button
                            type="button"
                            data-row-menu-trigger="true"
                            aria-label={`Actions for ${rowAriaName}`}
                            aria-expanded={isMenuOpen}
                            onClick={(e) => {
                              if (isMenuOpen) {
                                setOpenMenu(null);
                                return;
                              }
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const spaceBelow =
                                window.innerHeight - rect.bottom;
                              const openUpward = spaceBelow < 180;
                              setOpenMenu({
                                rowId,
                                top: openUpward ? rect.top - 4 : rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                                openUpward,
                              });
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Standardized Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 text-center sm:text-left">
        <div className="tabular-nums">
          Showing {startResult}-{endResult} of {total} results
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={safePage <= 1}
            onClick={() => {
              const prev = Math.max(1, safePage - 1);
              setCurrentPage(prev);
              setPageInput(String(prev));
            }}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              aria-label="Jump to page number"
              value={pageInput}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                setPageInput(digitsOnly);
              }}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitPageInput();
                }
              }}
              className="w-12 h-8 text-center rounded-lg border border-slate-300 bg-white text-slate-900 font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            <span className="text-slate-500 tabular-nums whitespace-nowrap">
              of {totalPages}
            </span>
          </div>

          <button
            type="button"
            aria-label="Next page"
            disabled={safePage >= totalPages}
            onClick={() => {
              const next = Math.min(totalPages, safePage + 1);
              setCurrentPage(next);
              setPageInput(String(next));
            }}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fixed-position Row Dropdown Menu (prevents clipping in scrollable containers) */}
      {openMenu && openMenuRow && openMenuActions.length > 0 && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: openMenu.openUpward ? undefined : openMenu.top,
            bottom: openMenu.openUpward
              ? window.innerHeight - openMenu.top
              : undefined,
            right: openMenu.right,
          }}
          className="z-50 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-lg py-1"
        >
          {openMenuActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                setOpenMenu(null);
                action.onClick(openMenuRow);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                action.danger
                  ? "text-red-600 hover:bg-red-50"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {action.icon && <span className="shrink-0">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
