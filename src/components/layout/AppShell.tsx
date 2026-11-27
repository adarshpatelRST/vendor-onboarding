import React, { useState } from "react";
import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FileText,
  GitMerge,
  Lock,
  LogOut,
  Menu,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { User } from "../../types/models";
import { RoleTag } from "../common/StatusBadge";

export type AdminNavSection =
  | "analytics"
  | "orders"
  | "invoices"
  | "users"
  | "mapping"
  | "business_types"
  | "audit_logs";

export type VendorNavSection = "requests" | "new_request" | "orders" | "invoices";
export type ReviewerNavSection = "queue" | "orders" | "invoices";

interface AppShellProps {
  user: User;
  isVendorOnboarded?: boolean;
  canCreateNewOnboarding?: boolean;
  activeAdminSection?: AdminNavSection;
  onSelectAdminSection?: (section: AdminNavSection) => void;
  activeVendorSection?: VendorNavSection;
  onSelectVendorSection?: (section: VendorNavSection) => void;
  activeReviewerSection?: ReviewerNavSection;
  onSelectReviewerSection?: (section: ReviewerNavSection) => void;
  onLogout: () => void;
  onResetDemoData?: () => void;
  children: React.ReactNode;
}

const ADMIN_NAV_ITEMS: Array<{
  id: AdminNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
    { id: "analytics", label: "Analytics Dashboard", icon: BarChart3 },
    { id: "orders", label: "Order Requests", icon: ShoppingCart },
    { id: "invoices", label: "Invoice Requests", icon: Receipt },
    { id: "users", label: "User Management", icon: Users },
    { id: "mapping", label: "UserBusinessMapping", icon: GitMerge },
    { id: "business_types", label: "Business Types", icon: Briefcase },
    { id: "audit_logs", label: "Audit Logs", icon: ClipboardList },
  ];

const VENDOR_NAV_ITEMS: Array<{
  id: VendorNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOnboarding?: boolean;
}> = [
    { id: "requests", label: "My Onboarding Requests", icon: FileText },
    { id: "new_request", label: "+ New Onboarding Request", icon: FilePlus2 },
    {
      id: "orders",
      label: "Order Requests",
      icon: ShoppingCart,
      requiresOnboarding: true,
    },
    {
      id: "invoices",
      label: "Invoice Requests",
      icon: Receipt,
      requiresOnboarding: true,
    },
  ];

export function AppShell({
  user,
  isVendorOnboarded = false,
  canCreateNewOnboarding = true,
  activeAdminSection,
  onSelectAdminSection,
  activeVendorSection,
  onSelectVendorSection,
  activeReviewerSection,
  onSelectReviewerSection,
  onLogout,
  onResetDemoData,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sidebarTitle =
    user.role === "ADMIN"
      ? "Governance Console"
      : user.role === "VENDOR"
        ? "Supplier Portal"
        : user.role === "AM"
          ? "Account Manager"
          : "Senior Manager";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Header (No role switcher) */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger menu */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={
              mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>

          {/* Desktop sidebar toggle button (matching Image 4) */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="font-heading text-sm sm:text-base font-bold text-slate-900 tracking-tight whitespace-nowrap block">
                Vendora<span className="text-blue-600">™</span>
              </span>
              <span className="hidden sm:block text-[10px] font-medium text-slate-500 whitespace-nowrap">
                Powered by RustyStick Technologies LLP
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {user.role === "ADMIN" && onResetDemoData && (
            <button
              type="button"
              onClick={onResetDemoData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Reset Demo Data to initial seed state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reset Demo Data</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2.5">
            <span className="text-sm font-medium text-slate-800 whitespace-nowrap">
              {user.name}
            </span>
            <RoleTag role={user.role} compact />
          </div>
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Mobile backdrop overlay with smooth fade */}
        <div
          className={`fixed inset-0 z-40 bg-slate-900/40 lg:hidden transition-opacity duration-300 ease-in-out ${mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
            }`}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Role-Scoped Sidebar: Full height drawer on mobile (top-0), sticky under header on desktop */}
        <aside
          aria-label={`${user.role} Navigation`}
          className={`fixed inset-y-0 left-0 top-0 h-full z-50 lg:z-auto flex lg:flex lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto shrink-0 bg-white border-r border-slate-200 flex-col transition-transform lg:transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none ${mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
            } ${sidebarCollapsed ? "lg:w-16 lg:px-2" : "w-72 lg:w-64"
            }`}
        >
          {/* Mobile drawer header (hidden on lg desktop) */}
          <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="font-heading text-base font-bold text-slate-900 block">
                  Vendora<span className="text-blue-600">™</span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 block">
                  Powered by RustyStick Technologies LLP
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-5 px-3 flex flex-col justify-between">
            <div>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2">
                  <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
                    {sidebarTitle}
                  </p>
                </div>
              )}

              <nav className="space-y-1">
                {user.role === "ADMIN" &&
                  onSelectAdminSection &&
                  ADMIN_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activeAdminSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => {
                          onSelectAdminSection(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${sidebarCollapsed ? "justify-center px-2" : ""
                          } ${active
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active ? "text-blue-600" : "text-slate-400"
                            }`}
                        />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}

                {user.role === "VENDOR" &&
                  onSelectVendorSection &&
                  VENDOR_NAV_ITEMS.filter(
                    (item) => item.id !== "new_request" || canCreateNewOnboarding
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = activeVendorSection === item.id;
                    const showLock = item.requiresOnboarding && !isVendorOnboarded;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => {
                          onSelectVendorSection(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${sidebarCollapsed ? "justify-center px-2" : ""
                          } ${active
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active ? "text-blue-600" : "text-slate-400"
                            }`}
                        />
                        {!sidebarCollapsed && (
                          <span className="truncate flex-1">{item.label}</span>
                        )}
                        {!sidebarCollapsed && showLock && (
                          <Lock
                            className="w-3.5 h-3.5 text-amber-500 shrink-0"
                            aria-label="Requires approved onboarding"
                          />
                        )}
                      </button>
                    );
                  })}

                {(user.role === "AM" || user.role === "SM") &&
                  onSelectReviewerSection &&
                  [
                    {
                      id: "queue" as ReviewerNavSection,
                      label:
                        user.role === "AM"
                          ? "AM Review Queue"
                          : "SM Approval Queue",
                      icon: ClipboardCheck,
                    },
                    {
                      id: "orders" as ReviewerNavSection,
                      label: "Order Requests",
                      icon: ShoppingCart,
                    },
                    {
                      id: "invoices" as ReviewerNavSection,
                      label: "Invoice Requests",
                      icon: Receipt,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = activeReviewerSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => {
                          onSelectReviewerSection(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${sidebarCollapsed ? "justify-center px-2" : ""
                          } ${active
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active ? "text-blue-600" : "text-slate-400"
                            }`}
                        />
                        {!sidebarCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </button>
                    );
                  })}
              </nav>
            </div>

            {/* Mobile user profile info at bottom of drawer */}
            <div className="lg:hidden mt-6 pt-4 border-t border-slate-200 px-2 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
              <RoleTag role={user.role} compact />
            </div>

            {!sidebarCollapsed && (
              <div className="hidden lg:block pt-4 mt-4 border-t border-slate-100 px-3">
                <p className="text-[10px] font-semibold text-slate-400">
                  Vendora™
                </p>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Powered by RustyStick Technologies LLP
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 px-6 sm:px-10 lg:px-12 py-6 lg:py-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
