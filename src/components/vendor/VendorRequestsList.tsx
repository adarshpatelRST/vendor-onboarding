import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Eye,
  FileEdit,
  Info,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
} from "lucide-react";
import {
  BusinessType,
  OnboardingRequest,
  RequestStatus,
  User,
} from "../../types/models";
import { getVendorOnboardingLockState } from "../../utils/requestValidators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import {
  formatDateTime,
  formatRequestStatusLabel,
  RequestStatusTag,
} from "../common/StatusBadge";

interface VendorRequestsListProps {
  currentUser: User;
  requests: OnboardingRequest[];
  businessTypes: BusinessType[];
  users: User[];
  onCreateNew: () => void;
  onEditRequest: (req: OnboardingRequest) => void;
  onViewRequest: (req: OnboardingRequest) => void;
  onRaiseOrder?: (req: OnboardingRequest) => void;
  onRaiseInvoice?: (req: OnboardingRequest) => void;
}

const PROCESS_STAGE_META: Record<
  RequestStatus,
  { label: string; classes: string }
> = {
  DRAFT: {
    label: "Drafting",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PENDING_AM_REVIEW: {
    label: "AM Compliance Review",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CHANGES_REQUESTED: {
    label: "Vendor Action Required",
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PENDING_SM_APPROVAL: {
    label: "SM Final Approval",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  QUERY_TO_AM: {
    label: "AM Clarification",
    classes: "bg-orange-50 text-orange-800 border-orange-200",
  },
  APPROVED: {
    label: "Onboarding Complete",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SUPERSEDED: {
    label: "Superseded",
    classes: "bg-slate-100 text-slate-600 border-slate-300",
  },
  REJECTED: {
    label: "Closed",
    classes: "bg-red-50 text-red-700 border-red-200",
  },
};

const ALL_STATUSES: RequestStatus[] = [
  "DRAFT",
  "PENDING_AM_REVIEW",
  "CHANGES_REQUESTED",
  "PENDING_SM_APPROVAL",
  "QUERY_TO_AM",
  "APPROVED",
  "SUPERSEDED",
  "REJECTED",
];

export function VendorRequestsList({
  currentUser,
  requests,
  businessTypes,
  users,
  onCreateNew,
  onEditRequest,
  onViewRequest,
  onRaiseOrder,
  onRaiseInvoice,
}: VendorRequestsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("ALL");

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const myRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests
      .filter((r) => r.vendorUserId === currentUser.id)
      .filter((r) => {
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
          r.businessInfo.gstin.toLowerCase().includes(q)
        );
      });
  }, [requests, currentUser.id, search, statusFilter, businessTypeFilter]);

  const getAssignedReviewerDisplay = (req: OnboardingRequest): string => {
    if (req.assignedSmId) {
      const sm = userMap.get(req.assignedSmId);
      return sm ? `${sm.name} (SM)` : req.assignedSmId;
    }
    if (req.assignedAmId) {
      const am = userMap.get(req.assignedAmId);
      return am ? `${am.name} (AM)` : req.assignedAmId;
    }
    return "Unassigned";
  };

  const columns: ColumnDef<OnboardingRequest>[] = [
    {
      key: "id",
      header: "REQUEST ID",
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
      header: "BUSINESS NAME",
      sortable: true,
      sortValue: (r) => r.businessInfo.legalBusinessName,
      render: (r) => (
        <div className="max-w-[170px]">
          <p className="font-medium text-xs text-slate-900 truncate" title={r.businessInfo.legalBusinessName}>
            {r.businessInfo.legalBusinessName}
          </p>
          <p className="font-mono text-[11px] text-slate-500">
            {r.businessInfo.gstin || "GSTIN pending"}
          </p>
        </div>
      ),
    },
    {
      key: "businessType",
      header: "BUSINESS TYPE",
      sortable: true,
      sortValue: (r) => r.businessInfo.businessType,
      render: (r) => (
        <span className="text-xs text-slate-700 whitespace-nowrap">
          {r.businessInfo.businessType}
        </span>
      ),
    },
    {
      key: "assignedReviewer",
      header: "ASSIGNED MANAGER",
      sortable: true,
      sortValue: (r) => getAssignedReviewerDisplay(r),
      render: (r) => {
        const label = getAssignedReviewerDisplay(r);
        return (
          <span
            className={`text-xs whitespace-nowrap ${label === "Unassigned"
                ? "text-slate-400"
                : "font-medium text-slate-800"
              }`}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "CREATED AT",
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "processStage",
      header: "PROCESS STAGE",
      sortable: true,
      sortValue: (r) => PROCESS_STAGE_META[r.status]?.label ?? r.status,
      render: (r) => {
        const stage = PROCESS_STAGE_META[r.status];
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${stage.classes}`}
          >
            {stage.label}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "FINAL STATUS",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <RequestStatusTag status={r.status} />,
    },
  ];

  const lockState = useMemo(
    () => getVendorOnboardingLockState(currentUser.id, requests, currentUser),
    [currentUser, requests]
  );

  const getRowActions = (row: OnboardingRequest): RowAction<OnboardingRequest>[] => {
    const canEdit =
      (row.status === "DRAFT" || row.status === "CHANGES_REQUESTED") &&
      (!lockState.isOnboarded ||
        Boolean(row.isModificationRequest) ||
        lockState.modificationEnabledByAdmin);
    const actions: RowAction<OnboardingRequest>[] = [
      {
        label: "Edit / Resume",
        icon: <Edit3 className="w-3.5 h-3.5 text-slate-500" />,
        disabled: !canEdit,
        onClick: (r) => onEditRequest(r),
      },
      {
        label: "View Request",
        icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
        onClick: (r) => onViewRequest(r),
      },
    ];
    if (row.status === "APPROVED" && onRaiseOrder) {
      actions.push({
        label: "Raise Order Request",
        icon: <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />,
        onClick: (r) => onRaiseOrder(r),
      });
    }
    if (row.status === "APPROVED" && onRaiseInvoice) {
      actions.push({
        label: "Raise Invoice Request",
        icon: <Receipt className="w-3.5 h-3.5 text-emerald-600" />,
        onClick: (r) => onRaiseInvoice(r),
      });
    }
    return actions;
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Your Onboarding Requests
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit your entity application, resolve reviewer feedback, and track approval status.
          </p>
        </div>
        {lockState.canCreateNewOnboarding && (
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs text-center"
          >
            <Plus className="w-4 h-4" />
            <span>
              {lockState.isOnboarded
                ? "New Modification Request"
                : "New Onboarding Request"}
            </span>
          </button>
        )}
      </div>

      {lockState.isOnboarded && lockState.modificationEnabledByAdmin && lockState.canCreateNewOnboarding && (
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FileEdit className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950">
              <p className="font-semibold">
                Modification Request Enabled by Administrator
              </p>
              <p className="text-indigo-800 mt-0.5">
                Admin has authorized you to submit one new onboarding request to
                modify details in your approved dossier (
                <span className="font-mono font-semibold">
                  {lockState.approvedRequest?.id}
                </span>
                ).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Raise Modification Request</span>
          </button>
        </div>
      )}

      {lockState.approvedRequest && (onRaiseOrder || onRaiseInvoice) && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-emerald-900">
                Vendor Onboarded ({lockState.approvedRequest.id})
              </p>
              <p className="text-emerald-800 mt-0.5">
                {lockState.approvedRequest.businessInfo.legalBusinessName} is
                approved. Each vendor can only be onboarded once — you can now
                raise Order and Invoice requests.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onRaiseOrder && (
              <button
                type="button"
                onClick={() => onRaiseOrder(lockState.approvedRequest!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-emerald-800 hover:bg-emerald-50 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Raise Order</span>
              </button>
            )}
            {onRaiseInvoice && (
              <button
                type="button"
                onClick={() => onRaiseInvoice(lockState.approvedRequest!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Raise Invoice</span>
              </button>
            )}
          </div>
        </div>
      )}

      {!lockState.isOnboarded && lockState.activeRequest && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Active Onboarding Application in Progress ({lockState.activeRequest.id})
            </p>
            <p className="text-blue-800 mt-0.5">
              Each vendor can only be onboarded once. Resume or track your
              current onboarding application below; a new application can only be
              created if an existing one is rejected.
            </p>
          </div>
        </div>
      )}

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
              ...ALL_STATUSES.map((st) => ({
                value: st,
                label: formatRequestStatusLabel(st),
              })),
            ]}
            placeholder="Filter requests by status..."
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
            placeholder="Filter requests by business type..."
          />
        </div>
      </div>

      {/* Unified DataTable (CRU only, no Delete) */}
      <DataTable
        data={myRequests}
        columns={columns}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.id}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        compact
        emptyTitle="No onboarding requests found"
        emptyDescription="Start a new supplier onboarding request or clear your active filters."
        emptyAction={
          lockState.canCreateNewOnboarding ? (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Onboarding Request</span>
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
