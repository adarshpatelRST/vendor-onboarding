import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Edit3,
  Eye,
  FileText,
  Plus,
  Receipt,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { storageService } from "../../services/storageService";
import {
  InvoiceAttachment,
  InvoiceRequest,
  InvoiceStatus,
  OnboardingRequest,
  OrderLineItem,
  OrderRequest,
  RequestDocument,
  User,
} from "../../types/models";
import {
  openDocumentInNewTab,
  readFileAsDataUrl,
  registerDocumentBlob,
  dataUrlToBlob,
} from "../../utils/fileBlobStore";
import {
  computeInvoiceTotals,
  formatINR,
  getApprovedOnboardingRequestsForVendor,
  validateInvoiceAttachment,
  validateInvoiceForm,
} from "../../utils/orderInvoiceValidators";
import { formatFileSize } from "../../utils/requestValidators";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { downloadKycDocument } from "../common/DocumentPreviewModal";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import { RemarkTimeline } from "../common/RemarkTimeline";
import {
  formatDateTime,
  formatInvoiceStatusLabel,
  InvoiceStatusTag,
} from "../common/StatusBadge";
import { createEmptyLineItem, LineItemsEditor } from "./LineItemsEditor";
import { OnboardingGateBanner } from "./OnboardingGateBanner";

interface VendorInvoicesPageProps {
  currentUser: User;
  requests: OnboardingRequest[];
  orders: OrderRequest[];
  invoices: InvoiceRequest[];
  users: User[];
  initialCreateContext?: {
    onboardingRequestId?: string;
    orderId?: string;
  } | null;
  onClearInitialCreate?: () => void;
  onNavigateToOnboarding: () => void;
  onDataChanged: (message: string, type?: "success" | "error") => void;
}

const INVOICE_STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "PENDING_AM_REVIEW",
  "CHANGES_REQUESTED",
  "PENDING_SM_APPROVAL",
  "APPROVED",
  "PAID",
  "REJECTED",
];

const TDS_RATES = [0, 1, 2, 5, 10];

export function toInvoicePreviewDoc(
  attachment: InvoiceAttachment,
  invoiceNumber: string
): RequestDocument {
  return {
    docType: "GST_CERT",
    label: `Tax Invoice ${invoiceNumber || ""}`.trim(),
    required: true,
    docNumber: invoiceNumber || "TAX-INVOICE",
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
    uploadedAt: attachment.uploadedAt,
    fileData: attachment.fileData,
  };
}

