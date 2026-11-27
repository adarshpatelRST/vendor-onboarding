import React, { useMemo, useState } from "react";
import { Edit3, Plus, Search } from "lucide-react";
import { BusinessType, User } from "../../types/models";
import { storageService } from "../../services/storageService";
import { validateBusinessTypeForm } from "../../utils/validators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { Modal } from "../common/Modal";
import { ActiveFlagTag, formatDateTime } from "../common/StatusBadge";

interface BusinessTypesManagementProps {
  currentUser: User;
  businessTypes: BusinessType[];
  onDataChanged: (toastMessage: string) => void;
}

export function BusinessTypesManagement({
  currentUser,
  businessTypes,
  onDataChanged,
}: BusinessTypesManagementProps) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<BusinessType | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businessTypes;
    return businessTypes.filter(
      (bt) =>
        bt.name.toLowerCase().includes(q) ||
        bt.code.toLowerCase().includes(q) ||
        bt.description.toLowerCase().includes(q)
    );
  }, [businessTypes, search]);

  const openAddModal = () => {
    setEditingType(null);
    setName("");
    setCode("");
    setDescription("");
    setIsActive(true);
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (bt: BusinessType) => {
    setEditingType(bt);
    setName(bt.name);
    setCode(bt.code);
    setDescription(bt.description);
    setIsActive(bt.isActive);
    setErrors({});
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateBusinessTypeForm(
      {
        id: editingType?.id,
        name,
        code,
        description,
      },
      businessTypes
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };

    if (editingType) {
      storageService.updateBusinessType(
        editingType.id,
        { name, code, description, isActive },
        actor
      );
      setModalOpen(false);
      onDataChanged(`Updated business type "${name.trim()}".`);
    } else {
      storageService.createBusinessType(
        { name, code, description, isActive },
        actor
      );
      setModalOpen(false);
      onDataChanged(`Created business type "${name.trim()}".`);
    }
  };

  const columns: ColumnDef<BusinessType>[] = [
    {
      key: "name",
      header: "Business Type",
      sortable: true,
      sortValue: (bt) => bt.name,
      render: (bt) => (
        <span className="font-medium text-slate-900 whitespace-nowrap">
          {bt.name}
        </span>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortable: true,
      sortValue: (bt) => bt.code,
      render: (bt) => (
        <span className="font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
          {bt.code}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      sortable: false,
      render: (bt) => (
        <span className="text-slate-600 text-xs sm:text-sm">
          {bt.description}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      sortable: true,
      sortValue: (bt) => bt.isActive,
      render: (bt) => <ActiveFlagTag isActive={bt.isActive} />,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      sortValue: (bt) => bt.createdAt,
      render: (bt) => (
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(bt.createdAt)}
        </span>
      ),
    },
  ];

  const getRowActions = (bt: BusinessType): RowAction<BusinessType>[] => [
    {
      label: "Edit",
      icon: <Edit3 className="w-3.5 h-3.5 text-slate-500" />,
      onClick: (row) => openEditModal(row),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Business Types</h1>
          <p className="text-sm text-slate-600 mt-1">
            Define legal entity classifications used in supplier onboarding forms and AM/SM routing.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer w-full sm:w-auto text-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Business Type</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search business types"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, or description..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(bt) => bt.id}
        getRowLabel={(bt) => bt.name}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        emptyTitle="No business types found"
        emptyDescription="Add a new legal entity classification to begin."
      />

      {/* Add / Edit Business Type Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingType ? "Edit Business Type" : "Add Business Type"}
        subtitle="Configure legal entity classification metadata."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div>
            <label
              htmlFor="bt-name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Business Type Name <span className="text-red-600">*</span>
            </label>
            <input
              id="bt-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="e.g. One Person Company"
              className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.name
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="bt-code"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Code <span className="text-red-600">*</span>
            </label>
            <input
              id="bt-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (errors.code) setErrors((p) => ({ ...p, code: "" }));
              }}
              placeholder="e.g. OPC_LTD"
              className={`w-full px-3.5 py-2 rounded-lg border text-sm font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.code
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
              }`}
            />
            {errors.code && (
              <p className="text-xs text-red-600 mt-1">{errors.code}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="bt-desc"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Description <span className="text-red-600">*</span>
            </label>
            <textarea
              id="bt-desc"
              rows={3}
              maxLength={50}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) {
                  setErrors((p) => ({ ...p, description: "" }));
                }
              }}
              placeholder="Describe the entity registration classification..."
              className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-20 min-h-[5rem] max-h-[5rem] overflow-y-auto resize-none ${
                errors.description
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
              }`}
            />
            <div className="flex items-center justify-between mt-1 text-[11px]">
              {errors.description ? (
                <span className="text-red-600">{errors.description}</span>
              ) : (
                <span />
              )}
              <span className="text-slate-400 font-mono">
                {description.length}/50
              </span>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">
              Status <span className="text-red-600">*</span>
            </span>
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  !isActive
                    ? "bg-white text-slate-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Inactive
              </button>
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
              {editingType ? "Save Changes" : "Create Business Type"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
