export type UserRole = "VENDOR" | "AM" | "SM" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  mappedBusinessTypes: string[];
  allowModificationOnboarding?: boolean;
  createdAt: string;
}

export interface BusinessType {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export type RequestStatus =
  | "DRAFT"
  | "PENDING_AM_REVIEW"
  | "CHANGES_REQUESTED"
  | "PENDING_SM_APPROVAL"
  | "QUERY_TO_AM"
  | "APPROVED"
  | "SUPERSEDED"
  | "REJECTED";

export type DocumentType =
  | "PAN_CARD"
  | "GST_CERT"
  | "CANCELLED_CHEQUE"
  | "INCORP_CERT"
  | "MSME_CERT";

export interface RequestDocument {
  docType: DocumentType;
  label: string;
  required: boolean;
  docNumber: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
  fileData?: string;
}

export interface RemarkEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  message: string;
  timestamp: string;
}

export interface OnboardingRequest {
  id: string;
  vendorUserId: string;
  status: RequestStatus;
  isModificationRequest?: boolean;
  replacesRequestId?: string | null;
  assignedAmId: string | null;
  assignedSmId: string | null;
  businessInfo: {
    legalBusinessName: string;
    tradeName: string;
    businessType: string;
    businessCategory: string;
    yearEstablished: string;
    gstin: string;
    pan: string;
    msmeNumber: string;
  };
  contactInfo: {
    primaryContactName: string;
    designation: string;
    email: string;
    phone: string;
    registeredAddress: string;
    city: string;
    state: string;
    pincode: string;
  };
  bankInfo: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountType: "Current" | "Savings" | "Overdraft";
  };
  documents: RequestDocument[];
  remarkHistory: RemarkEntry[];
  createdAt: string;
  updatedAt: string;
}

export type AuditTableName =
  | "Request"
  | "Order"
  | "Invoice"
  | "User"
  | "BusinessType"
  | "UserBusinessMapping";

export type OrderStatus =
  | "DRAFT"
  | "PENDING_AM_REVIEW"
  | "CHANGES_REQUESTED"
  | "PENDING_SM_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type InvoiceStatus =
  | "DRAFT"
  | "PENDING_AM_REVIEW"
  | "CHANGES_REQUESTED"
  | "PENDING_SM_APPROVAL"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

export type PaymentTerms =
  | "Advance"
  | "Net 15"
  | "Net 30"
  | "Net 45"
  | "Net 60";

export interface OrderLineItem {
  id: string;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstRate: 0 | 5 | 12 | 18 | 28;
}

export interface OrderRequest {
  id: string;
  vendorUserId: string;
  onboardingRequestId: string;
  vendorEntityName: string;
  businessType: string;
  gstin: string;
  status: OrderStatus;
  title: string;
  category: string;
  expectedDeliveryDate: string;
  deliveryLocation: string;
  paymentTerms: PaymentTerms;
  notes: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  assignedAmId: string | null;
  assignedSmId: string | null;
  remarkHistory: RemarkEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceAttachment {
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
  fileData?: string;
}

export interface InvoiceRequest {
  id: string;
  vendorUserId: string;
  onboardingRequestId: string;
  orderId: string | null;
  vendorEntityName: string;
  businessType: string;
  gstin: string;
  status: InvoiceStatus;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: OrderLineItem[];
  subtotal: number;
  taxAmount: number;
  tdsRate: number;
  tdsAmount: number;
  netPayableAmount: number;
  attachment: InvoiceAttachment | null;
  notes: string;
  assignedAmId: string | null;
  assignedSmId: string | null;
  remarkHistory: RemarkEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  tableName: AuditTableName;
  recordId: string;
  action: string;
  performedByName: string;
  performedByRole: string;
  performedAt: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export interface ActorContext {
  id: string;
  name: string;
  role: UserRole;
}
