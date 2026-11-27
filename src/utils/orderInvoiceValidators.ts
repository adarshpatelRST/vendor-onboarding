import {
  InvoiceRequest,
  OnboardingRequest,
  OrderLineItem,
  OrderRequest,
  User,
} from "../types/models";

export const MAX_INVOICE_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_INVOICE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface InvoiceTotals extends OrderTotals {
  tdsAmount: number;
  netPayableAmount: number;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeLineItemsTotals(lineItems: OrderLineItem[]): OrderTotals {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of lineItems) {
    const qty = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    const price = Number.isFinite(item.unitPrice)
      ? Math.max(0, item.unitPrice)
      : 0;
    const gst = Number.isFinite(item.gstRate) ? Math.max(0, item.gstRate) : 0;
    const lineBase = qty * price;
    const lineTax = (lineBase * gst) / 100;
    subtotal += lineBase;
    taxAmount += lineTax;
  }

  const roundedSub = roundCurrency(subtotal);
  const roundedTax = roundCurrency(taxAmount);
  return {
    subtotal: roundedSub,
    taxAmount: roundedTax,
    totalAmount: roundCurrency(roundedSub + roundedTax),
  };
}

export function computeInvoiceTotals(
  lineItems: OrderLineItem[],
  tdsRate: number
): InvoiceTotals {
  const base = computeLineItemsTotals(lineItems);
  const safeTds = Number.isFinite(tdsRate) ? Math.max(0, Math.min(30, tdsRate)) : 0;
  // TDS in India is deducted on the base taxable value (subtotal before GST)
  const tdsAmount = roundCurrency((base.subtotal * safeTds) / 100);
  const netPayableAmount = roundCurrency(Math.max(0, base.totalAmount - tdsAmount));
  return {
    ...base,
    tdsAmount,
    netPayableAmount,
  };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function getApprovedOnboardingRequestsForVendor(
  vendorUserId: string,
  requests: OnboardingRequest[]
): OnboardingRequest[] {
  return requests.filter(
    (r) => r.vendorUserId === vendorUserId && r.status === "APPROVED"
  );
}

export function validateLineItems(
  lineItems: OrderLineItem[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (lineItems.length === 0) {
    errors.lineItems = "Add at least one line item.";
    return errors;
  }

  lineItems.forEach((item, idx) => {
    if (!item.description.trim()) {
      errors[`line_${idx}_description`] = "Item description is required.";
    }
    if (
      item.hsnSacCode.trim() &&
      !/^\d{4,8}$/.test(item.hsnSacCode.trim())
    ) {
      errors[`line_${idx}_hsn`] = "HSN/SAC must be 4–8 digits.";
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors[`line_${idx}_quantity`] = "Qty must be > 0.";
    }
    if (!item.unit.trim()) {
      errors[`line_${idx}_unit`] = "Unit is required.";
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      errors[`line_${idx}_unitPrice`] = "Rate must be > 0.";
    }
  });

  return errors;
}

export function validateOrderForm(
  input: {
    onboardingRequestId: string;
    title: string;
    category: string;
    expectedDeliveryDate: string;
    deliveryLocation: string;
    paymentTerms: string;
    lineItems: OrderLineItem[];
  },
  approvedRequests: OnboardingRequest[],
  isDraft = false
): Record<string, string> {
  const errors: Record<string, string> = {};
  const entity = approvedRequests.find(
    (r) => r.id === input.onboardingRequestId
  );
  if (!entity) {
    errors.onboardingRequestId =
      "Select an approved & onboarded vendor entity.";
  }

  const title = input.title.trim();
  if (!title) {
    errors.title = "Order title is required.";
  } else if (title.length < 4 || title.length > 120) {
    errors.title = "Order title must be between 4 and 120 characters.";
  }

  if (isDraft) {
    return errors;
  }

  if (!input.category.trim()) {
    errors.category = "Order category is required.";
  }

  if (!input.expectedDeliveryDate.trim()) {
    errors.expectedDeliveryDate = "Expected delivery date is required.";
  }

  if (!input.deliveryLocation.trim()) {
    errors.deliveryLocation = "Delivery location is required.";
  } else if (input.deliveryLocation.trim().length < 2) {
    errors.deliveryLocation = "Enter a valid delivery location.";
  }

  if (!input.paymentTerms.trim()) {
    errors.paymentTerms = "Payment terms are required.";
  }

  const lineErrors = validateLineItems(input.lineItems);
  return { ...errors, ...lineErrors };
}

export function validateInvoiceAttachment(
  fileName: string,
  fileSizeBytes: number
): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_INVOICE_EXTENSIONS.includes(ext)) {
    return "Invalid file type. Allowed: .pdf, .jpg, .jpeg, .png";
  }
  if (fileSizeBytes > MAX_INVOICE_FILE_BYTES) {
    return "Invoice attachment must not exceed 5 MB.";
  }
  return null;
}

