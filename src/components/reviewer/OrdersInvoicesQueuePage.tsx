import { useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  Layers,
  MessageSquare,
  Search,
  XCircle,
} from "lucide-react";
import { storageService } from "../../services/storageService";
import {
  BusinessType,
  InvoiceRequest,
  InvoiceStatus,
  OrderRequest,
  OrderStatus,
  User,
} from "../../types/models";
import { openDocumentInNewTab } from "../../utils/fileBlobStore";
import {
  formatINR,
  getAccessibleInvoicesForReviewer,
  getAccessibleOrdersForReviewer,
} from "../../utils/orderInvoiceValidators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { downloadKycDocument } from "../common/DocumentPreviewModal";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import { RemarkTimeline } from "../common/RemarkTimeline";
import {
  formatDateTime,
  formatInvoiceStatusLabel,
  formatOrderStatusLabel,
  InvoiceStatusTag,
  OrderStatusTag,
} from "../common/StatusBadge";
import { LineItemsEditor } from "../vendor/LineItemsEditor";
import { toInvoicePreviewDoc } from "../vendor/VendorInvoicesPage";

interface OrdersInvoicesQueuePageProps {
  mode: "orders" | "invoices";
  currentUser: User;
  orders: OrderRequest[];
  invoices: InvoiceRequest[];
  businessTypes: BusinessType[];
  users: User[];
  onDataChanged: (message: string, type?: "success" | "error") => void;
}

const ORDER_QUEUE_STATUSES: OrderStatus[] = [
  "PENDING_AM_REVIEW",
  "CHANGES_REQUESTED",
  "PENDING_SM_APPROVAL",
  "APPROVED",
  "REJECTED",
];

const INVOICE_QUEUE_STATUSES: InvoiceStatus[] = [
  "PENDING_AM_REVIEW",
  "CHANGES_REQUESTED",
  "PENDING_SM_APPROVAL",
  "APPROVED",
  "PAID",
  "REJECTED",
];

