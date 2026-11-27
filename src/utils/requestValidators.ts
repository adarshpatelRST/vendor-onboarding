import { KYC_DOC_TEMPLATES } from "../constants/india";
import {
  DocumentType,
  OnboardingRequest,
  RequestDocument,
  User,
} from "../types/models";
import { EMAIL_REGEX, INDIAN_MOBILE_REGEX } from "./validators";

export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
export const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const MAX_KYC_FILE_BYTES = 5 * 1024 * 1024;

export interface WizardFormData {
  businessInfo: OnboardingRequest["businessInfo"];
  contactInfo: OnboardingRequest["contactInfo"];
  bankInfo: OnboardingRequest["bankInfo"];
  documents: RequestDocument[];
}

export function buildEmptyDocuments(
  existing: RequestDocument[] = []
): RequestDocument[] {
  return KYC_DOC_TEMPLATES.map((tpl) => {
    const match = existing.find((d) => d.docType === tpl.docType);
    if (match) {
      return { ...match, label: tpl.label, required: tpl.required };
    }
    return {
      docType: tpl.docType,
      label: tpl.label,
      required: tpl.required,
      docNumber: "",
      fileName: "",
      fileType: "",
      fileSize: "",
      uploadedAt: "",
    };
  });
}

export function findGstinConflict(
  gstin: string,
  allRequests: OnboardingRequest[],
  excludeRequestId?: string,
  allowApprovedForVendorUserId?: string
): OnboardingRequest | null {
  const normalized = gstin.trim().toUpperCase();
  if (!normalized) return null;
  return (
    allRequests.find(
      (req) =>
        req.id !== excludeRequestId &&
        req.status !== "REJECTED" &&
        req.status !== "SUPERSEDED" &&
        !(
          allowApprovedForVendorUserId &&
          req.vendorUserId === allowApprovedForVendorUserId &&
          req.status === "APPROVED"
        ) &&
        req.businessInfo.gstin.trim().toUpperCase() === normalized
    ) ?? null
  );
}

export function validateStep1Business(
  businessInfo: OnboardingRequest["businessInfo"],
  allRequests: OnboardingRequest[],
  excludeRequestId?: string,
  allowApprovedForVendorUserId?: string
): Record<string, string> {
  const errors: Record<string, string> = {};
  const legalName = businessInfo.legalBusinessName.trim();
  const tradeName = businessInfo.tradeName.trim();
  const yearStr = businessInfo.yearEstablished.trim();
  const gstin = businessInfo.gstin.trim().toUpperCase();
  const pan = businessInfo.pan.trim().toUpperCase();
  const msme = businessInfo.msmeNumber.trim().toUpperCase();

  if (!legalName) {
    errors.legalBusinessName = "Legal business name is required.";
  } else if (legalName.length < 3 || legalName.length > 100) {
    errors.legalBusinessName =
      "Legal business name must be between 3 and 100 characters.";
  }

  if (tradeName.length > 100) {
    errors.tradeName = "Trade name must not exceed 100 characters.";
  }

  if (!businessInfo.businessType.trim()) {
    errors.businessType = "Business type is required.";
  }

  if (!businessInfo.businessCategory.trim()) {
    errors.businessCategory = "Business category is required.";
  }

  if (yearStr) {
    if (!/^\d{4}$/.test(yearStr)) {
      errors.yearEstablished = "Enter a valid 4-digit year (1900–2026).";
    } else {
      const yearNum = Number(yearStr);
      if (yearNum < 1900 || yearNum > 2026) {
        errors.yearEstablished = "Year established must be between 1900 and 2026.";
      }
    }
  }

  if (!gstin) {
    errors.gstin = "GSTIN is required.";
  } else if (!GSTIN_REGEX.test(gstin)) {
    errors.gstin = "Enter a valid 15-character GSTIN (e.g. 27AABCA1234D1Z5).";
  } else if (
    findGstinConflict(
      gstin,
      allRequests,
      excludeRequestId,
      allowApprovedForVendorUserId
    )
  ) {
    errors.gstin =
      "An active or approved onboarding request already exists for this GSTIN.";
  }

  if (!pan) {
    errors.pan = "PAN is required.";
  } else if (!PAN_REGEX.test(pan)) {
    errors.pan = "Enter a valid 10-character PAN (e.g. AABCA1234D).";
  }

  if (msme && !UDYAM_REGEX.test(msme)) {
    errors.msmeNumber =
      "Enter a valid Udyam number (e.g. UDYAM-MH-19-0045210).";
  }

  return errors;
}

