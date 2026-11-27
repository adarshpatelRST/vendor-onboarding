import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Edit3,
  Eye,
  Plus,
  Receipt,
  Save,
  Search,
  Send,
  ShoppingCart,
} from "lucide-react";
import { BUSINESS_CATEGORIES } from "../../constants/india";
import { storageService } from "../../services/storageService";
import {
  OnboardingRequest,
  OrderLineItem,
  OrderRequest,
  OrderStatus,
  PaymentTerms,
  User,
} from "../../types/models";
import {
  computeLineItemsTotals,
  formatINR,
  getApprovedOnboardingRequestsForVendor,
  validateOrderForm,
} from "../../utils/orderInvoiceValidators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import { RemarkTimeline } from "../common/RemarkTimeline";
import {
  formatDateTime,
  formatOrderStatusLabel,
  OrderStatusTag,
} from "../common/StatusBadge";
import { createEmptyLineItem, LineItemsEditor } from "./LineItemsEditor";
import { OnboardingGateBanner } from "./OnboardingGateBanner";

interface VendorOrdersPageProps {
  currentUser: User;
  requests: OnboardingRequest[];
  orders: OrderRequest[];
  users: User[];
  initialCreateEntityId?: string | null;
  onClearInitialCreate?: () => void;
  onNavigateToOnboarding: () => void;
  onRaiseInvoiceFromOrder: (order: OrderRequest) => void;
  onDataChanged: (message: string, type?: "success" | "error") => void;
}

const ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "PENDING_AM_REVIEW",
  "CHANGES_REQUESTED",
  "PENDING_SM_APPROVAL",
  "APPROVED",
  "REJECTED",
];

const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = [
  "Advance",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
];

