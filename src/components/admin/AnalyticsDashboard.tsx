import { useMemo, useState } from "react";
import { ClipboardCheck, FileEdit, Lock, Search } from "lucide-react";
import { storageService } from "../../services/storageService";
import {
  BusinessType,
  OnboardingRequest,
  RequestStatus,
  User,
} from "../../types/models";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import {
  formatDateTime,
  formatRequestStatusLabel,
  RequestStatusTag,
} from "../common/StatusBadge";

interface AnalyticsDashboardProps {
  currentUser?: User;
  requests: OnboardingRequest[];
  businessTypes: BusinessType[];
  users: User[];
  onOpenReview?: (request: OnboardingRequest) => void;
  onDataChanged?: (message: string, type?: "success" | "error") => void;
}

const STATUS_ORDER: RequestStatus[] = [
  "PENDING_AM_REVIEW",
  "PENDING_SM_APPROVAL",
  "APPROVED",
  "CHANGES_REQUESTED",
  "QUERY_TO_AM",
  "DRAFT",
  "SUPERSEDED",
  "REJECTED",
];

export function AnalyticsDashboard({
  currentUser,
  requests,
  businessTypes,
  users,
  onOpenReview,
  onDataChanged,
}: AnalyticsDashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("ALL");
  const [selectedRequest, setSelectedRequest] =
    useState<OnboardingRequest | null>(null);
  const [modRequestTarget, setModRequestTarget] =
    useState<OnboardingRequest | null>(null);
  const [modReason, setModReason] = useState("");

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (
        businessTypeFilter !== "ALL" &&
        r.businessInfo.businessType !== businessTypeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.businessInfo.legalBusinessName.toLowerCase().includes(q) ||
        r.businessInfo.gstin.toLowerCase().includes(q) ||
        r.businessInfo.pan.toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter, businessTypeFilter]);

  const kpis = useMemo(() => {
    const total = filteredRequests.length;
    const pendingReview = filteredRequests.filter(
      (r) =>
        r.status === "PENDING_AM_REVIEW" || r.status === "PENDING_SM_APPROVAL"
    ).length;
    const approved = filteredRequests.filter((r) => r.status === "APPROVED").length;
    const revertedOrQueried = filteredRequests.filter(
      (r) => r.status === "CHANGES_REQUESTED" || r.status === "QUERY_TO_AM"
    ).length;

    const isFiltered =
      search.trim() !== "" ||
      statusFilter !== "ALL" ||
      businessTypeFilter !== "ALL";

    return [
      {
        label: isFiltered ? "Filtered Requests" : "Total Requests",
        value: total,
        hint: isFiltered
          ? `Showing ${total} of ${requests.length} total dossiers`
          : "All onboarding dossiers",
        accent: "text-slate-900",
      },
      {
        label: "Pending Review (AM + SM)",
        value: pendingReview,
        hint: "Awaiting manager action",
        accent: "text-blue-600",
      },
      {
        label: "Approved & Onboarded",
        value: approved,
        hint: "Active verified vendors",
        accent: "text-emerald-600",
      },
      {
        label: "Reverted / Queried",
        value: revertedOrQueried,
        hint: "Needs vendor or AM follow-up",
        accent: "text-amber-600",
      },
    ];
  }, [filteredRequests, requests.length, search, statusFilter, businessTypeFilter]);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const columns: ColumnDef<OnboardingRequest>[] = [
    {
      key: "id",
      header: "Request ID",
      sortable: true,
      sortValue: (r) => r.id,
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
          {r.id}
        </span>
      ),
    },
    {
      key: "legalBusinessName",
      header: "Legal Business Name",
      sortable: true,
      sortValue: (r) => r.businessInfo.legalBusinessName,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">
            {r.businessInfo.legalBusinessName}
          </p>
          <p className="text-xs text-slate-500">
            {r.contactInfo.city}, {r.contactInfo.state}
          </p>
        </div>
      ),
    },
    {
      key: "businessType",
      header: "Business Type",
      sortable: true,
      sortValue: (r) => r.businessInfo.businessType,
      render: (r) => (
        <span className="text-slate-700 whitespace-nowrap">
          {r.businessInfo.businessType}
        </span>
      ),
    },
    {
      key: "gstin",
      header: "GSTIN",
      sortable: true,
      sortValue: (r) => r.businessInfo.gstin,
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 whitespace-nowrap">
          {r.businessInfo.gstin}
        </span>
      ),
    },
    {
      key: "assigned",
      header: "Assigned AM / SM",
      sortable: false,
      render: (r) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div>
            AM:{" "}
            <span className="font-medium text-slate-800">
              {r.assignedAmId
                ? userNameMap.get(r.assignedAmId) ?? r.assignedAmId
                : "Unassigned"}
            </span>
          </div>
          <div>
            SM:{" "}
            <span className="font-medium text-slate-800">
              {r.assignedSmId
                ? userNameMap.get(r.assignedSmId) ?? r.assignedSmId
                : "Unassigned"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <RequestStatusTag status={r.status} />,
    },
    {
      key: "createdAt",
      header: "Created At",
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
  ];

  const getRowActions = (row: OnboardingRequest): RowAction<OnboardingRequest>[] => {
    const actions: RowAction<OnboardingRequest>[] = [
      {
        label: "Review Request",
        icon: <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />,
        onClick: (r) => {
          if (onOpenReview) {
            onOpenReview(r);
          } else {
            setSelectedRequest(r);
          }
        },
      },
    ];
    if (
      currentUser?.role === "ADMIN" &&
      row.status === "APPROVED" &&
      onDataChanged
    ) {
      const vendorUser = userMap.get(row.vendorUserId);
      const enabled = Boolean(vendorUser?.allowModificationOnboarding);
      actions.push({
        label: enabled
          ? "Revoke Modification Access"
          : "Enable Modification Request",
        icon: enabled ? (
          <Lock className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
        ),
        onClick: (r) => {
          setModRequestTarget(r);
          setModReason("");
        },
      });
    }
    return actions;
  };

  const handleConfirmModification = () => {
    if (!modRequestTarget || !currentUser || !onDataChanged) return;
    const vendorUser = userMap.get(modRequestTarget.vendorUserId);
    const nextEnabled = !vendorUser?.allowModificationOnboarding;
    try {
      storageService.setVendorModificationAccess(
        modRequestTarget.vendorUserId,
        nextEnabled,
        modReason,
        { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      );
      setModRequestTarget(null);
      onDataChanged(
        nextEnabled
          ? `Enabled new modification onboarding request for ${modRequestTarget.businessInfo.legalBusinessName}.`
          : `Revoked modification onboarding access for ${modRequestTarget.businessInfo.legalBusinessName}.`
      );
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Failed to update modification access.",
        "error"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Analytics Dashboard
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Enterprise-wide onboarding pipeline visibility and master request registry.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search requests by ID, business name, or GSTIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Request ID, Business Name, or GSTIN..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <DropSearch
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: "ALL", label: "All Statuses" },
              ...STATUS_ORDER.map((st) => ({
                value: st,
                label: formatRequestStatusLabel(st),
              })),
            ]}
            placeholder="Filter by status..."
            searchPlaceholder="Search status..."
          />

          <DropSearch
            value={businessTypeFilter}
            onChange={(val) => setBusinessTypeFilter(val)}
            options={[
              { value: "ALL", label: "All Business Types" },
              ...businessTypes.map((bt) => ({
                value: bt.name,
                label: bt.name,
              })),
            ]}
            placeholder="Filter by business type..."
          />
        </div>
      </div>

      {/* Strictly 4 KPI Cards (Dynamic - reacts to search & filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-slate-200 rounded-xl p-5"
          >
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p
              className={`text-3xl font-bold tracking-tight tabular-nums mt-2 ${kpi.accent}`}
            >
              {kpi.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* Master Requests Table */}
      <DataTable
        data={filteredRequests}
        columns={columns}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.id}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        emptyTitle="No matching requests"
        emptyDescription="Adjust your search query, status filter, or business type filter."
      />

      {/* Request Summary Modal */}
      <Modal
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={
          selectedRequest
            ? `${selectedRequest.businessInfo.legalBusinessName}`
            : undefined
        }
        subtitle={selectedRequest ? `Request ID: ${selectedRequest.id}` : undefined}
        maxWidthClass="max-w-2xl"
      >
        {selectedRequest && (
          <div className="p-6 space-y-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-500">Business Type</p>
                <p className="font-medium text-slate-900">
                  {selectedRequest.businessInfo.businessType} ·{" "}
                  {selectedRequest.businessInfo.businessCategory}
                </p>
              </div>
              <RequestStatusTag status={selectedRequest.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">
                  Tax &amp; Entity Identifiers
                </p>
                <p className="text-xs text-slate-700">
                  GSTIN:{" "}
                  <span className="font-mono font-medium text-slate-900">
                    {selectedRequest.businessInfo.gstin}
                  </span>
                </p>
                <p className="text-xs text-slate-700">
                  PAN:{" "}
                  <span className="font-mono font-medium text-slate-900">
                    {selectedRequest.businessInfo.pan}
                  </span>
                </p>
                <p className="text-xs text-slate-700">
                  MSME:{" "}
                  <span className="font-mono font-medium text-slate-900">
                    {selectedRequest.businessInfo.msmeNumber || "Not provided"}
                  </span>
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">
                  Settlement Bank Account
                </p>
                <p className="text-xs text-slate-900 font-medium">
                  {selectedRequest.bankInfo.bankName} (
                  {selectedRequest.bankInfo.accountType})
                </p>
                <p className="text-xs text-slate-700">
                  A/C:{" "}
                  <span className="font-mono font-medium text-slate-900">
                    {selectedRequest.bankInfo.accountNumber}
                  </span>
                </p>
                <p className="text-xs text-slate-700">
                  IFSC:{" "}
                  <span className="font-mono font-medium text-slate-900">
                    {selectedRequest.bankInfo.ifscCode}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Uploaded Documents ({selectedRequest.documents.length})
              </p>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {selectedRequest.documents.map((doc) => (
                  <div
                    key={doc.docType}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{doc.label}</p>
                      <p className="font-mono text-slate-500">
                        {doc.docNumber} · {doc.fileName}
                      </p>
                    </div>
                    <span className="text-slate-500 tabular-nums shrink-0">
                      {doc.fileSize}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedRequest.remarkHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Remark History
                </p>
                <div className="space-y-2">
                  {selectedRequest.remarkHistory.map((rem) => (
                    <div
                      key={rem.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {rem.actorName} ({rem.actorRole}) · {rem.action}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {formatDateTime(rem.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-1">{rem.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Enable / Revoke Modification Request Modal */}
      <Modal
        open={Boolean(modRequestTarget)}
        onClose={() => setModRequestTarget(null)}
        title={
          modRequestTarget &&
            userMap.get(modRequestTarget.vendorUserId)?.allowModificationOnboarding
            ? "Revoke Onboarding Modification Access"
            : "Enable Onboarding Modification Request"
        }
        subtitle={
          modRequestTarget
            ? `${modRequestTarget.id} — ${modRequestTarget.businessInfo.legalBusinessName}`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        {modRequestTarget && (
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {userMap.get(modRequestTarget.vendorUserId)
                ?.allowModificationOnboarding
                ? "Revoking access will prevent the vendor from raising a new onboarding modification request."
                : "Allow this onboarded vendor to raise one new onboarding request to modify details in their approved dossier."}
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
                placeholder="e.g. Approved entity bank/address modification required"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModRequestTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModification}
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer ${userMap.get(modRequestTarget.vendorUserId)
                    ?.allowModificationOnboarding
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-[#2563EB] hover:bg-blue-700"
                  }`}
              >
                {userMap.get(modRequestTarget.vendorUserId)
                  ?.allowModificationOnboarding
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