export function VendorInvoicesPage({
  currentUser,
  requests,
  orders,
  invoices,
  users,
  initialCreateContext,
  onClearInitialCreate,
  onNavigateToOnboarding,
  onDataChanged,
}: VendorInvoicesPageProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRequest | null>(
    null
  );
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceRequest | null>(
    null
  );

  // Form fields
  const [onboardingRequestId, setOnboardingRequestId] = useState("");
  const [orderId, setOrderId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tdsRate, setTdsRate] = useState<number>(2);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([
    createEmptyLineItem(),
  ]);
  const [attachment, setAttachment] = useState<InvoiceAttachment | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const vendorRequests = useMemo(
    () => requests.filter((r) => r.vendorUserId === currentUser.id),
    [requests, currentUser.id]
  );

  const approvedEntities = useMemo(
    () => getApprovedOnboardingRequestsForVendor(currentUser.id, requests),
    [currentUser.id, requests]
  );

  const approvedOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.vendorUserId === currentUser.id && o.status === "APPROVED"
      ),
    [orders, currentUser.id]
  );

  const myInvoices = useMemo(
    () => invoices.filter((i) => i.vendorUserId === currentUser.id),
    [invoices, currentUser.id]
  );

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const selectedEntity = useMemo(
    () => approvedEntities.find((e) => e.id === onboardingRequestId) ?? null,
    [approvedEntities, onboardingRequestId]
  );

  const entityApprovedOrders = useMemo(
    () =>
      approvedOrders.filter((o) => o.onboardingRequestId === onboardingRequestId),
    [approvedOrders, onboardingRequestId]
  );

  const openCreateModal = (context?: {
    onboardingRequestId?: string;
    orderId?: string;
  }) => {
    const linkedOrd = context?.orderId
      ? approvedOrders.find((o) => o.id === context.orderId) ?? null
      : null;
    const defaultEntity =
      approvedEntities.find(
        (e) =>
          e.id === (linkedOrd?.onboardingRequestId ?? context?.onboardingRequestId)
      ) ?? approvedEntities[0];

    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    setEditingInvoice(null);
    setOnboardingRequestId(defaultEntity?.id ?? "");
    setOrderId(linkedOrd?.id ?? "");
    setInvoiceNumber("");
    setInvoiceDate(today);
    setDueDate(due);
    setTdsRate(2);
    setNotes(linkedOrd ? `Billing against approved order ${linkedOrd.id}` : "");
    setLineItems(
      linkedOrd && linkedOrd.lineItems.length > 0
        ? linkedOrd.lineItems.map((li) => ({
            ...li,
            id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          }))
        : [createEmptyLineItem()]
    );
    setAttachment(null);
    setErrors({});
    setFormOpen(true);
  };

  useEffect(() => {
    if (initialCreateContext && approvedEntities.length > 0) {
      openCreateModal(initialCreateContext);
      onClearInitialCreate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCreateContext, approvedEntities.length]);

  const openEditModal = (inv: InvoiceRequest) => {
    setEditingInvoice(inv);
    setOnboardingRequestId(inv.onboardingRequestId);
    setOrderId(inv.orderId ?? "");
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.invoiceDate);
    setDueDate(inv.dueDate);
    setTdsRate(inv.tdsRate);
    setNotes(inv.notes);
    setLineItems(
      inv.lineItems.length > 0
        ? inv.lineItems.map((li) => ({ ...li }))
        : [createEmptyLineItem()]
    );
    setAttachment(inv.attachment ? { ...inv.attachment } : null);
    setErrors({});
    setFormOpen(true);
  };

  const handleOrderLinkChange = (nextOrderId: string) => {
    setOrderId(nextOrderId);
    if (!nextOrderId) return;
    const ord = approvedOrders.find((o) => o.id === nextOrderId);
    if (ord && ord.lineItems.length > 0) {
      setLineItems(
        ord.lineItems.map((li) => ({
          ...li,
          id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        }))
      );
      if (!notes.trim()) {
        setNotes(`Tax invoice against approved order ${ord.id}`);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateInvoiceAttachment(file.name, file.size);
    if (err) {
      setErrors((prev) => ({ ...prev, attachment: err }));
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const blob = dataUrlToBlob(dataUrl);
      registerDocumentBlob(file.name, blob);
      registerDocumentBlob(`INVOICE_${file.name}`, blob);
      setAttachment({
        fileName: file.name,
        fileType: file.type || "application/pdf",
        fileSize: formatFileSize(file.size),
        uploadedAt: new Date().toISOString(),
        fileData: dataUrl,
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.attachment;
        return next;
      });
    } catch {
      setErrors((prev) => ({
        ...prev,
        attachment: "Unable to read the selected file.",
      }));
    }
    e.target.value = "";
  };

  const handleAttachSampleInvoice = () => {
    const cleanNo = (invoiceNumber.trim() || "SAMPLE-INV").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    setAttachment({
      fileName: `tax_invoice_${cleanNo}.pdf`,
      fileType: "application/pdf",
      fileSize: "465 KB",
      uploadedAt: new Date().toISOString(),
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.attachment;
      return next;
    });
  };

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myInvoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      if (entityFilter !== "ALL" && inv.onboardingRequestId !== entityFilter)
        return false;
      if (!q) return true;
      return (
        inv.id.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.vendorEntityName.toLowerCase().includes(q) ||
        (inv.orderId ?? "").toLowerCase().includes(q)
      );
    });
  }, [myInvoices, search, statusFilter, entityFilter]);

  const kpis = useMemo(() => {
    const total = myInvoices.length;
    const underReview = myInvoices.filter(
      (i) =>
        i.status === "PENDING_AM_REVIEW" ||
        i.status === "PENDING_SM_APPROVAL" ||
        i.status === "CHANGES_REQUESTED"
    ).length;
    const settledOrApproved = myInvoices.filter(
      (i) => i.status === "APPROVED" || i.status === "PAID"
    );
    const totalPayable = settledOrApproved.reduce(
      (sum, i) => sum + i.netPayableAmount,
      0
    );
    return [
      { label: "Total Invoices", value: String(total), accent: "text-slate-900" },
      { label: "Under Review / Action", value: String(underReview), accent: "text-blue-600" },
      { label: "Approved / Settled", value: String(settledOrApproved.length), accent: "text-emerald-600" },
      { label: "Approved Net Payable", value: formatINR(totalPayable), accent: "text-slate-900" },
    ];
  }, [myInvoices]);

  const formTotals = useMemo(
    () => computeInvoiceTotals(lineItems, tdsRate),
    [lineItems, tdsRate]
  );

  const handleSaveDraft = () => {
    const draftErrors = validateInvoiceForm(
      {
        onboardingRequestId,
        orderId: orderId || null,
        invoiceNumber,
        invoiceDate,
        dueDate,
        tdsRate,
        lineItems,
        attachmentFileName: attachment?.fileName ?? "",
      },
      approvedEntities,
      approvedOrders,
      invoices,
      currentUser.id,
      editingInvoice?.id,
      true
    );
    setErrors(draftErrors);
    if (Object.keys(draftErrors).length > 0) return;

    try {
      const saved = storageService.saveDraftInvoice(
        {
          onboardingRequestId,
          orderId: orderId || null,
          invoiceNumber,
          invoiceDate,
          dueDate,
          tdsRate,
          lineItems,
          attachment,
          notes,
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        editingInvoice?.id
      );
      setFormOpen(false);
      onDataChanged(`Invoice ${saved.id} saved as draft.`);
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Failed to save invoice draft.",
        "error"
      );
    }
  };

  const handleSubmit = () => {
    const validationErrors = validateInvoiceForm(
      {
        onboardingRequestId,
        orderId: orderId || null,
        invoiceNumber,
        invoiceDate,
        dueDate,
        tdsRate,
        lineItems,
        attachmentFileName: attachment?.fileName ?? "",
      },
      approvedEntities,
      approvedOrders,
      invoices,
      currentUser.id,
      editingInvoice?.id,
      false
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      const submitted = storageService.submitInvoiceRequest(
        {
          onboardingRequestId,
          orderId: orderId || null,
          invoiceNumber,
          invoiceDate,
          dueDate,
          tdsRate,
          lineItems,
          attachment,
          notes,
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        editingInvoice?.id
      );
      setFormOpen(false);
      onDataChanged(`Invoice ${submitted.id} submitted for AM verification.`);
    } catch (err) {
      onDataChanged(
        err instanceof Error ? err.message : "Failed to submit invoice.",
        "error"
      );
    }
  };

  const columns: ColumnDef<InvoiceRequest>[] = [
    {
      key: "id",
      header: "INVOICE REQ ID",
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
      header: "TAX INVOICE NO.",
      sortable: true,
      sortValue: (i) => i.invoiceNumber,
      render: (i) => (
        <div>
          <p className="font-mono text-xs font-semibold text-slate-900">
            {i.invoiceNumber}
          </p>
          <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
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
        <div className="text-right">
          <p className="font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
            {formatINR(i.netPayableAmount)}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            TDS {i.tdsRate}%
          </p>
        </div>
      ),
    },
    {
      key: "dueDate",
      header: "DUE DATE",
      sortable: true,
      sortValue: (i) => i.dueDate,
      render: (i) => (
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {i.dueDate || "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "CREATED AT",
      sortable: true,
      sortValue: (i) => i.createdAt,
      render: (i) => (
        <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
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

  const getRowActions = (inv: InvoiceRequest): RowAction<InvoiceRequest>[] => {
    const canEdit =
      inv.status === "DRAFT" || inv.status === "CHANGES_REQUESTED";
    return [
      {
        label: "Edit / Resume",
        icon: <Edit3 className="w-3.5 h-3.5 text-slate-500" />,
        disabled: !canEdit,
        onClick: (r) => openEditModal(r),
      },
      {
        label: "View Invoice",
        icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
        onClick: (r) => setViewingInvoice(r),
      },
    ];
  };

  if (approvedEntities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Invoice Requests</h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit tax invoices and track payout approvals for your onboarded entities.
          </p>
        </div>
        <OnboardingGateBanner
          featureName="Invoice Requests"
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
          <h1 className="text-xl font-bold text-slate-900">Invoice Requests</h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit GST tax invoices against approved orders or onboarded entities and track settlement status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Invoice Request</span>
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
              aria-label="Search invoice requests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, Invoice No., Order ID, or Entity..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <DropSearch
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: "ALL", label: "All Statuses" },
              ...INVOICE_STATUSES.map((st) => ({
                value: st,
                label: formatInvoiceStatusLabel(st),
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
        data={filteredInvoices}
        columns={columns}
        getRowId={(i) => i.id}
        getRowLabel={(i) => i.id}
        getRowActions={getRowActions}
        defaultSortKey="createdAt"
        defaultSortDirection="desc"
        compact
        emptyTitle="No invoice requests yet"
        emptyDescription="Submit a GST tax invoice for an onboarded vendor entity or approved order."
        emptyAction={
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Raise Invoice Request</span>
          </button>
        }
      />

      {/* Create / Edit Invoice Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingInvoice
            ? `Edit Invoice Request — ${editingInvoice.id}`
            : "Raise New Invoice Request"
        }
        subtitle="Settlement payouts are routed to the verified bank account on your approved onboarding dossier."
        maxWidthClass="max-w-4xl"
      >
        <div className="p-6 space-y-5">
          {editingInvoice?.status === "CHANGES_REQUESTED" &&
            editingInvoice.remarkHistory.length > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Manager Requested Changes</p>
                  <p className="mt-0.5">
                    {
                      editingInvoice.remarkHistory[
                        editingInvoice.remarkHistory.length - 1
                      ].message
                    }
                  </p>
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Onboarded Vendor Entity <span className="text-red-500">*</span>
              </label>
              <DropSearch
                value={onboardingRequestId}
                onChange={(val) => {
                  setOnboardingRequestId(val);
                  setOrderId("");
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

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Link Approved Order (Optional)
              </label>
              <DropSearch
                value={orderId}
                onChange={handleOrderLinkChange}
                options={[
                  { value: "", label: "Direct Invoice (No Linked Order)" },
                  ...entityApprovedOrders.map((ord) => ({
                    value: ord.id,
                    label: `${ord.id} — ${ord.title} (${formatINR(ord.totalAmount)})`,
                  })),
                ]}
                placeholder="Select approved order..."
              />
              {errors.orderId && (
                <p className="text-xs text-red-600 mt-1">{errors.orderId}</p>
              )}
            </div>
          </div>

          {selectedEntity && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-semibold text-emerald-900">
                  Verified Settlement Bank: {selectedEntity.bankInfo.bankName}
                </p>
                <p className="text-emerald-800 font-mono mt-0.5">
                  A/C {selectedEntity.bankInfo.accountNumber} · IFSC{" "}
                  {selectedEntity.bankInfo.ifscCode}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-mono text-[11px] font-semibold text-emerald-800">
                GSTIN: {selectedEntity.businessInfo.gstin}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vendor Tax Invoice Number{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. KFM/2026-27/105"
                className={`w-full px-3.5 py-2 rounded-lg border font-mono text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.invoiceNumber
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                }`}
              />
              {errors.invoiceNumber && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.invoiceNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.invoiceDate
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                }`}
              />
              {errors.invoiceDate && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.invoiceDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.dueDate
                    ? "border-red-500"
                    : "border-slate-300 focus:border-blue-600"
                }`}
              />
              {errors.dueDate && (
                <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>
              )}
            </div>
          </div>

          <LineItemsEditor
            items={lineItems}
            onChange={setLineItems}
            errors={errors}
          />

          {/* Attachment & TDS */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
            <div className="sm:col-span-8">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tax Invoice Document (PDF / Image){" "}
                <span className="text-red-500">*</span>
              </label>
              {attachment ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {attachment.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {attachment.fileSize}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        openDocumentInNewTab(
                          toInvoicePreviewDoc(attachment, invoiceNumber),
                          selectedEntity?.businessInfo.legalBusinessName ??
                            "Vendor"
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Upload Tax Invoice</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleAttachSampleInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Attach Sample Invoice PDF</span>
                  </button>
                </div>
              )}
              {errors.attachment && (
                <p className="text-xs text-red-600 mt-1">{errors.attachment}</p>
              )}
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Applicable TDS Rate (%)
              </label>
              <select
                value={tdsRate}
                onChange={(e) => setTdsRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                {TDS_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}% {r === 2 ? "(Sec 194C Contractor)" : r === 10 ? "(Sec 194J Professional)" : r === 0 ? "(Exempt / None)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Delivery / POD Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference POD numbers, milestone completion notes, or billing period..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>

          {/* Totals Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Taxable Subtotal</p>
              <p className="font-mono font-semibold text-slate-900 mt-0.5">
                {formatINR(formTotals.subtotal)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">GST Tax (+)</p>
              <p className="font-mono font-semibold text-slate-900 mt-0.5">
                {formatINR(formTotals.taxAmount)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">TDS ({tdsRate}% -)</p>
              <p className="font-mono font-semibold text-amber-700 mt-0.5">
                -{formatINR(formTotals.tdsAmount)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-slate-500 font-semibold">Net Payable</p>
              <p className="text-lg font-bold font-mono text-emerald-700">
                {formatINR(formTotals.netPayableAmount)}
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
              <span>Submit Invoice Request</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        open={Boolean(viewingInvoice)}
        onClose={() => setViewingInvoice(null)}
        title={
          viewingInvoice
            ? `${viewingInvoice.id} — Invoice ${viewingInvoice.invoiceNumber}`
            : ""
        }
        subtitle={
          viewingInvoice
            ? `${viewingInvoice.vendorEntityName} · GSTIN: ${viewingInvoice.gstin}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {viewingInvoice && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>
                  Onboarded Dossier:{" "}
                  <span className="font-mono font-semibold text-slate-900">
                    {viewingInvoice.onboardingRequestId}
                  </span>
                  {viewingInvoice.orderId && (
                    <>
                      {" "}
                      · Linked Order:{" "}
                      <span className="font-mono font-semibold text-blue-700">
                        {viewingInvoice.orderId}
                      </span>
                    </>
                  )}
                </p>
                <p>
                  Reviewer:{" "}
                  <span className="font-medium text-slate-800">
                    {viewingInvoice.assignedSmId
                      ? `${userNameMap.get(viewingInvoice.assignedSmId) ?? viewingInvoice.assignedSmId} (SM)`
                      : viewingInvoice.assignedAmId
                      ? `${userNameMap.get(viewingInvoice.assignedAmId) ?? viewingInvoice.assignedAmId} (AM)`
                      : "Pending Assignment"}
                  </span>
                </p>
              </div>
              <InvoiceStatusTag status={viewingInvoice.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div>
                <p className="text-slate-500">Tax Invoice No.</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {viewingInvoice.invoiceNumber}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Invoice Date</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {viewingInvoice.invoiceDate}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Due Date</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {viewingInvoice.dueDate}
                </p>
              </div>
              <div>
                <p className="text-slate-500">TDS Applied</p>
                <p className="font-mono font-medium text-slate-900 mt-0.5">
                  {viewingInvoice.tdsRate}% ({formatINR(viewingInvoice.tdsAmount)})
                </p>
              </div>
            </div>

            {viewingInvoice.attachment && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {viewingInvoice.attachment.fileName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {viewingInvoice.attachment.fileSize}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openDocumentInNewTab(
                        toInvoicePreviewDoc(
                          viewingInvoice.attachment!,
                          viewingInvoice.invoiceNumber
                        ),
                        viewingInvoice.vendorEntityName
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
                          viewingInvoice.attachment!,
                          viewingInvoice.invoiceNumber
                        ),
                        viewingInvoice.vendorEntityName,
                        { gstin: viewingInvoice.gstin }
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

            <LineItemsEditor items={viewingInvoice.lineItems} readOnly />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Taxable Subtotal</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {formatINR(viewingInvoice.subtotal)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">GST Tax</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                  {formatINR(viewingInvoice.taxAmount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">TDS Deduction</p>
                <p className="font-mono font-semibold text-amber-700 mt-0.5">
                  -{formatINR(viewingInvoice.tdsAmount)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-slate-500 font-semibold">Net Payable</p>
                <p className="text-lg font-bold font-mono text-emerald-700">
                  {formatINR(viewingInvoice.netPayableAmount)}
                </p>
              </div>
            </div>

            {viewingInvoice.notes && (
              <div className="text-xs bg-white border border-slate-200 rounded-lg p-3">
                <p className="font-semibold text-slate-700 mb-0.5">Notes</p>
                <p className="text-slate-600">{viewingInvoice.notes}</p>
              </div>
            )}

            <RemarkTimeline remarks={viewingInvoice.remarkHistory} />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingInvoice(null)}
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