export function findInvoiceNumberConflict(
  invoiceNumber: string,
  vendorUserId: string,
  allInvoices: InvoiceRequest[],
  excludeInvoiceId?: string
): InvoiceRequest | null {
  const normalized = invoiceNumber.trim().toUpperCase();
  if (!normalized) return null;
  return (
    allInvoices.find(
      (inv) =>
        inv.id !== excludeInvoiceId &&
        inv.vendorUserId === vendorUserId &&
        inv.status !== "REJECTED" &&
        inv.invoiceNumber.trim().toUpperCase() === normalized
    ) ?? null
  );
}

export function validateInvoiceForm(
  input: {
    onboardingRequestId: string;
    orderId: string | null;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    tdsRate: number;
    lineItems: OrderLineItem[];
    attachmentFileName: string;
  },
  approvedRequests: OnboardingRequest[],
  approvedOrders: OrderRequest[],
  allInvoices: InvoiceRequest[],
  vendorUserId: string,
  excludeInvoiceId?: string,
  isDraft = false
): Record<string, string> {
  const errors: Record<string, string> = {};
  const entity = approvedRequests.find(
    (r) => r.id === input.onboardingRequestId
  );
  if (!entity) {
    errors.onboardingRequestId =
      "Select an approved & onboarded vendor entity.";
  }

  if (input.orderId) {
    const validOrder = approvedOrders.find(
      (o) =>
        o.id === input.orderId &&
        o.onboardingRequestId === input.onboardingRequestId &&
        o.status === "APPROVED"
    );
    if (!validOrder) {
      errors.orderId = "Linked order must be an approved order for this entity.";
    }
  }

  const invNo = input.invoiceNumber.trim();
  if (!invNo) {
    errors.invoiceNumber = "Tax invoice number is required.";
  } else if (invNo.length < 3 || invNo.length > 40) {
    errors.invoiceNumber = "Invoice number must be between 3 and 40 characters.";
  } else if (
    findInvoiceNumberConflict(invNo, vendorUserId, allInvoices, excludeInvoiceId)
  ) {
    errors.invoiceNumber =
      "An active or paid invoice already exists with this invoice number.";
  }

  if (isDraft) {
    return errors;
  }

  if (!input.invoiceDate.trim()) {
    errors.invoiceDate = "Invoice date is required.";
  }
  if (!input.dueDate.trim()) {
    errors.dueDate = "Due date is required.";
  } else if (
    input.invoiceDate.trim() &&
    input.dueDate.trim() < input.invoiceDate.trim()
  ) {
    errors.dueDate = "Due date cannot be earlier than invoice date.";
  }

  if (
    !Number.isFinite(input.tdsRate) ||
    input.tdsRate < 0 ||
    input.tdsRate > 30
  ) {
    errors.tdsRate = "TDS rate must be between 0% and 30%.";
  }

  if (!input.attachmentFileName.trim()) {
    errors.attachment = "Tax invoice document attachment is required.";
  }

  const lineErrors = validateLineItems(input.lineItems);
  return { ...errors, ...lineErrors };
}

export function getAccessibleOrdersForReviewer(
  user: User,
  orders: OrderRequest[]
): OrderRequest[] {
  if (user.role === "ADMIN") return orders;
  if (user.role === "AM") {
    return orders.filter(
      (ord) =>
        ord.assignedAmId === user.id ||
        (ord.assignedAmId === null &&
          user.mappedBusinessTypes.includes(ord.businessType) &&
          ord.status === "PENDING_AM_REVIEW")
    );
  }
  if (user.role === "SM") {
    return orders.filter(
      (ord) =>
        ord.assignedSmId === user.id ||
        (ord.assignedSmId === null &&
          user.mappedBusinessTypes.includes(ord.businessType) &&
          ord.status === "PENDING_SM_APPROVAL")
    );
  }
  return [];
}

export function getAccessibleInvoicesForReviewer(
  user: User,
  invoices: InvoiceRequest[]
): InvoiceRequest[] {
  if (user.role === "ADMIN") return invoices;
  if (user.role === "AM") {
    return invoices.filter(
      (inv) =>
        inv.assignedAmId === user.id ||
        (inv.assignedAmId === null &&
          user.mappedBusinessTypes.includes(inv.businessType) &&
          inv.status === "PENDING_AM_REVIEW")
    );
  }
  if (user.role === "SM") {
    return invoices.filter(
      (inv) =>
        inv.assignedSmId === user.id ||
        (inv.assignedSmId === null &&
          user.mappedBusinessTypes.includes(inv.businessType) &&
          inv.status === "PENDING_SM_APPROVAL")
    );
  }
  return [];
}
