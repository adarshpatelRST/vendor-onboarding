import { useMemo, useState } from "react";
import { ClipboardCheck, FileText, Layers, Search } from "lucide-react";
import {
  BusinessType,
  OnboardingRequest,
  RequestStatus,
  User,
} from "../../types/models";
import { getAccessibleRequestsForReviewer } from "../../utils/requestValidators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import {
  formatDateTime,
  formatRequestStatusLabel,
  RequestStatusTag,
} from "../common/StatusBadge";

interface ManagerQueuePageProps {
  currentUser: User;
  requests: OnboardingRequest[];
  businessTypes: BusinessType[];
  onOpenReview: (req: OnboardingRequest, focusDocuments?: boolean) => void;
}

const QUEUE_STATUS_OPTIONS: RequestStatus[] = [
  "PENDING_AM_REVIEW",
  "CHANGES_REQUESTED",
  "PENDING_SM_APPROVAL",
  "QUERY_TO_AM",
  "APPROVED",
  "SUPERSEDED",
  "REJECTED",
];

export function ManagerQueuePage({
  currentUser,
  requests,
  businessTypes,
  onOpenReview,
}: ManagerQueuePageProps) {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<
    "ALL" | "ASSIGNED" | "UNCLAIMED"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("ALL");

  const isAM = currentUser.role === "AM";

  const accessibleRequests = useMemo(
    () => getAccessibleRequestsForReviewer(currentUser, requests),
    [currentUser, requests]
  );

  const isAssignedToMe = (req: OnboardingRequest): boolean =>
    isAM
      ? req.assignedAmId === currentUser.id
      : req.assignedSmId === currentUser.id;

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleRequests.filter((req) => {
      const assigned = isAssignedToMe(req);
      if (scopeFilter === "ASSIGNED" && !assigned) return false;
      if (scopeFilter === "UNCLAIMED" && assigned) return false;
      if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
      if (
        businessTypeFilter !== "ALL" &&
        req.businessInfo.businessType !== businessTypeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        req.id.toLowerCase().includes(q) ||
        req.businessInfo.legalBusinessName.toLowerCase().includes(q) ||
        req.businessInfo.gstin.toLowerCase().includes(q)
      );
    });
  }, [
    accessibleRequests,
    scopeFilter,
    statusFilter,
    businessTypeFilter,
    search,
    isAM,
    currentUser.id,
  ]);

  const isUnmappedEmpty =
    currentUser.mappedBusinessTypes.length === 0 &&
    accessibleRequests.length === 0;

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
        <div>
          <p className="font-medium text-slate-900">
            {r.businessInfo.legalBusinessName}
          </p>
          <p className="font-mono text-xs text-slate-500">
            {r.businessInfo.gstin}
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
        <span className="text-slate-700 whitespace-nowrap">
          {r.businessInfo.businessType}
        </span>
      ),
    },
    {
      key: "ownership",
      header: "OWNERSHIP",
      sortable: true,
      sortValue: (r) => (isAssignedToMe(r) ? currentUser.name : "Unassigned"),
      render: (r) => {
        const assigned = isAssignedToMe(r);
        return assigned ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap">
            {currentUser.name}
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 whitespace-nowrap">
            Unassigned
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
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <RequestStatusTag status={r.status} />,
    },
  ];

  const getRowActions = (
    row: OnboardingRequest
  ): RowAction<OnboardingRequest>[] => [
    {
      label: "Review Request",
      icon: <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />,
      onClick: (r) => onOpenReview(r, false),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isAM ? "AM Review Queue" : "SM Approval Queue"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAM
              ? "Review unassigned dossiers matching your mapped business types or continue requests assigned to you."
              : "Perform final compliance sign-off or escalate verification queries back to the Account Manager."}
          </p>
        </div>
      </div>

      {/* Unmapped Empty State */}
      {isUnmappedEmpty ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-2xl mx-auto">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5 text-slate-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            No Business Types Mapped
          </h2>
          <p className="text-sm text-slate-600 mt-1.5">
            No Business Types mapped to your account yet. Contact System Admin to assign Business Types.
          </p>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="relative lg:col-span-4">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="Search queue by Request ID, business name, or GSTIN"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ID, Business Name, GSTIN..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="w-full lg:col-span-2">
                <DropSearch
                  value={scopeFilter}
                  onChange={(val) =>
                    setScopeFilter(val as "ALL" | "ASSIGNED" | "UNCLAIMED")
                  }
                  options={[
                    { value: "ALL", label: "All Accessible" },
                    { value: "ASSIGNED", label: "Assigned to Me" },
                    { value: "UNCLAIMED", label: "Unassigned Pool" },
                  ]}
                  placeholder="Filter scope..."
                />
              </div>

              <div className="w-full lg:col-span-3">
                <DropSearch
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={[
                    { value: "ALL", label: "All Statuses" },
                    ...QUEUE_STATUS_OPTIONS.map((st) => ({
                      value: st,
                      label: formatRequestStatusLabel(st),
                    })),
                  ]}
                  placeholder="Filter by status..."
                  searchPlaceholder="Search status..."
                />
              </div>

              <div className="w-full lg:col-span-3">
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
          </div>

          <DataTable
            data={filteredRequests}
            columns={columns}
            getRowId={(r) => r.id}
            getRowLabel={(r) => r.id}
            getRowActions={getRowActions}
            defaultSortKey="createdAt"
            defaultSortDirection="desc"
            emptyTitle="No requests in queue"
            emptyDescription="No onboarding requests currently match your queue filters and mapped business types."
          />
        </>
      )}
    </div>
  );
}
