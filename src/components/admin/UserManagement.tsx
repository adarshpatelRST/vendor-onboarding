import React, { useMemo, useState } from "react";
import {
  Check,
  Edit3,
  FileEdit,
  Info,
  Lock,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  OnboardingRequest,
  User,
  UserRole,
  UserStatus,
} from "../../types/models";
import { storageService } from "../../services/storageService";
import {
  evaluatePasswordRules,
  isLastActiveAdminViolation,
  validateUserAdminForm,
} from "../../utils/validators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import { formatDateTime, RoleTag, UserStatusTag } from "../common/StatusBadge";

interface UserManagementProps {
  currentUser: User;
  users: User[];
  requests?: OnboardingRequest[];
  onDataChanged: (toastMessage: string, type?: "success" | "error") => void;
}

export function UserManagement({
  currentUser,
  users,
  requests = [],
  onDataChanged,
}: UserManagementProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordRulesModal, setShowPasswordRulesModal] = useState(false);

  const [modModalUser, setModModalUser] = useState<User | null>(null);
  const [modReason, setModReason] = useState("");

  const approvedByVendorId = useMemo(() => {
    const map = new Map<string, OnboardingRequest>();
    requests.forEach((r) => {
      if (r.status === "APPROVED") {
        map.set(r.vendorUserId, r);
      }
    });
    return map;
  }, [requests]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("VENDOR");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const openAddModal = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("VENDOR");
    setStatus("ACTIVE");
    setErrors({});
    setShowPasswordRulesModal(false);
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setPassword("");
    setRole(user.role);
    setStatus(user.status);
    setErrors({});
    setShowPasswordRulesModal(false);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateUserAdminForm(
      {
        id: editingUser?.id,
        name,
        email,
        phone,
        password,
        role,
        status,
      },
      users
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };

    if (editingUser) {
      storageService.updateUser(
        editingUser.id,
        {
          name,
          email,
          phone,
          password: password || undefined,
          role,
          status,
        },
        actor
      );
      setModalOpen(false);
      onDataChanged(`Updated user ${name.trim()}.`);
    } else {
      storageService.createUser(
        {
          name,
          email,
          phone,
          password,
          role,
          status,
        },
        actor
      );
      setModalOpen(false);
      onDataChanged(`Created user ${name.trim()}.`);
    }
  };

  const passwordRules = useMemo(
    () => evaluatePasswordRules(password),
    [password]
  );

  const columns: ColumnDef<User>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortValue: (u) => u.name,
      render: (u) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium text-slate-900">{u.name}</p>
            {u.role === "VENDOR" && u.allowModificationOnboarding && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-[10px] font-semibold text-indigo-700">
                Modification Enabled
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-slate-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Mobile",
      sortable: true,
      sortValue: (u) => u.phone,
      render: (u) => (
        <span className="font-mono text-xs text-slate-700 tabular-nums">
          {u.phone}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) => <RoleTag role={u.role} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (u) => u.status,
      render: (u) => <UserStatusTag status={u.status} />,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      sortValue: (u) => u.createdAt,
      render: (u) => (
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(u.createdAt)}
        </span>
      ),
    },
  ];

  const getRowActions = (user: User): RowAction<User>[] => {
    const actions: RowAction<User>[] = [
      {
        label: "Edit User",
        icon: <Edit3 className="w-3.5 h-3.5 text-slate-500" />,
        onClick: (u) => openEditModal(u),
      },
    ];
    if (
      currentUser.role === "ADMIN" &&
      user.role === "VENDOR" &&
      approvedByVendorId.has(user.id)
    ) {
      actions.push({
        label: user.allowModificationOnboarding
          ? "Revoke Modification Request"
          : "Enable Modification Request",
        icon: user.allowModificationOnboarding ? (
          <Lock className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
        ),
        onClick: (u) => {
          setModModalUser(u);
          setModReason("");
        },
      });
    }
    return actions;
  };

  const handleConfirmModificationAccess = () => {
    if (!modModalUser) return;
    const nextEnabled = !modModalUser.allowModificationOnboarding;
    try {
      storageService.setVendorModificationAccess(
        modModalUser.id,
        nextEnabled,
        modReason,
        { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      );
      setModModalUser(null);
      onDataChanged(
        nextEnabled
          ? `Enabled new modification onboarding request for ${modModalUser.name}.`
          : `Revoked modification onboarding access for ${modModalUser.name}.`
      );
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Failed to update modification access.",
        "error"
      );
    }
  };

  const showLastAdminWarning =
    editingUser &&
    isLastActiveAdminViolation(editingUser.id, role, status, users);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage corporate accounts, role assignments, and active access across Vendora™.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer w-full sm:w-auto text-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* 3-Column Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search users by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Name or Email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <DropSearch
            value={roleFilter}
            onChange={(val) => setRoleFilter(val)}
            options={[
              { value: "ALL", label: "All Roles" },
              { value: "VENDOR", label: "VENDOR" },
              { value: "AM", label: "AM" },
              { value: "SM", label: "SM" },
              { value: "ADMIN", label: "ADMIN" },
            ]}
            placeholder="Filter by role..."
          />

          <DropSearch
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            placeholder="Filter by status..."
          />
        </div>
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns}
        getRowId={(u) => u.id}
        getRowLabel={(u) => u.name}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        emptyTitle="No users match your filters"
        emptyDescription="Clear the search box or adjust role/status filters."
      />

      {/* Add / Edit User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? "Edit User" : "Add User"}
        subtitle={
          editingUser
            ? `Editing ${editingUser.email}`
            : "Create a new platform user with role-based permissions."
        }
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {(errors.adminProtection || showLastAdminWarning) && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
            >
              {errors.adminProtection ||
                "Cannot deactivate or change role of the last active Administrator."}
            </div>
          )}

          <div>
            <label
              htmlFor="user-name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Full Name <span className="text-red-600">*</span>
            </label>
            <input
              id="user-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="e.g. Siddharth Rao"
              className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.name
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
                }`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="user-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email Address <span className="text-red-600">*</span>
              </label>
              <input
                id="user-email"
                type="email"
                value={email}
                disabled={Boolean(editingUser)}
                readOnly={Boolean(editingUser)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                }}
                placeholder="name@vendorflow.in"
                className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${editingUser
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    : errors.email
                      ? "bg-white border-red-500 focus:border-red-500"
                      : "bg-white border-slate-300 focus:border-blue-600"
                  }`}
              />
              {editingUser ? (
                <p className="text-[11px] text-slate-400 mt-1">
                  Email address cannot be edited once user account is created.
                </p>
              ) : errors.email ? (
                <p className="text-xs text-red-600 mt-1">{errors.email}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="user-phone"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Mobile Number <span className="text-red-600">*</span>
              </label>
              <input
                id="user-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((p) => ({ ...p, phone: "" }));
                }}
                placeholder="9820145678"
                className={`w-full px-3.5 py-2 rounded-lg border text-sm font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.phone
                    ? "border-red-500 focus:border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                  }`}
              />
              {errors.phone && (
                <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="user-password"
                className="block text-sm font-medium text-slate-700"
              >
                Password{" "}
                {!editingUser ? (
                  <span className="text-red-600">*</span>
                ) : (
                  <span className="text-xs font-normal text-slate-500">
                    (Leave blank to keep existing)
                  </span>
                )}
              </label>

              {/* Password Rules Info Hover Popup */}
              <div className="relative inline-flex items-center">
                <button
                  type="button"
                  onMouseEnter={() => setShowPasswordRulesModal(true)}
                  onMouseLeave={() => setShowPasswordRulesModal(false)}
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPasswordRulesModal((v) => !v);
                  }}
                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition-colors"
                  aria-label="View password rules"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>

                {showPasswordRulesModal && (
                  <div
                    onMouseEnter={() => setShowPasswordRulesModal(true)}
                    onMouseLeave={() => setShowPasswordRulesModal(false)}
                    className="absolute right-0 bottom-full mb-2 z-50 w-64 p-3 bg-white border border-slate-200 rounded-xl shadow-xl text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                      <span className="font-semibold text-slate-900">
                        Password Rules
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Requirements
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        {
                          ok: passwordRules.minMaxLength,
                          text: "8–30 characters",
                        },
                        {
                          ok: passwordRules.hasUppercase,
                          text: "1 uppercase letter (A–Z)",
                        },
                        {
                          ok: passwordRules.hasLowercase,
                          text: "1 lowercase letter (a–z)",
                        },
                        {
                          ok: passwordRules.hasDigit,
                          text: "1 digit (0–9)",
                        },
                        {
                          ok: passwordRules.hasSpecial,
                          text: "1 special char (@$!%*?&#...)",
                        },
                      ].map((rule, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 text-[11px] ${rule.ok
                              ? "text-emerald-700 font-medium"
                              : "text-slate-500"
                            }`}
                        >
                          {rule.ok ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{rule.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute right-3 top-full w-2 h-2 -mt-1 bg-white border-r border-b border-slate-200 rotate-45" />
                  </div>
                )}
              </div>
            </div>

            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: "" }));
              }}
              placeholder={
                editingUser
                  ? "Enter new password to change"
                  : "Strong password (8–30 chars)"
              }
              className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.password
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
                }`}
            />
            {errors.password && (
              <p className="text-xs text-red-600 mt-1">{errors.password}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="user-role"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Role <span className="text-red-600">*</span>
              </label>
              <DropSearch
                id="user-role"
                value={role}
                onChange={(val) => {
                  setRole(val as UserRole);
                  if (errors.adminProtection) {
                    setErrors((p) => ({ ...p, adminProtection: "" }));
                  }
                }}
                options={[
                  { value: "VENDOR", label: "VENDOR" },
                  { value: "AM", label: "AM" },
                  { value: "SM", label: "SM" },
                  { value: "ADMIN", label: "ADMIN" },
                ]}
                placeholder="Select role..."
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">
                Account Status <span className="text-red-600">*</span>
              </span>
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("ACTIVE");
                    if (errors.adminProtection) {
                      setErrors((p) => ({ ...p, adminProtection: "" }));
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${status === "ACTIVE"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("INACTIVE");
                    if (errors.adminProtection) {
                      setErrors((p) => ({ ...p, adminProtection: "" }));
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${status === "INACTIVE"
                      ? "bg-white text-red-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              {editingUser ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Enable / Revoke Modification Request Modal */}
      <Modal
        open={Boolean(modModalUser)}
        onClose={() => setModModalUser(null)}
        title={
          modModalUser?.allowModificationOnboarding
            ? "Revoke Onboarding Modification Access"
            : "Enable Onboarding Modification Request"
        }
        subtitle={
          modModalUser
            ? `${modModalUser.name} · ${approvedByVendorId.get(modModalUser.id)?.id ?? ""
            }`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        {modModalUser && (
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {modModalUser.allowModificationOnboarding
                ? "Revoking access will prevent this already-onboarded vendor from raising a new onboarding modification request."
                : "Enabling this allows the onboarded vendor to raise one new onboarding request to modify details in their approved dossier (e.g. bank account, GSTIN, or registered address)."}
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Admin Remark / Reason{" "}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                maxLength={250}
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="e.g. Bank account / IFSC update requested by vendor"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModModalUser(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModificationAccess}
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer ${modModalUser.allowModificationOnboarding
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-[#2563EB] hover:bg-blue-700"
                  }`}
              >
                {modModalUser.allowModificationOnboarding
                  ? "Revoke Access"
                  : "Enable Modification Request"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
