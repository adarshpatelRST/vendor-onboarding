import React, { useMemo, useState } from "react";
import { GitMerge, Search } from "lucide-react";
import { BusinessType, User } from "../../types/models";
import { storageService } from "../../services/storageService";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import { MultiDropSearch } from "../common/MultiDropSearch";
import { formatDateTime, RoleTag, UserStatusTag } from "../common/StatusBadge";

interface UserBusinessMappingProps {
  currentUser: User;
  users: User[];
  businessTypes: BusinessType[];
  onDataChanged: (toastMessage: string) => void;
}

export function UserBusinessMapping({
  currentUser,
  users,
  businessTypes,
  onDataChanged,
}: UserBusinessMappingProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "AM" | "SM">("ALL");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const activeBusinessTypes = useMemo(
    () => businessTypes.filter((bt) => bt.isActive),
    [businessTypes]
  );

  const reviewerUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => u.role === "AM" || u.role === "SM")
      .filter((u) => (roleFilter === "ALL" ? true : u.role === roleFilter))
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.mappedBusinessTypes.some((bt) => bt.toLowerCase().includes(q))
        );
      });
  }, [users, search, roleFilter]);

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setSelectedTypes([...user.mappedBusinessTypes]);
  };

  const handleSaveMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    storageService.updateUserBusinessMapping(editingUser.id, selectedTypes, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });
    const name = editingUser.name;
    setEditingUser(null);
    onDataChanged(`Updated business type mapping for ${name}.`);
  };

  const columns: ColumnDef<User>[] = [
    {
      key: "name",
      header: "Reviewer",
      sortable: true,
      sortValue: (u) => u.name,
      render: (u) => (
        <div>
          <p className="font-medium text-slate-900">{u.name}</p>
          <p className="text-xs font-mono text-slate-500">{u.email}</p>
        </div>
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
    {
      key: "mappedBusinessTypes",
      header: "Mapped Business Types",
      sortable: false,
      render: (u) =>
        u.mappedBusinessTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {u.mappedBusinessTypes.map((bt) => (
              <span
                key={bt}
                className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
              >
                {bt}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No types assigned</span>
        ),
    },
  ];

  const getRowActions = (user: User): RowAction<User>[] => [
    {
      label: "Edit Mapping",
      icon: <GitMerge className="w-3.5 h-3.5 text-slate-500" />,
      onClick: (u) => openEditModal(u),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          UserBusinessMapping
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure which entity business types each Account Manager (AM) and Senior Manager (SM) can review and claim.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search AM or SM users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviewer name, email, or mapped type..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <DropSearch
            value={roleFilter}
            onChange={(val) => setRoleFilter(val as "ALL" | "AM" | "SM")}
            options={[
              { value: "ALL", label: "All Reviewers (AM & SM)" },
              { value: "AM", label: "Account Managers (AM)" },
              { value: "SM", label: "Senior Managers (SM)" },
            ]}
            placeholder="Filter reviewers by role..."
          />
        </div>
      </div>

      <DataTable
        data={reviewerUsers}
        columns={columns}
        getRowId={(u) => u.id}
        getRowLabel={(u) => u.name}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        emptyTitle="No AM or SM users found"
        emptyDescription="Create an Account Manager or Senior Manager in User Management first."
      />

      {/* Edit Mapping Modal */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Edit Mapping"
        subtitle={
          editingUser
            ? `${editingUser.name} (${editingUser.role}) — Select allowed business types`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        {editingUser && (
          <form onSubmit={handleSaveMapping} noValidate className="p-6 space-y-4 min-h-[380px] flex flex-col justify-between">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Active Business Types ({selectedTypes.length} selected)
              </label>

              {activeBusinessTypes.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">
                  No active business types available.
                </p>
              ) : (
                <MultiDropSearch
                  values={selectedTypes}
                  onChange={setSelectedTypes}
                  openDirection="down"
                  options={activeBusinessTypes.map((bt) => ({
                    value: bt.name,
                    label: bt.name,
                    sublabel: bt.code,
                    description: bt.description,
                  }))}
                  placeholder="Select allowed business types..."
                  searchPlaceholder="Search active business types..."
                />
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Save Mapping
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
