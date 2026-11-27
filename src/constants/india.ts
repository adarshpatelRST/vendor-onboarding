import { DocumentType } from "../types/models";

export const BUSINESS_CATEGORIES = [
  "IT & Software",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Facility Management",
  "Consulting & Services",
  "Packaging & Materials",
] as const;

export const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export interface KycDocTemplate {
  docType: DocumentType;
  label: string;
  numberLabel: string;
  numberPlaceholder: string;
  required: boolean;
  accept: string;
  allowedExtensions: string[];
  formatHint: string;
  sampleFileName: string;
  sampleFileType: string;
  sampleFileSize: string;
}

export const KYC_DOC_TEMPLATES: KycDocTemplate[] = [
  {
    docType: "PAN_CARD",
    label: "Company / Proprietor PAN Card",
    numberLabel: "PAN Number",
    numberPlaceholder: "e.g. AABCA1234D",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png",
    allowedExtensions: ["pdf", "jpg", "jpeg", "png"],
    formatHint: "PDF, JPG, JPEG, or PNG (max 5 MB)",
    sampleFileName: "company_pan_card.pdf",
    sampleFileType: "application/pdf",
    sampleFileSize: "420 KB",
  },
  {
    docType: "GST_CERT",
    label: "GST Registration Certificate",
    numberLabel: "GSTIN",
    numberPlaceholder: "e.g. 27AABCA1234D1Z5",
    required: true,
    accept: ".pdf",
    allowedExtensions: ["pdf"],
    formatHint: "PDF only (max 5 MB)",
    sampleFileName: "gst_registration_cert.pdf",
    sampleFileType: "application/pdf",
    sampleFileSize: "810 KB",
  },
  {
    docType: "CANCELLED_CHEQUE",
    label: "Cancelled Cheque / Bank Proof",
    numberLabel: "Cheque / Account Ref No.",
    numberPlaceholder: "e.g. CHQ-884210",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png",
    allowedExtensions: ["pdf", "jpg", "jpeg", "png"],
    formatHint: "PDF, JPG, JPEG, or PNG (max 5 MB)",
    sampleFileName: "cancelled_cheque_proof.png",
    sampleFileType: "image/png",
    sampleFileSize: "485 KB",
  },
  {
    docType: "INCORP_CERT",
    label: "Certificate of Incorporation / Partnership Deed",
    numberLabel: "CIN / Registration No.",
    numberPlaceholder: "e.g. U63090MH2018PTC310442",
    required: false,
    accept: ".pdf",
    allowedExtensions: ["pdf"],
    formatHint: "PDF only (max 5 MB) · Optional",
    sampleFileName: "certificate_of_incorporation.pdf",
    sampleFileType: "application/pdf",
    sampleFileSize: "1.1 MB",
  },
  {
    docType: "MSME_CERT",
    label: "MSME / Udyam Registration Certificate",
    numberLabel: "Udyam Registration No.",
    numberPlaceholder: "e.g. UDYAM-MH-19-0045210",
    required: false,
    accept: ".pdf",
    allowedExtensions: ["pdf"],
    formatHint: "PDF only (max 5 MB) · Optional",
    sampleFileName: "udyam_msme_certificate.pdf",
    sampleFileType: "application/pdf",
    sampleFileSize: "340 KB",
  },
];