export function validateStep2Contact(
  contactInfo: OnboardingRequest["contactInfo"]
): Record<string, string> {
  const errors: Record<string, string> = {};
  const contactName = contactInfo.primaryContactName.trim();
  const designation = contactInfo.designation.trim();
  const email = contactInfo.email.trim();
  const phone = contactInfo.phone.trim();
  const address = contactInfo.registeredAddress.trim();
  const city = contactInfo.city.trim();
  const state = contactInfo.state.trim();
  const pincode = contactInfo.pincode.trim();

  if (!contactName) {
    errors.primaryContactName = "Primary contact name is required.";
  } else if (contactName.length < 2 || contactName.length > 60) {
    errors.primaryContactName =
      "Primary contact name must be between 2 and 60 characters.";
  }

  if (!designation) {
    errors.designation = "Designation is required.";
  } else if (designation.length < 2 || designation.length > 50) {
    errors.designation = "Designation must be between 2 and 50 characters.";
  }

  if (!email) {
    errors.email = "Official email is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!phone) {
    errors.phone = "Mobile number is required.";
  } else if (!INDIAN_MOBILE_REGEX.test(phone)) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }

  if (!address) {
    errors.registeredAddress = "Registered address is required.";
  } else if (address.length < 10 || address.length > 200) {
    errors.registeredAddress =
      "Registered address must be between 10 and 200 characters.";
  }

  if (!city) {
    errors.city = "City is required.";
  } else if (city.length < 2 || city.length > 50) {
    errors.city = "City must be between 2 and 50 characters.";
  }

  if (!state) {
    errors.state = "State is required.";
  }

  if (!pincode) {
    errors.pincode = "Pincode is required.";
  } else if (!PINCODE_REGEX.test(pincode)) {
    errors.pincode = "Enter a valid 6-digit Indian pincode.";
  }

  return errors;
}

export function validateStep3Bank(
  bankInfo: OnboardingRequest["bankInfo"]
): Record<string, string> {
  const errors: Record<string, string> = {};
  const holder = bankInfo.accountHolderName.trim();
  const bankName = bankInfo.bankName.trim();
  const accountNumber = bankInfo.accountNumber.trim();
  const ifsc = bankInfo.ifscCode.trim().toUpperCase();

  if (!holder) {
    errors.accountHolderName = "Account holder name is required.";
  } else if (holder.length < 3 || holder.length > 100) {
    errors.accountHolderName =
      "Account holder name must be between 3 and 100 characters.";
  }

  if (!bankName) {
    errors.bankName = "Bank name is required.";
  } else if (bankName.length < 2 || bankName.length > 60) {
    errors.bankName = "Bank name must be between 2 and 60 characters.";
  }

  if (!accountNumber) {
    errors.accountNumber = "Account number is required.";
  } else if (!ACCOUNT_NUMBER_REGEX.test(accountNumber)) {
    errors.accountNumber = "Account number must be 9 to 18 numeric digits.";
  }

  if (!ifsc) {
    errors.ifscCode = "IFSC code is required.";
  } else if (!IFSC_REGEX.test(ifsc)) {
    errors.ifscCode = "Enter a valid 11-character IFSC (e.g. HDFC0000240).";
  }

  if (!bankInfo.accountType) {
    errors.accountType = "Account type is required.";
  }

  return errors;
}

export function validateKycFileUpload(
  docType: DocumentType,
  fileName: string,
  fileSizeBytes: number
): string | null {
  const template = KYC_DOC_TEMPLATES.find((t) => t.docType === docType);
  if (!template) return "Unsupported document type.";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!template.allowedExtensions.includes(ext)) {
    return `Invalid file type. Allowed: ${template.allowedExtensions
      .map((e) => `.${e}`)
      .join(", ")}`;
  }
  if (fileSizeBytes > MAX_KYC_FILE_BYTES) {
    return "File size must not exceed 5 MB.";
  }
  return null;
}

export function validateStep4Documents(
  documents: RequestDocument[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const tpl of KYC_DOC_TEMPLATES) {
    const doc = documents.find((d) => d.docType === tpl.docType);
    const docNumber = doc?.docNumber.trim() ?? "";
    const fileName = doc?.fileName.trim() ?? "";

    if (tpl.required) {
      if (!docNumber) {
        errors[`${tpl.docType}_number`] = `${tpl.numberLabel} is required.`;
      }
      if (!fileName) {
        errors[`${tpl.docType}_file`] = `${tpl.label} file is required.`;
      }
    } else if (fileName && !docNumber) {
      errors[`${tpl.docType}_number`] =
        `${tpl.numberLabel} is required when a file is attached.`;
    }
  }
  return errors;
}

