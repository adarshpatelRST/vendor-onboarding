import {
  InvoiceStatus,
  OrderStatus,
  RequestStatus,
  UserRole,
  UserStatus,
} from "../../types/models";

const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; classes: string }
> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PENDING_AM_REVIEW: {
    label: "Pending AM Review",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CHANGES_REQUESTED: {
    label: "Changes Requested",
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PENDING_SM_APPROVAL: {
    label: "Pending SM Approval",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  QUERY_TO_AM: {
    label: "Query to AM",
    classes: "bg-orange-50 text-orange-800 border-orange-200",
  },
  APPROVED: {
    label: "Approved",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SUPERSEDED: {
    label: "Superseded",
    classes: "bg-slate-100 text-slate-600 border-slate-300",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-50 text-red-700 border-red-200",
  },
};

const ROLE_META: Record<UserRole, { label: string; classes: string }> = {
  VENDOR: {
    label: "Vendor",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  AM: {
    label: "Account Manager",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SM: {
    label: "Senior Manager",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  ADMIN: {
    label: "Admin",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export function RequestStatusTag({ status }: { status: RequestStatus }) {
  const meta = REQUEST_STATUS_META[status] ?? {
    label: status,
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

export function RoleTag({
  role,
  compact = false,
}: {
  role: UserRole;
  compact?: boolean;
}) {
  const meta = ROLE_META[role];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${meta.classes}`}
    >
      {compact ? role : meta.label}
    </span>
  );
}

export function UserStatusTag({ status }: { status: UserStatus }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"
        }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ActiveFlagTag({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-600 border-slate-200"
        }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function formatRequestStatusLabel(status: RequestStatus): string {
  return REQUEST_STATUS_META[status]?.label ?? status;
}

const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; classes: string }
> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PENDING_AM_REVIEW: {
    label: "Pending AM Review",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CHANGES_REQUESTED: {
    label: "Changes Requested",
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PENDING_SM_APPROVAL: {
    label: "Pending SM Approval",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  APPROVED: {
    label: "Approved (PO Active)",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-50 text-red-700 border-red-200",
  },
};

const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; classes: string }
> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PENDING_AM_REVIEW: {
    label: "Pending AM Review",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CHANGES_REQUESTED: {
    label: "Changes Requested",
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  PENDING_SM_APPROVAL: {
    label: "Pending SM Approval",
    classes: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  APPROVED: {
    label: "Approved for Payout",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  PAID: {
    label: "Paid / Settled",
    classes: "bg-teal-50 text-teal-800 border-teal-200",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-50 text-red-700 border-red-200",
  },
};

export function OrderStatusTag({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? {
    label: status,
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

export function InvoiceStatusTag({ status }: { status: InvoiceStatus }) {
  const meta = INVOICE_STATUS_META[status] ?? {
    label: status,
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

export function formatOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_META[status]?.label ?? status;
}

export function formatInvoiceStatusLabel(status: InvoiceStatus): string {
  return INVOICE_STATUS_META[status]?.label ?? status;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