export function VendorOrdersPage({
  currentUser,
  requests,
  orders,
  users,
  initialCreateEntityId,
  onClearInitialCreate,
  onNavigateToOnboarding,
  onRaiseInvoiceFromOrder,
  onDataChanged,
}: VendorOrdersPageProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRequest | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderRequest | null>(null);

  // Form state
  const [onboardingRequestId, setOnboardingRequestId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("Net 30");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([
    createEmptyLineItem(),
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const vendorRequests = useMemo(
    () => requests.filter((r) => r.vendorUserId === currentUser.id),
    [requests, currentUser.id]
  );

  const approvedEntities = useMemo(
    () => getApprovedOnboardingRequestsForVendor(currentUser.id, requests),
    [currentUser.id, requests]
  );

  const myOrders = useMemo(
    () => orders.filter((o) => o.vendorUserId === currentUser.id),
    [orders, currentUser.id]
  );

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const openCreateModal = (preselectEntityId?: string) => {
    const defaultEntity =
      approvedEntities.find((e) => e.id === preselectEntityId) ??
      approvedEntities[0];
    setEditingOrder(null);
    setOnboardingRequestId(defaultEntity?.id ?? "");
    setTitle("");
    setCategory(defaultEntity?.businessInfo.businessCategory ?? "");
    setExpectedDeliveryDate("");
    setDeliveryLocation(
      defaultEntity
        ? `${defaultEntity.contactInfo.city}, ${defaultEntity.contactInfo.state}`
        : ""
    );
    setPaymentTerms("Net 30");
    setNotes("");
    setLineItems([createEmptyLineItem()]);
    setErrors({});
    setFormOpen(true);
  };

  useEffect(() => {
    if (initialCreateEntityId && approvedEntities.length > 0) {
      openCreateModal(initialCreateEntityId);
      onClearInitialCreate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCreateEntityId, approvedEntities.length]);

  const openEditModal = (order: OrderRequest) => {
    setEditingOrder(order);
    setOnboardingRequestId(order.onboardingRequestId);
    setTitle(order.title);
    setCategory(order.category);
    setExpectedDeliveryDate(order.expectedDeliveryDate);
    setDeliveryLocation(order.deliveryLocation);
    setPaymentTerms(order.paymentTerms);
    setNotes(order.notes);
    setLineItems(
      order.lineItems.length > 0
        ? order.lineItems.map((li) => ({ ...li }))
        : [createEmptyLineItem()]
    );
    setErrors({});
    setFormOpen(true);
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myOrders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (entityFilter !== "ALL" && o.onboardingRequestId !== entityFilter)
        return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.title.toLowerCase().includes(q) ||
        o.vendorEntityName.toLowerCase().includes(q)
      );
    });
  }, [myOrders, search, statusFilter, entityFilter]);

  const kpis = useMemo(() => {
    const total = myOrders.length;
    const pending = myOrders.filter(
      (o) =>
        o.status === "PENDING_AM_REVIEW" ||
        o.status === "PENDING_SM_APPROVAL" ||
        o.status === "CHANGES_REQUESTED"
    ).length;
    const approved = myOrders.filter((o) => o.status === "APPROVED");
    const approvedValue = approved.reduce((sum, o) => sum + o.totalAmount, 0);
    return [
      { label: "Total Order Requests", value: String(total), accent: "text-slate-900" },
      { label: "In Review / Action", value: String(pending), accent: "text-blue-600" },
      { label: "Approved Orders (PO)", value: String(approved.length), accent: "text-emerald-600" },
      { label: "Approved Order Value", value: formatINR(approvedValue), accent: "text-slate-900" },
    ];
  }, [myOrders]);

  const formTotals = useMemo(
    () => computeLineItemsTotals(lineItems),
    [lineItems]
  );

  const handleSaveDraft = () => {
    const draftErrors = validateOrderForm(
      {
        onboardingRequestId,
        title,
        category,
        expectedDeliveryDate,
        deliveryLocation,
        paymentTerms,
        lineItems,
      },
      approvedEntities,
      true
    );
    setErrors(draftErrors);
    if (Object.keys(draftErrors).length > 0) return;

    try {
      const saved = storageService.saveDraftOrder(
        {
          onboardingRequestId,
          title,
          category,
          expectedDeliveryDate,
          deliveryLocation,
          paymentTerms,
          notes,
          lineItems,
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        editingOrder?.id
      );
      setFormOpen(false);
      onDataChanged(`Order ${saved.id} saved as draft.`);
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Failed to save order draft.",
        "error"
      );
    }
  };

  const handleSubmit = () => {
    const validationErrors = validateOrderForm(
      {
        onboardingRequestId,
        title,
        category,
        expectedDeliveryDate,
        deliveryLocation,
        paymentTerms,
        lineItems,
      },
      approvedEntities,
      false
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      const submitted = storageService.submitOrderRequest(
        {
          onboardingRequestId,
          title,
          category,
          expectedDeliveryDate,
          deliveryLocation,
          paymentTerms,
          notes,
          lineItems,
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        editingOrder?.id
      );
      setFormOpen(false);
      onDataChanged(`Order ${submitted.id} submitted for AM review.`);
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Failed to submit order request.",
        "error"
      );
    }
  };

  const columns: ColumnDef<OrderRequest>[] = [
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
      key: "title",
      header: "ORDER SUMMARY",
      sortable: true,
      sortValue: (o) => o.title,
      render: (o) => (
        <div className="max-w-[240px]">
          <p className="font-medium text-xs text-slate-900 truncate" title={o.title}>
            {o.title}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {o.vendorEntityName} · {o.onboardingRequestId}
          </p>
        </div>
      ),
    },
    {
      key: "totalAmount",
      header: "TOTAL (INCL. GST)",
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
      key: "expectedDeliveryDate",
      header: "DELIVERY BY",
      sortable: true,
      sortValue: (o) => o.expectedDeliveryDate,
      render: (o) => (
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {o.expectedDeliveryDate || "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "CREATED AT",
      sortable: true,
      sortValue: (o) => o.createdAt,
      render: (o) => (
        <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
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

  const getRowActions = (order: OrderRequest): RowAction<OrderRequest>[] => {
    const canEdit =
      order.status === "DRAFT" || order.status === "CHANGES_REQUESTED";
    const actions: RowAction<OrderRequest>[] = [
      {
        label: "Edit / Resume",
        icon: <Edit3 className="w-3.5 h-3.5 text-slate-500" />,
        disabled: !canEdit,
        onClick: (r) => openEditModal(r),
      },
      {
        label: "View Order",
        icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
        onClick: (r) => setViewingOrder(r),
      },
    ];
    if (order.status === "APPROVED") {
      actions.push({
        label: "Raise Invoice",
        icon: <Receipt className="w-3.5 h-3.5 text-emerald-600" />,
        onClick: (r) => onRaiseInvoiceFromOrder(r),
      });
    }
    return actions;
  };

  if (approvedEntities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Order Requests</h1>
          <p className="text-sm text-slate-600 mt-1">
            Raise supply or service order requests for your onboarded entities.
          </p>
        </div>
        <OnboardingGateBanner
          featureName="Order Requests"
          vendorRequests={vendorRequests}
          onGoToOnboarding={onNavigateToOnboarding}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Order Requests</h1>
          <p className="text-sm text-slate-600 mt-1">
            Raise commercial order requests for your approved vendor entities and track PO sign-off.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Order Request</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-slate-200 rounded-xl p-4"
          >
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p
              className={`text-2xl font-bold tracking-tight tabular-nums mt-1.5 ${kpi.accent}`}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search order requests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order ID, Title, or Entity..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <DropSearch
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: "ALL", label: "All Statuses" },
              ...ORDER_STATUSES.map((st) => ({
                value: st,
                label: formatOrderStatusLabel(st),
              })),
            ]}
            placeholder="Filter by status..."
          />

          <DropSearch
            value={entityFilter}
            onChange={(val) => setEntityFilter(val)}
            options={[
              { value: "ALL", label: "All Onboarded Entities" },
              ...approvedEntities.map((ent) => ({
                value: ent.id,
                label: `${ent.businessInfo.legalBusinessName} (${ent.id})`,
              })),
            ]}
            placeholder="Filter by entity..."
          />
        </div>
      </div>

      <DataTable
        data={filteredOrders}
        columns={columns}
        getRowId={(o) => o.id}
        getRowLabel={(o) => o.id}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        compact
        emptyTitle="No order requests yet"
        emptyDescription="Raise your first order request against an onboarded vendor entity."
        emptyAction={
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Create Order Request</span>
          </button>
        }
      />

      {/* Create / Edit Order Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingOrder
            ? `Edit Order Request — ${editingOrder.id}`
            : "Raise New Order Request"
        }
        subtitle="Only approved & onboarded vendor entities are eligible for commercial order requests."
        maxWidthClass="max-w-4xl"
      >
        <div className="p-6 space-y-5">
          {editingOrder?.status === "CHANGES_REQUESTED" &&
            editingOrder.remarkHistory.length > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Manager Requested Changes</p>
                  <p className="mt-0.5">
                    {
                      editingOrder.remarkHistory[
                        editingOrder.remarkHistory.length - 1
                      ].message
                    }
                  </p>
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Onboarded Vendor Entity <span className="text-red-500">*</span>
              </label>
              <DropSearch
                value={onboardingRequestId}
                onChange={(val) => {
                  setOnboardingRequestId(val);
                  const found = approvedEntities.find((e) => e.id === val);
                  if (found && !category) {
                    setCategory(found.businessInfo.businessCategory);
                  }
                }}
                options={approvedEntities.map((ent) => ({
                  value: ent.id,
                  label: `${ent.businessInfo.legalBusinessName} · ${ent.businessInfo.gstin} (${ent.id})`,
                }))}
                placeholder="Select onboarded entity..."
              />
              {errors.onboardingRequestId && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.onboardingRequestId}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Order Title / Scope Summary <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly West Zone Linehaul Dispatch Contract"
                className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.title
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                }`}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-1">{errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Order Category <span className="text-red-500">*</span>
              </label>
              <DropSearch
                value={category}
                onChange={(val) => setCategory(val)}
                options={BUSINESS_CATEGORIES.map((c) => ({
                  value: c,
                  label: c,
                }))}
                placeholder="Select category..."
              />
              {errors.category && (
                <p className="text-xs text-red-600 mt-1">{errors.category}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <DropSearch
                value={paymentTerms}
                onChange={(val) => setPaymentTerms(val as PaymentTerms)}
                options={PAYMENT_TERMS_OPTIONS.map((t) => ({
                  value: t,
                  label: t,
                }))}
                placeholder="Select payment terms..."
              />
              {errors.paymentTerms && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.paymentTerms}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expected Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.expectedDeliveryDate
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                }`}
              />
              {errors.expectedDeliveryDate && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.expectedDeliveryDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Delivery Location / Hub <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="e.g. Pune Hub, Maharashtra"
                className={`w-full px-3.5 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.deliveryLocation
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                }`}
              />
              {errors.deliveryLocation && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.deliveryLocation}
                </p>
              )}
            </div>
          </div>

          <LineItemsEditor
            items={lineItems}
            onChange={setLineItems}
            errors={errors}
          />

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Commercial Notes / SLA Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any delivery milestones, packaging specs, or SLA instructions..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>

          {/* Totals Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-600 space-y-0.5">
              <p>
                Taxable Subtotal:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {formatINR(formTotals.subtotal)}
                </span>
              </p>
              <p>
                Total GST:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {formatINR(formTotals.taxAmount)}
                </span>
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Total Order Value
              </p>
              <p className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {formatINR(formTotals.totalAmount)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Order Request</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* View Order Modal */}
      <Modal
        open={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        title={viewingOrder ? `${viewingOrder.id} — ${viewingOrder.title}` : ""}
        subtitle={
          viewingOrder
            ? `${viewingOrder.vendorEntityName} · GSTIN: ${viewingOrder.gstin}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {viewingOrder && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>
                  Onboarded Dossier:{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {viewingOrder.onboardingRequestId}
                  </span>
                </p>
                <p>
                  Reviewer:{" "}
                  <span className="font-medium text-slate-800">
                    {viewingOrder.assignedSmId
                      ? `${userNameMap.get(viewingOrder.assignedSmId) ?? viewingOrder.assignedSmId} (SM)`
                      : viewingOrder.assignedAmId
                      ? `${userNameMap.get(viewingOrder.assignedAmId) ?? viewingOrder.assignedAmId} (AM)`
                      : "Pending Assignment"}
                  </span>
                </p>
              </div>
              <OrderStatusTag status={viewingOrder.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div>
                <p className="text-slate-500">Category</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {viewingOrder.category || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Payment Terms</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {viewingOrder.paymentTerms}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Delivery By</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {viewingOrder.expectedDeliveryDate || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Delivery Location</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {viewingOrder.deliveryLocation || "—"}
                </p>
              </div>
            </div>

            <LineItemsEditor items={viewingOrder.lineItems} readOnly />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div className="space-y-0.5 text-slate-600">
                <p>
                  Subtotal:{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {formatINR(viewingOrder.subtotal)}
                  </span>
                </p>
                <p>
                  GST Tax:{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {formatINR(viewingOrder.taxAmount)}
                  </span>
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-slate-500 font-medium">Total Order Value</p>
                <p className="text-lg font-bold font-mono text-slate-900">
                  {formatINR(viewingOrder.totalAmount)}
                </p>
              </div>
            </div>

            {viewingOrder.notes && (
              <div className="text-xs bg-white border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-700 mb-0.5">Notes</p>
                <p className="text-slate-600">{viewingOrder.notes}</p>
              </div>
            )}

            <RemarkTimeline remarks={viewingOrder.remarkHistory} />

            <div className="flex items-center justify-end gap-2 pt-2">
              {viewingOrder.status === "APPROVED" && (
                <button
                  type="button"
                  onClick={() => {
                    const ord = viewingOrder;
                    setViewingOrder(null);
                    onRaiseInvoiceFromOrder(ord);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Raise Invoice Against Order</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