export function validateDraftMinimal(
  businessInfo: OnboardingRequest["businessInfo"]
): Record<string, string> {
  const errors: Record<string, string> = {};
  const legalName = businessInfo.legalBusinessName.trim();
  if (!legalName) {
    errors.legalBusinessName = "Legal business name is required to save draft.";
  } else if (legalName.length < 3 || legalName.length > 100) {
    errors.legalBusinessName =
      "Legal business name must be between 3 and 100 characters.";
  }
  if (!businessInfo.businessType.trim()) {
    errors.businessType = "Business type is required to save draft.";
  }
  return errors;
}

export function validateAllWizardSteps(
  data: WizardFormData,
  allRequests: OnboardingRequest[],
  excludeRequestId?: string,
  allowApprovedForVendorUserId?: string
): {
  stepErrors: {
    1: Record<string, string>;
    2: Record<string, string>;
    3: Record<string, string>;
    4: Record<string, string>;
  };
  firstInvalidStep: 1 | 2 | 3 | 4 | null;
} {
  const s1 = validateStep1Business(
    data.businessInfo,
    allRequests,
    excludeRequestId,
    allowApprovedForVendorUserId
  );
  const s2 = validateStep2Contact(data.contactInfo);
  const s3 = validateStep3Bank(data.bankInfo);
  const s4 = validateStep4Documents(data.documents);

  let firstInvalidStep: 1 | 2 | 3 | 4 | null = null;
  if (Object.keys(s1).length > 0) firstInvalidStep = 1;
  else if (Object.keys(s2).length > 0) firstInvalidStep = 2;
  else if (Object.keys(s3).length > 0) firstInvalidStep = 3;
  else if (Object.keys(s4).length > 0) firstInvalidStep = 4;

  return {
    stepErrors: { 1: s1, 2: s2, 3: s3, 4: s4 },
    firstInvalidStep,
  };
}

export function getAccessibleRequestsForReviewer(
  user: User,
  requests: OnboardingRequest[]
): OnboardingRequest[] {
  if (user.role === "AM") {
    return requests.filter(
      (req) =>
        req.assignedAmId === user.id ||
        (req.assignedAmId === null &&
          user.mappedBusinessTypes.includes(req.businessInfo.businessType) &&
          req.status === "PENDING_AM_REVIEW")
    );
  }
  if (user.role === "SM") {
    return requests.filter(
      (req) =>
        req.assignedSmId === user.id ||
        (req.assignedSmId === null &&
          user.mappedBusinessTypes.includes(req.businessInfo.businessType) &&
          req.status === "PENDING_SM_APPROVAL")
    );
  }
  return [];
}

export interface VendorOnboardingLockState {
  approvedRequest: OnboardingRequest | null;
  activeRequest: OnboardingRequest | null;
  activeModificationRequest: OnboardingRequest | null;
  isOnboarded: boolean;
  modificationEnabledByAdmin: boolean;
  canCreateNewOnboarding: boolean;
}

export function getVendorOnboardingLockState(
  vendorUserId: string,
  requests: OnboardingRequest[],
  vendorUser?: Pick<User, "allowModificationOnboarding"> | null
): VendorOnboardingLockState {
  const vendorReqs = requests.filter((r) => r.vendorUserId === vendorUserId);
  const approvedRequest =
    vendorReqs.find((r) => r.status === "APPROVED") ?? null;
  const activeRequest =
    vendorReqs.find(
      (r) =>
        r.status !== "REJECTED" &&
        r.status !== "APPROVED" &&
        r.status !== "SUPERSEDED"
    ) ?? null;
  const activeModificationRequest =
    vendorReqs.find(
      (r) =>
        Boolean(r.isModificationRequest) &&
        r.status !== "REJECTED" &&
        r.status !== "APPROVED" &&
        r.status !== "SUPERSEDED"
    ) ?? null;
  const isOnboarded = approvedRequest !== null;
  const modificationEnabledByAdmin =
    isOnboarded && Boolean(vendorUser?.allowModificationOnboarding);

  return {
    approvedRequest,
    activeRequest,
    activeModificationRequest,
    isOnboarded,
    modificationEnabledByAdmin,
    canCreateNewOnboarding: isOnboarded
      ? modificationEnabledByAdmin && activeModificationRequest === null
      : activeRequest === null,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