export function OrdersInvoicesQueuePage({
  mode,
  currentUser,
  orders,
  invoices,
  businessTypes,
  users,
  onDataChanged,
}: OrdersInvoicesQueuePageProps) {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<
    "ALL" | "ASSIGNED" | "UNCLAIMED"
  >("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("ALL");

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );

  const [actionModal, setActionModal] = useState<
    "APPROVE" | "CHANGES" | "REJECT" | "MARK_PAID" | null
  >(null);
  const [actionRemark, setActionRemark] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const isAM = currentUser.role === "AM";
  const isSM = currentUser.role === "SM";
  const isAdmin = currentUser.role === "ADMIN";

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const accessibleOrders = useMemo(
    () => getAccessibleOrdersForReviewer(currentUser, orders),
    [currentUser, orders]
  );

  const accessibleInvoices = useMemo(
    () => getAccessibleInvoicesForReviewer(currentUser, invoices),
    [currentUser, invoices]
  );

  const isAssignedToMe = (item: {
    assignedAmId: string | null;
    assignedSmId: string | null;
  }): boolean =>
    isAM
      ? item.assignedAmId === currentUser.id
      : item.assignedSmId === currentUser.id;

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleOrders.filter((ord) => {
      if (!isAdmin) {
        const assigned = isAssignedToMe(ord);
        if (scopeFilter === "ASSIGNED" && !assigned) return false;
        if (scopeFilter === "UNCLAIMED" && assigned) return false;
      }
      if (statusFilter !== "ALL" && ord.status !== statusFilter) return false;
      if (
        businessTypeFilter !== "ALL" &&
        ord.businessType !== businessTypeFilter
      )
        return false;
      if (!q) return true;
      return (
        ord.id.toLowerCase().includes(q) ||
        ord.title.toLowerCase().includes(q) ||
        ord.vendorEntityName.toLowerCase().includes(q) ||
        ord.gstin.toLowerCase().includes(q)
      );
    });
  }, [
    accessibleOrders,
    search,
    scopeFilter,
    statusFilter,
    businessTypeFilter,
    isAdmin,
    isAM,
    currentUser.id,
  ]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessibleInvoices.filter((inv) => {
      if (!isAdmin) {
        const assigned = isAssignedToMe(inv);
        if (scopeFilter === "ASSIGNED" && !assigned) return false;
        if (scopeFilter === "UNCLAIMED" && assigned) return false;
      }
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (
        businessTypeFilter !== "ALL" &&
        inv.businessType !== businessTypeFilter
      )
        return false;
      if (!q) return true;
      return (
        inv.id.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.vendorEntityName.toLowerCase().includes(q) ||
        (inv.orderId ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    accessibleInvoices,
    search,
    scopeFilter,
    statusFilter,
    businessTypeFilter,
    isAdmin,
    isAM,
    currentUser.id,
  ]);

  const selectedOrder = useMemo(
    () =>
      selectedOrderId
        ? orders.find((o) => o.id === selectedOrderId) ?? null
        : null,
    [orders, selectedOrderId]
  );

  const selectedInvoice = useMemo(
    () =>
      selectedInvoiceId
        ? invoices.find((i) => i.id === selectedInvoiceId) ?? null
        : null,
    [invoices, selectedInvoiceId]
  );

  const isUnmappedEmpty =
    !isAdmin &&
    currentUser.mappedBusinessTypes.length === 0 &&
    (mode === "orders"
      ? accessibleOrders.length === 0
      : accessibleInvoices.length === 0);

  const openDecisionModal = (
    type: "APPROVE" | "CHANGES" | "REJECT" | "MARK_PAID"
  ) => {
    setActionModal(type);
    setActionRemark("");
    setActionError(null);
  };

  const handleDecisionSubmit = () => {
    if (
      (actionModal === "REJECT" || actionModal === "CHANGES") &&
      !actionRemark.trim()
    ) {
      setActionError(
        actionModal === "REJECT"
          ? "Please provide an explanation for rejection."
          : "Please specify what changes or clarifications are required."
      );
      return;
    }

    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    };

    try {
      if (mode === "orders" && selectedOrder && actionModal) {
        if (isAM && actionModal !== "MARK_PAID") {
          const updated = storageService.transitionOrderByAM(
            selectedOrder.id,
            actionModal,
            actionRemark,
            actor
          );
          setActionModal(null);
          setSelectedOrderId(null);
          onDataChanged(
            actionModal === "APPROVE"
              ? `${updated.id} verified and escalated to Senior Manager.`
              : actionModal === "CHANGES"
              ? `Changes requested from vendor on ${updated.id}.`
              : `${updated.id} rejected.`
          );
        } else if (
          isSM &&
          (actionModal === "APPROVE" || actionModal === "REJECT")
        ) {
          const updated = storageService.transitionOrderBySM(
            selectedOrder.id,
            actionModal,
            actionRemark,
            actor
          );
          setActionModal(null);
          setSelectedOrderId(null);
          onDataChanged(
            actionModal === "APPROVE"
              ? `${updated.id} approved and activated for invoicing.`
              : `${updated.id} rejected.`
          );
        }
      } else if (mode === "invoices" && selectedInvoice && actionModal) {
        if (isAM && actionModal !== "MARK_PAID") {
          const updated = storageService.transitionInvoiceByAM(
            selectedInvoice.id,
            actionModal,
            actionRemark,
            actor
          );
          setActionModal(null);
          setSelectedInvoiceId(null);
          onDataChanged(
            actionModal === "APPROVE"
              ? `${updated.id} verified and escalated to Senior Manager.`
              : actionModal === "CHANGES"
              ? `Changes requested from vendor on ${updated.id}.`
              : `${updated.id} rejected.`
          );
        } else if (
          (isSM || (isAdmin && actionModal === "MARK_PAID")) &&
          (actionModal === "APPROVE" ||
            actionModal === "REJECT" ||
            actionModal === "MARK_PAID")
        ) {
          const updated = storageService.transitionInvoiceBySM(
            selectedInvoice.id,
            actionModal,
            actionRemark,
            actor
          );
          setActionModal(null);
          setSelectedInvoiceId(null);
          onDataChanged(
            actionModal === "MARK_PAID"
              ? `${updated.id} marked as Paid / Settled.`
              : actionModal === "APPROVE"
              ? `${updated.id} approved for payout.`
              : `${updated.id} rejected.`
          );
        }
      }
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Action failed.",
        "error"
      );
    }
  };

  const orderColumns: ColumnDef<OrderRequest>[] = [
    {
      key: "id",
      header: "ORDER ID",
      sortable: true,
      sortValue: (o) => o.id,
      render: (o) => (
        <span className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
          {o.id}
        </span>
      ),
    },
    {
      key: "vendorEntityName",
      header: "VENDOR ENTITY / ORDER",
      sortable: true,
      sortValue: (o) => o.vendorEntityName,
      render: (o) => (
        <div className="max-w-[230px]">
          <p className="font-medium text-xs text-slate-900 truncate" title={o.title}>
            {o.title}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {o.vendorEntityName} · {o.businessType}
          </p>
        </div>
      ),
    },
    {
      key: "totalAmount",
      header: "ORDER VALUE",
      sortable: true,
      sortValue: (o) => o.totalAmount,
      align: "right",
      render: (o) => (
        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
          {formatINR(o.totalAmount)}
        </span>
      ),
    },
    {
      key: "ownership",
      header: "REVIEWER",
      sortable: false,
      render: (o) => {
        const owner = o.assignedSmId
          ? `${userNameMap.get(o.assignedSmId) ?? o.assignedSmId} (SM)`
          : o.assignedAmId
          ? `${userNameMap.get(o.assignedAmId) ?? o.assignedAmId} (AM)`
          : "Unassigned";
        return (
          <span
            className={`text-xs whitespace-nowrap ${
              owner === "Unassigned"
                ? "text-blue-700 font-medium"
                : "text-slate-700"
            }`}
          >
            {owner}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "CREATED AT",
      sortable: true,
      sortValue: (o) => o.createdAt,
      render: (o) => (
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(o.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      sortable: true,
      sortValue: (o) => o.status,
      render: (o) => <OrderStatusTag status={o.status} />,
    },
  ];

  const invoiceColumns: ColumnDef<InvoiceRequest>[] = [
    {
      key: "id",
      header: "INVOICE ID",
      sortable: true,
      sortValue: (i) => i.id,
      render: (i) => (
        <span className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
          {i.id}
        </span>
      ),
    },
    {
      key: "invoiceNumber",
      header: "TAX INVOICE / VENDOR",
      sortable: true,
      sortValue: (i) => i.invoiceNumber,
      render: (i) => (
        <div className="max-w-[230px]">
          <p className="font-mono text-xs font-semibold text-slate-900">
            {i.invoiceNumber}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {i.vendorEntityName}
            {i.orderId ? ` · ${i.orderId}` : " · Direct"}
          </p>
        </div>
      ),
    },
    {
      key: "netPayableAmount",
      header: "NET PAYABLE",
      sortable: true,
      sortValue: (i) => i.netPayableAmount,
      align: "right",
      render: (i) => (
        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
          {formatINR(i.netPayableAmount)}
        </span>
      ),
    },
    {
      key: "ownership",
      header: "REVIEWER",
      sortable: false,
      render: (i) => {
        const owner = i.assignedSmId
          ? `${userNameMap.get(i.assignedSmId) ?? i.assignedSmId} (SM)`
          : i.assignedAmId
          ? `${userNameMap.get(i.assignedAmId) ?? i.assignedAmId} (AM)`
          : "Unassigned";
        return (
          <span
            className={`text-xs whitespace-nowrap ${
              owner === "Unassigned"
                ? "text-blue-700 font-medium"
                : "text-slate-700"
            }`}
          >
            {owner}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "CREATED AT",
      sortable: true,
      sortValue: (i) => i.createdAt,
      render: (i) => (
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {formatDateTime(i.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      sortable: true,
      sortValue: (i) => i.status,
      render: (i) => <InvoiceStatusTag status={i.status} />,
    },
  ];

  const orderActions = (): RowAction<OrderRequest>[] => [
    {
      label: isAdmin ? "View Order" : "Review Order",
      icon: <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />,
      onClick: (o) => setSelectedOrderId(o.id),
    },
  ];

  const invoiceActions = (): RowAction<InvoiceRequest>[] => [
    {
      label: isAdmin ? "Inspect Invoice" : "Review Invoice",
      icon: <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />,
      onClick: (i) => setSelectedInvoiceId(i.id),
    },
  ];

  const canAMActOrder =
    isAM && selectedOrder?.status === "PENDING_AM_REVIEW";
  const canSMActOrder =
    isSM && selectedOrder?.status === "PENDING_SM_APPROVAL";

  const canAMActInvoice =
    isAM && selectedInvoice?.status === "PENDING_AM_REVIEW";
  const canSMActInvoice =
    isSM && selectedInvoice?.status === "PENDING_SM_APPROVAL";
  const canMarkPaidInvoice =
    (isSM || isAdmin) && selectedInvoice?.status === "APPROVED";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {mode === "orders" ? "Vendor Order Requests" : "Vendor Invoice Requests"}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isAdmin
            ? `Enterprise visibility across all onboarded vendor ${mode}.`
            : isAM
            ? `Verify commercial ${mode} matching your mapped business types before Senior Manager approval.`
            : `Perform final sign-off on verified vendor ${mode}.`}
        </p>
      </div>

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
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div
                className={`relative ${
                  isAdmin ? "lg:col-span-6" : "lg:col-span-4"
                }`}
              >
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    mode === "orders"
                      ? "Search Order ID, Title, Entity..."
                      : "Search Invoice ID, Tax Invoice No., Entity..."
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {!isAdmin && (
                <div className="lg:col-span-2">
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
                    placeholder="Scope..."
                  />
                </div>
              )}

              <div className="lg:col-span-3">
                <DropSearch
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={[
                    { value: "ALL", label: "All Statuses" },
                    ...(mode === "orders"
                      ? ORDER_QUEUE_STATUSES.map((st) => ({
                          value: st,
                          label: formatOrderStatusLabel(st),
                        }))
                      : INVOICE_QUEUE_STATUSES.map((st) => ({
                          value: st,
                          label: formatInvoiceStatusLabel(st),
                        }))),
                  ]}
                  placeholder="Filter by status..."
                />
              </div>

              <div className="lg:col-span-3">
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

          {mode === "orders" ? (
            <DataTable
              data={filteredOrders}
              columns={orderColumns}
              getRowId={(o) => o.id}
              getRowLabel={(o) => o.id}
              getRowActions={orderActions}
              defaultSortKey="createdAt"
              defaultSortDirection="desc"
              emptyTitle="No order requests in queue"
              emptyDescription="No order requests currently match your filters."
            />
          ) : (
            <DataTable
              data={filteredInvoices}
              columns={invoiceColumns}
              getRowId={(i) => i.id}
              getRowLabel={(i) => i.id}
              getRowActions={invoiceActions}
              defaultSortKey="createdAt"
              defaultSortDirection="desc"
              emptyTitle="No invoice requests in queue"
              emptyDescription="No invoice requests currently match your filters."
            />
          )}
        </>
      )}

      {/* Order Review Modal */}
      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrderId(null)}
        title={
          selectedOrder ? `${selectedOrder.id} — ${selectedOrder.title}` : ""
        }
        subtitle={
          selectedOrder
            ? `${selectedOrder.vendorEntityName} · GSTIN: ${selectedOrder.gstin} · Onboarded: ${selectedOrder.onboardingRequestId}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {selectedOrder && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 text-xs">
              <div className="text-slate-600">
                Business Type:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedOrder.businessType}
                </span>{" "}
                · Payment Terms:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedOrder.paymentTerms}
                </span>
              </div>
              <OrderStatusTag status={selectedOrder.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div>
                <p className="text-slate-500">Category</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {selectedOrder.category}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Expected Delivery</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {selectedOrder.expectedDeliveryDate}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Delivery Location</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {selectedOrder.deliveryLocation}
                </p>
              </div>
            </div>

            <LineItemsEditor items={selectedOrder.lineItems} readOnly />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5 text-slate-600">
                <p>
                  Subtotal:{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {formatINR(selectedOrder.subtotal)}
                  </span>
                </p>
                <p>
                  GST Tax:{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {formatINR(selectedOrder.taxAmount)}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 font-medium">Total Order Value</p>
                <p className="text-lg font-bold font-mono text-slate-900">
                  {formatINR(selectedOrder.totalAmount)}
                </p>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="text-xs bg-white border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-700 mb-0.5">Notes</p>
                <p className="text-slate-600">{selectedOrder.notes}</p>
              </div>
            )}

            <RemarkTimeline remarks={selectedOrder.remarkHistory} />

            {(canAMActOrder || canSMActOrder) && (
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => openDecisionModal("REJECT")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
                {canAMActOrder && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("CHANGES")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Request Changes</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openDecisionModal("APPROVE")}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {canAMActOrder ? "Verify & Escalate" : "Approve Order"}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Invoice Review Modal */}
      <Modal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoiceId(null)}
        title={
          selectedInvoice
            ? `${selectedInvoice.id} — Invoice ${selectedInvoice.invoiceNumber}`
            : ""
        }
        subtitle={
          selectedInvoice
            ? `${selectedInvoice.vendorEntityName} · GSTIN: ${selectedInvoice.gstin} · Onboarded: ${selectedInvoice.onboardingRequestId}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {selectedInvoice && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 text-xs">
              <div className="text-slate-600">
                Business Type:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedInvoice.businessType}
                </span>
                {selectedInvoice.orderId && (
                  <>
                    {" "}
                    · Linked Order:{" "}
                    <span className="font-mono font-semibold text-blue-700">
                      {selectedInvoice.orderId}
                    </span>
                  </>
                )}
              </div>
              <InvoiceStatusTag status={selectedInvoice.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div>
                <p className="text-slate-500">Tax Invoice No.</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {selectedInvoice.invoiceNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Invoice Date</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {selectedInvoice.invoiceDate}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Due Date</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {selectedInvoice.dueDate}
                </p>
              </div>
              <div>
                <p className="text-slate-500">TDS Rate</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {selectedInvoice.tdsRate}%
                </p>
              </div>
            </div>

            {selectedInvoice.attachment && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {selectedInvoice.attachment.fileName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedInvoice.attachment.fileSize}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openDocumentInNewTab(
                        toInvoicePreviewDoc(
                          selectedInvoice.attachment!,
                          selectedInvoice.invoiceNumber
                        ),
                        selectedInvoice.vendorEntityName
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadKycDocument(
                        toInvoicePreviewDoc(
                          selectedInvoice.attachment!,
                          selectedInvoice.invoiceNumber
                        ),
                        selectedInvoice.vendorEntityName,
                        { gstin: selectedInvoice.gstin }
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            )}

            <LineItemsEditor items={selectedInvoice.lineItems} readOnly />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Taxable Subtotal</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {formatINR(selectedInvoice.subtotal)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">GST Tax</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {formatINR(selectedInvoice.taxAmount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">TDS Deduction</p>
                <p className="font-mono font-semibold text-amber-700 mt-0.5">
                  -{formatINR(selectedInvoice.tdsAmount)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-slate-500 font-semibold">Net Payable</p>
                <p className="text-lg font-bold font-mono text-emerald-700">
                  {formatINR(selectedInvoice.netPayableAmount)}
                </p>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="text-xs bg-white border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-700 mb-0.5">Notes</p>
                <p className="text-slate-600">{selectedInvoice.notes}</p>
              </div>
            )}

            <RemarkTimeline remarks={selectedInvoice.remarkHistory} />

            {(canAMActInvoice || canSMActInvoice || canMarkPaidInvoice) && (
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                {(canAMActInvoice || canSMActInvoice) && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("REJECT")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
                {canAMActInvoice && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("CHANGES")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Request Changes</span>
                  </button>
                )}
                {(canAMActInvoice || canSMActInvoice) && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("APPROVE")}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {canAMActInvoice ? "Verify & Escalate" : "Approve Payout"}
                    </span>
                  </button>
                )}
                {canMarkPaidInvoice && (
                  <button
                    type="button"
                    onClick={() => openDecisionModal("MARK_PAID")}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <BadgeIndianRupee className="w-3.5 h-3.5" />
                    <span>Mark as Paid</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Decision Remark Modal */}
      <Modal
        open={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={
          actionModal === "REJECT"
            ? "Reject Request"
            : actionModal === "CHANGES"
            ? "Request Vendor Changes"
            : actionModal === "MARK_PAID"
            ? "Confirm Invoice Settlement"
            : "Approve & Confirm"
        }
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {actionModal === "REJECT" || actionModal === "CHANGES" ? (
                <>
                  Remark / Explanation <span className="text-red-500">*</span>
                </>
              ) : (
                <>
                  Review / Settlement Remark{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </>
              )}
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={actionRemark}
              onChange={(e) => {
                setActionRemark(e.target.value);
                if (actionError) setActionError(null);
              }}
              placeholder={
                actionModal === "MARK_PAID"
                  ? "Optional UTR / NEFT payment reference..."
                  : "Enter review notes..."
              }
              className={`w-full px-3.5 py-2.5 rounded-lg border text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${
                actionError
                  ? "border-red-500"
                  : "border-slate-300 focus:border-blue-600"
              }`}
            />
            {actionError && (
              <p className="text-xs text-red-600 mt-1">{actionError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActionModal(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDecisionSubmit}
              className={`px-5 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer ${
                actionModal === "REJECT"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionModal === "MARK_PAID"
                  ? "bg-teal-600 hover:bg-teal-700"
                  : "bg-[#2563EB] hover:bg-blue-700"
              }`}
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
