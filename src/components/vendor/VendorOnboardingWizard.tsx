import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BUSINESS_CATEGORIES,
  INDIAN_STATES_AND_UTS,
  KYC_DOC_TEMPLATES,
  KycDocTemplate,
} from "../../constants/india";
import { storageService } from "../../services/storageService";
import {
  BusinessType,
  DocumentType,
  OnboardingRequest,
  RequestDocument,
  User,
} from "../../types/models";
import {
  buildEmptyDocuments,
  formatFileSize,
  getVendorOnboardingLockState,
  validateAllWizardSteps,
  validateKycFileUpload,
  validateStep1Business,
  validateStep2Contact,
  validateStep3Bank,
  validateStep4Documents,
} from "../../utils/requestValidators";
import {
  downloadKycDocument,
} from "../common/DocumentPreviewModal";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import {
  clearDocumentBlob,
  openDocumentInNewTab,
  preloadAllBlobs,
  readFileAsDataUrl,
  registerDocumentBlob,
} from "../../utils/fileBlobStore";

interface VendorOnboardingWizardProps {
  currentUser: User;
  existingRequest: OnboardingRequest | null;
  forceReadOnly?: boolean;
  allRequests: OnboardingRequest[];
  businessTypes: BusinessType[];
  onBack: () => void;
  onSavedDraft: (req: OnboardingRequest) => void;
  onSubmitted: (req: OnboardingRequest) => void;
  onShowToast: (message: string, type?: "success" | "error") => void;
}

const STEPS = [
  { id: 1 as const, label: "1. Business & Tax Identity" },
  { id: 2 as const, label: "2. Contact & Address" },
  { id: 3 as const, label: "3. Bank Account Details" },
  { id: 4 as const, label: "4. KYC Document Uploads" },
];

export function VendorOnboardingWizard({
  currentUser,
  existingRequest,
  forceReadOnly = false,
  allRequests,
  businessTypes,
  onBack,
  onSavedDraft,
  onSubmitted,
  onShowToast,
}: VendorOnboardingWizardProps) {
  const lockState = useMemo(
    () => getVendorOnboardingLockState(currentUser.id, allRequests, currentUser),
    [currentUser, allRequests]
  );

  const isModificationMode =
    Boolean(existingRequest?.isModificationRequest) ||
    (existingRequest === null &&
      lockState.isOnboarded &&
      lockState.modificationEnabledByAdmin);

  const seedFromApproved =
    existingRequest === null && isModificationMode
      ? lockState.approvedRequest
      : null;

  const blockedBySingleOnboarding =
    existingRequest === null
      ? !lockState.canCreateNewOnboarding
      : lockState.isOnboarded &&
        !existingRequest.isModificationRequest &&
        !lockState.modificationEnabledByAdmin;

  const isReadOnly =
    forceReadOnly ||
    blockedBySingleOnboarding ||
    (existingRequest !== null &&
      existingRequest.status !== "DRAFT" &&
      existingRequest.status !== "CHANGES_REQUESTED");

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDraftOverrideModal, setShowDraftOverrideModal] = useState(false);

  useEffect(() => {
    preloadAllBlobs();
  }, []);

  const existingVendorDraft = useMemo(() => {
    return allRequests.find(
      (r) => r.vendorUserId === currentUser.id && r.status === "DRAFT"
    );
  }, [allRequests, currentUser.id]);

  const [businessInfo, setBusinessInfo] = useState<
    OnboardingRequest["businessInfo"]
  >(() =>
    existingRequest
      ? { ...existingRequest.businessInfo }
      : seedFromApproved
      ? { ...seedFromApproved.businessInfo }
      : {
          legalBusinessName: "",
          tradeName: "",
          businessType: "",
          businessCategory: "",
          yearEstablished: "",
          gstin: "",
          pan: "",
          msmeNumber: "",
        }
  );

  const [contactInfo, setContactInfo] = useState<
    OnboardingRequest["contactInfo"]
  >(() =>
    existingRequest
      ? { ...existingRequest.contactInfo }
      : seedFromApproved
      ? { ...seedFromApproved.contactInfo }
      : {
          primaryContactName: currentUser.name,
          designation: "",
          email: currentUser.email,
          phone: currentUser.phone,
          registeredAddress: "",
          city: "",
          state: "",
          pincode: "",
        }
  );

  const [bankInfo, setBankInfo] = useState<OnboardingRequest["bankInfo"]>(() =>
    existingRequest
      ? { ...existingRequest.bankInfo }
      : seedFromApproved
      ? { ...seedFromApproved.bankInfo }
      : {
          accountHolderName: "",
          bankName: "",
          accountNumber: "",
          ifscCode: "",
          accountType: "Current",
        }
  );

  const [documents, setDocuments] = useState<RequestDocument[]>(() =>
    buildEmptyDocuments(
      existingRequest?.documents ?? seedFromApproved?.documents ?? []
    )
  );

  // Modal state for Step 4 Document Upload (matching Images 1 & 3)
  const [uploadModalTpl, setUploadModalTpl] =
    useState<KycDocTemplate | null>(null);
  const [modalFile, setModalFile] = useState<{
    name: string;
    size: number;
    type: string;
    rawFile?: File;
    dataUrl?: string;
  } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const openUploadModal = (tpl: KycDocTemplate) => {
    const doc = documents.find((d) => d.docType === tpl.docType);
    setUploadModalTpl(tpl);
    setModalError(null);
    if (doc && doc.fileName) {
      setModalFile({
        name: doc.fileName,
        size: 1024 * 350,
        type: doc.fileType || "application/pdf",
        dataUrl: doc.fileData,
      });
    } else {
      setModalFile(null);
    }
  };

  const closeUploadModal = () => {
    setUploadModalTpl(null);
    setModalFile(null);
    setModalError(null);
  };

  const handleClearModalFile = () => {
    if (!uploadModalTpl) return;
    setModalFile(null);
    setModalError(null);
    clearDocumentBlob(uploadModalTpl.docType);
  };

  const handleModalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadModalTpl) return;
    const err = validateKycFileUpload(uploadModalTpl.docType, file.name, file.size);
    if (err) {
      setModalError(err);
      e.target.value = "";
      return;
    }
    setModalError(null);
    registerDocumentBlob(uploadModalTpl.docType, file);
    registerDocumentBlob(file.name, file);
    registerDocumentBlob(`${uploadModalTpl.docType}_${file.name}`, file);

    readFileAsDataUrl(file)
      .then((dataUrl) => {
        setModalFile({
          name: file.name,
          size: file.size,
          type: file.type || "application/pdf",
          rawFile: file,
          dataUrl,
        });
      })
      .catch(() => {
        setModalFile({
          name: file.name,
          size: file.size,
          type: file.type || "application/pdf",
          rawFile: file,
        });
      });
  };

  const handleModalSubmit = () => {
    if (!uploadModalTpl || !modalFile) return;

    const autoDocNumber =
      uploadModalTpl.docType === "PAN_CARD" && businessInfo.pan
        ? businessInfo.pan.toUpperCase()
        : uploadModalTpl.docType === "GST_CERT" && businessInfo.gstin
        ? businessInfo.gstin.toUpperCase()
        : uploadModalTpl.docType === "MSME_CERT" && businessInfo.msmeNumber
        ? businessInfo.msmeNumber.toUpperCase()
        : uploadModalTpl.docType === "CANCELLED_CHEQUE"
        ? `CHQ-${(bankInfo.accountNumber || "884210").slice(-6)}`
        : uploadModalTpl.docType === "INCORP_CERT"
        ? (businessInfo.legalBusinessName || "INCORP")
        : "DOC-REF";

    const current = documents.find((d) => d.docType === uploadModalTpl.docType);
    updateDocField(uploadModalTpl.docType, {
      docNumber:
        current && current.docNumber.trim()
          ? current.docNumber
          : autoDocNumber,
      fileName: modalFile.name,
      fileType: modalFile.type,
      fileSize: formatFileSize(modalFile.size),
      uploadedAt: new Date().toISOString(),
      fileData: modalFile.dataUrl,
    });
    if (modalFile.rawFile) {
      registerDocumentBlob(uploadModalTpl.docType, modalFile.rawFile);
      registerDocumentBlob(modalFile.name, modalFile.rawFile);
      registerDocumentBlob(`${uploadModalTpl.docType}_${modalFile.name}`, modalFile.rawFile);
    }
    clearError(`${uploadModalTpl.docType}_file`);
    clearError(`${uploadModalTpl.docType}_number`);
    closeUploadModal();
  };

  const activeBusinessTypes = useMemo(() => {
    const active = businessTypes.filter((b) => b.isActive);
    if (
      businessInfo.businessType &&
      !active.some((b) => b.name === businessInfo.businessType)
    ) {
      return [
        ...active,
        {
          id: "legacy",
          name: businessInfo.businessType,
          code: "LEGACY",
          description: "",
          isActive: true,
          createdAt: "",
        },
      ];
    }
    return active;
  }, [businessTypes, businessInfo.businessType]);

  const categoryOptions = useMemo(() => {
    const base = [...BUSINESS_CATEGORIES] as string[];
    if (
      businessInfo.businessCategory &&
      !base.includes(businessInfo.businessCategory)
    ) {
      base.push(businessInfo.businessCategory);
    }
    return base;
  }, [businessInfo.businessCategory]);

  const latestRevertRemark = useMemo(() => {
    if (!existingRequest || existingRequest.status !== "CHANGES_REQUESTED") {
      return null;
    }
    const reverts = existingRequest.remarkHistory.filter(
      (r) => r.action === "CHANGES_REQUESTED"
    );
    return reverts.length > 0 ? reverts[reverts.length - 1] : null;
  }, [existingRequest]);

  const clearError = (key: string) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validateCurrentStep = (step: 1 | 2 | 3 | 4): boolean => {
    let stepErrs: Record<string, string> = {};
    if (step === 1) {
      const cleanBusiness = {
        ...businessInfo,
        legalBusinessName: businessInfo.legalBusinessName.trim(),
        tradeName: businessInfo.tradeName.trim(),
        yearEstablished: businessInfo.yearEstablished.trim(),
        gstin: businessInfo.gstin.trim().toUpperCase(),
        pan: businessInfo.pan.trim().toUpperCase(),
        msmeNumber: businessInfo.msmeNumber.trim().toUpperCase(),
      };
      stepErrs = validateStep1Business(
        cleanBusiness,
        allRequests,
        existingRequest?.id,
        isModificationMode ? currentUser.id : undefined
      );
    } else if (step === 2) {
      const cleanContact = {
        ...contactInfo,
        primaryContactName: contactInfo.primaryContactName.trim(),
        designation: contactInfo.designation.trim(),
        email: contactInfo.email.trim(),
        phone: contactInfo.phone.trim(),
        registeredAddress: contactInfo.registeredAddress.trim(),
        city: contactInfo.city.trim(),
        state: contactInfo.state.trim(),
        pincode: contactInfo.pincode.trim(),
      };
      stepErrs = validateStep2Contact(cleanContact);
    } else if (step === 3) {
      const cleanBank = {
        ...bankInfo,
        accountHolderName: bankInfo.accountHolderName.trim(),
        bankName: bankInfo.bankName.trim(),
        accountNumber: bankInfo.accountNumber.trim(),
        ifscCode: bankInfo.ifscCode.trim().toUpperCase(),
      };
      stepErrs = validateStep3Bank(cleanBank);
    } else {
      stepErrs = validateStep4Documents(documents);
    }
    setErrors(stepErrs);
    return Object.keys(stepErrs).length === 0;
  };

  const handleNextStep = () => {
    if (isReadOnly) {
      setActiveStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
      return;
    }
    if (!validateCurrentStep(activeStep)) return;

    // Auto-sync document reference numbers from earlier steps
    setDocuments((prev) =>
      prev.map((doc) => {
        let docNumber = doc.docNumber;
        if (!docNumber) {
          if (doc.docType === "PAN_CARD") docNumber = businessInfo.pan.trim().toUpperCase();
          else if (doc.docType === "GST_CERT") docNumber = businessInfo.gstin.trim().toUpperCase();
          else if (doc.docType === "CANCELLED_CHEQUE")
            docNumber = bankInfo.accountNumber.trim();
          else if (doc.docType === "INCORP_CERT")
            docNumber = businessInfo.legalBusinessName.trim();
          else if (doc.docType === "MSME_CERT")
            docNumber = businessInfo.msmeNumber.trim().toUpperCase();
        }
        return { ...doc, docNumber };
      })
    );

    setActiveStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
  };

  const performSaveDraft = (targetDraftId?: string) => {
    const syncedDocuments = documents.map((doc) => {
      let docNumber = doc.docNumber;
      if (!docNumber) {
        if (doc.docType === "PAN_CARD") docNumber = businessInfo.pan.trim().toUpperCase();
        else if (doc.docType === "GST_CERT") docNumber = businessInfo.gstin.trim().toUpperCase();
        else if (doc.docType === "CANCELLED_CHEQUE")
          docNumber = bankInfo.accountNumber.trim();
        else if (doc.docType === "INCORP_CERT")
          docNumber = businessInfo.legalBusinessName.trim();
        else if (doc.docType === "MSME_CERT")
          docNumber = businessInfo.msmeNumber.trim().toUpperCase();
      }
      return { ...doc, docNumber };
    });

    try {
      const saved = storageService.saveDraftRequest(
        { businessInfo, contactInfo, bankInfo, documents: syncedDocuments },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        targetDraftId || existingRequest?.id
      );
      setShowDraftOverrideModal(false);
      onSavedDraft(saved);
      onShowToast(`Request ${saved.id} saved as draft successfully.`, "success");
    } catch (err) {
      console.error(err);
      onShowToast("Failed to save draft request.", "error");
    }
  };

  const handleExplicitSaveDraft = () => {
    if (isReadOnly) return;

    // If an existing draft exists and vendor is creating a new request (not editing the existing draft),
    // confirm before overriding previous draft data.
    const isEditingCurrentDraft =
      existingRequest &&
      existingVendorDraft &&
      existingRequest.id === existingVendorDraft.id;

    if (existingVendorDraft && !isEditingCurrentDraft) {
      setShowDraftOverrideModal(true);
      return;
    }

    performSaveDraft(existingRequest?.id);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const syncedDocuments = documents.map((doc) => {
      let docNumber = doc.docNumber;
      if (!docNumber) {
        if (doc.docType === "PAN_CARD") docNumber = businessInfo.pan;
        else if (doc.docType === "GST_CERT") docNumber = businessInfo.gstin;
        else if (doc.docType === "CANCELLED_CHEQUE")
          docNumber = bankInfo.accountNumber;
        else if (doc.docType === "INCORP_CERT")
          docNumber = businessInfo.legalBusinessName;
        else if (doc.docType === "MSME_CERT")
          docNumber = businessInfo.msmeNumber;
      }
      return { ...doc, docNumber };
    });

    const { stepErrors, firstInvalidStep } = validateAllWizardSteps(
      { businessInfo, contactInfo, bankInfo, documents: syncedDocuments },
      allRequests,
      existingRequest?.id,
      isModificationMode ? currentUser.id : undefined
    );

    if (firstInvalidStep !== null) {
      setActiveStep(firstInvalidStep);
      setErrors(stepErrors[firstInvalidStep]);
      // Suppress duplicate toast: inline errors are already shown on fields!
      return;
    }

    try {
      const submitted = storageService.submitVendorRequest(
        { businessInfo, contactInfo, bankInfo, documents: syncedDocuments },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        existingRequest?.id
      );
      onSubmitted(submitted);
      onShowToast("Onboarding request submitted successfully for review!", "success");
    } catch (err) {
      onShowToast(
        err instanceof Error
          ? err.message
          : "Failed to submit onboarding request.",
        "error"
      );
    }
  };

  const updateDocField = (
    docType: DocumentType,
    patch: Partial<RequestDocument>
  ) => {
    setDocuments((prev) =>
      prev.map((d) => (d.docType === docType ? { ...d, ...patch } : d))
    );
  };

  const handleDownloadDoc = (doc: RequestDocument) => {
    downloadKycDocument(doc, businessInfo.legalBusinessName, {
      gstin: businessInfo.gstin,
      pan: businessInfo.pan,
      bankName: bankInfo.bankName,
      ifscCode: bankInfo.ifscCode,
    });
    onShowToast(`Downloaded ${doc.fileName}`);
  };

  const inputBaseClass = (hasError: boolean) =>
    `w-full px-3.5 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed ${
      hasError
        ? "border-red-500 text-slate-900 focus:border-red-500"
        : "border-slate-300 text-slate-900 focus:border-blue-600"
    }`;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Requests</span>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {existingRequest
                ? `${existingRequest.id} — ${
                    existingRequest.businessInfo.legalBusinessName ||
                    "Onboarding Application"
                  }`
                : isModificationMode
                ? "New Modification Onboarding Request"
                : "New Onboarding Request"}
            </h1>
            {!isReadOnly && (
              <p className="text-xs text-slate-500 mt-0.5">
                {isModificationMode
                  ? `Pre-filled from approved dossier ${seedFromApproved?.id ?? existingRequest?.replacesRequestId ?? ""}. Update the required fields/documents and submit for review.`
                  : "Complete all 4 steps and attach Indian KYC records to submit for Account Manager review."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Single-onboarding policy banner when blocked from creating/editing */}
      {!forceReadOnly && blockedBySingleOnboarding && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold">
              {lockState.isOnboarded
                ? `Vendor Already Onboarded (${lockState.approvedRequest?.id})`
                : `Active Onboarding Request Exists (${lockState.activeRequest?.id})`}
            </p>
            <p>
              {lockState.isOnboarded
                ? "A vendor can only be onboarded once. Only a System Admin can enable a new onboarding request if modifications are required."
                : "You already have an active onboarding application in progress. Resume your existing request or wait for review."}
            </p>
          </div>
        </div>
      )}

      {/* Revert Alert Banner when CHANGES_REQUESTED */}
      {existingRequest?.status === "CHANGES_REQUESTED" && latestRevertRemark && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 min-w-0 max-w-full"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0 flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-amber-900">
              Changes Requested by {latestRevertRemark.actorName} (Account Manager)
            </p>
            <p className="text-sm text-amber-800 break-all break-words [overflow-wrap:anywhere]">
              {latestRevertRemark.message}
            </p>
            <p className="text-xs text-amber-700">
              Update the relevant sections or KYC documents below, then click{" "}
              <span className="font-semibold">Submit Request</span> to send back for review.
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Wizard Navigation Bar (non-clickable indicator) */}
      <nav
        aria-label="Onboarding Wizard Steps"
        className="bg-white border border-slate-200 rounded-xl p-2 grid grid-cols-2 lg:grid-cols-4 gap-2"
      >
        {STEPS.map((step) => {
          const active = activeStep === step.id;
          const isDone = step.id < activeStep;
          return (
            <div
              key={step.id}
              className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors whitespace-nowrap truncate select-none ${
                active
                  ? "bg-blue-600 text-white shadow-xs"
                  : isDone
                  ? "bg-blue-50 text-blue-700 border border-blue-200/50"
                  : "bg-slate-50 text-slate-400"
              }`}
            >
              {step.label}
            </div>
          );
        })}
      </nav>

      <form
        onSubmit={handleSubmitRequest}
        noValidate
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
          {/* STEP 1: Business & Tax Identity */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Step 1 — Business &amp; Tax Identity
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter registered entity details exactly as they appear on GST and PAN certificates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="wiz-legal-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Legal Business Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-legal-name"
                    type="text"
                    disabled={isReadOnly}
                    value={businessInfo.legalBusinessName}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        legalBusinessName: e.target.value,
                      });
                      clearError("legalBusinessName");
                    }}
                    onBlur={() => {
                      setBusinessInfo((prev) => ({
                        ...prev,
                        legalBusinessName: prev.legalBusinessName.trim(),
                      }));
                    }}
                    placeholder="e.g. Apex Supply Chain Pvt Ltd"
                    className={inputBaseClass(Boolean(errors.legalBusinessName))}
                  />
                  {errors.legalBusinessName && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.legalBusinessName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-trade-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Trade Name
                  </label>
                  <input
                    id="wiz-trade-name"
                    type="text"
                    disabled={isReadOnly}
                    value={businessInfo.tradeName}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        tradeName: e.target.value,
                      });
                      clearError("tradeName");
                    }}
                    onBlur={() => {
                      setBusinessInfo((prev) => ({
                        ...prev,
                        tradeName: prev.tradeName.trim(),
                      }));
                    }}
                    placeholder="Optional brand or DBA name"
                    className={inputBaseClass(Boolean(errors.tradeName))}
                  />
                  {errors.tradeName && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.tradeName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-business-type"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Business Type <span className="text-red-600">*</span>
                  </label>
                  <DropSearch
                    id="wiz-business-type"
                    disabled={isReadOnly}
                    value={businessInfo.businessType}
                    onChange={(val) => {
                      setBusinessInfo({
                        ...businessInfo,
                        businessType: val,
                      });
                      clearError("businessType");
                    }}
                    options={activeBusinessTypes.map((bt) => ({
                      value: bt.name,
                      label: bt.name,
                      sublabel: bt.description,
                    }))}
                    placeholder="Select Business Type"
                    searchPlaceholder="Search business type..."
                    hasError={Boolean(errors.businessType)}
                  />
                  {errors.businessType && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.businessType}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-business-category"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Business Category <span className="text-red-600">*</span>
                  </label>
                  <DropSearch
                    id="wiz-business-category"
                    disabled={isReadOnly}
                    value={businessInfo.businessCategory}
                    onChange={(val) => {
                      setBusinessInfo({
                        ...businessInfo,
                        businessCategory: val,
                      });
                      clearError("businessCategory");
                    }}
                    options={categoryOptions}
                    placeholder="Select Business Category"
                    searchPlaceholder="Search category..."
                    hasError={Boolean(errors.businessCategory)}
                  />
                  {errors.businessCategory && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.businessCategory}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-year"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Year Established
                  </label>
                  <input
                    id="wiz-year"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    disabled={isReadOnly}
                    value={businessInfo.yearEstablished}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        yearEstablished: e.target.value.replace(/\D/g, ""),
                      });
                      clearError("yearEstablished");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 4);
                      setBusinessInfo((prev) => ({
                        ...prev,
                        yearEstablished: pasteText,
                      }));
                      clearError("yearEstablished");
                    }}
                    onBlur={() => {
                      setBusinessInfo((prev) => ({
                        ...prev,
                        yearEstablished: prev.yearEstablished.trim(),
                      }));
                    }}
                    placeholder="e.g. 2018"
                    className={`${inputBaseClass(
                      Boolean(errors.yearEstablished)
                    )} font-mono`}
                  />
                  {errors.yearEstablished && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.yearEstablished}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-gstin"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    GSTIN <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-gstin"
                    type="text"
                    maxLength={15}
                    disabled={isReadOnly}
                    value={businessInfo.gstin}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        gstin: e.target.value.replace(/\s+/g, "").toUpperCase(),
                      });
                      clearError("gstin");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\s+/g, "")
                        .toUpperCase()
                        .slice(0, 15);
                      setBusinessInfo((prev) => ({
                        ...prev,
                        gstin: pasteText,
                      }));
                      clearError("gstin");
                    }}
                    onBlur={() => {
                      setBusinessInfo((prev) => ({
                        ...prev,
                        gstin: prev.gstin.trim().toUpperCase(),
                      }));
                    }}
                    placeholder="27AABCA1234D1Z5"
                    className={`${inputBaseClass(
                      Boolean(errors.gstin)
                    )} font-mono uppercase`}
                  />
                  {errors.gstin && (
                    <p className="text-xs text-red-600 mt-1">{errors.gstin}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-pan"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    PAN <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-pan"
                    type="text"
                    maxLength={10}
                    disabled={isReadOnly}
                    value={businessInfo.pan}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        pan: e.target.value.replace(/\s+/g, "").toUpperCase(),
                      });
                      clearError("pan");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\s+/g, "")
                        .toUpperCase()
                        .slice(0, 10);
                      setBusinessInfo((prev) => ({
                        ...prev,
                        pan: pasteText,
                      }));
                      clearError("pan");
                    }}
                    onBlur={() => {
                      setBusinessInfo((prev) => ({
                        ...prev,
                        pan: prev.pan.trim().toUpperCase(),
                      }));
                    }}
                    placeholder="AABCA1234D"
                    className={`${inputBaseClass(
                      Boolean(errors.pan)
                    )} font-mono uppercase`}
                  />
                  {errors.pan && (
                    <p className="text-xs text-red-600 mt-1">{errors.pan}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-msme"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    MSME / Udyam Number
                  </label>
                  <input
                    id="wiz-msme"
                    type="text"
                    disabled={isReadOnly}
                    value={businessInfo.msmeNumber}
                    onChange={(e) => {
                      setBusinessInfo({
                        ...businessInfo,
                        msmeNumber: e.target.value.replace(/\s+/g, "").toUpperCase(),
                      });
                      clearError("msmeNumber");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\s+/g, "")
                        .toUpperCase();
                      setBusinessInfo((prev) => ({
                        ...prev,
                        msmeNumber: pasteText,
                      }));
                      clearError("msmeNumber");
                    }}
                    onBlur={() => {
                      setBusinessInfo((prev) => ({
                        ...prev,
                        msmeNumber: prev.msmeNumber.trim().toUpperCase(),
                      }));
                    }}
                    placeholder="UDYAM-MH-19-0045210"
                    className={`${inputBaseClass(
                      Boolean(errors.msmeNumber)
                    )} font-mono uppercase`}
                  />
                  {errors.msmeNumber && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.msmeNumber}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Contact & Registered Address */}
          {activeStep === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Step 2 — Contact &amp; Registered Address
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorized signatory and official communication address in India.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="wiz-contact-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Primary Contact Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-contact-name"
                    type="text"
                    disabled={isReadOnly}
                    value={contactInfo.primaryContactName}
                    onChange={(e) => {
                      setContactInfo({
                        ...contactInfo,
                        primaryContactName: e.target.value,
                      });
                      clearError("primaryContactName");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        primaryContactName: prev.primaryContactName.trim(),
                      }));
                    }}
                    className={inputBaseClass(
                      Boolean(errors.primaryContactName)
                    )}
                  />
                  {errors.primaryContactName && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.primaryContactName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-designation"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Designation <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-designation"
                    type="text"
                    disabled={isReadOnly}
                    value={contactInfo.designation}
                    onChange={(e) => {
                      setContactInfo({
                        ...contactInfo,
                        designation: e.target.value,
                      });
                      clearError("designation");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        designation: prev.designation.trim(),
                      }));
                    }}
                    placeholder="e.g. Director - Operations"
                    className={inputBaseClass(Boolean(errors.designation))}
                  />
                  {errors.designation && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.designation}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Official Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-email"
                    type="email"
                    disabled={isReadOnly}
                    value={contactInfo.email}
                    onChange={(e) => {
                      setContactInfo({
                        ...contactInfo,
                        email: e.target.value.replace(/\s+/g, ""),
                      });
                      clearError("email");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData.getData("text").trim();
                      setContactInfo((prev) => ({
                        ...prev,
                        email: pasteText,
                      }));
                      clearError("email");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        email: prev.email.trim(),
                      }));
                    }}
                    className={inputBaseClass(Boolean(errors.email))}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-phone"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Mobile Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={15}
                    disabled={isReadOnly}
                    value={contactInfo.phone}
                    onChange={(e) => {
                      setContactInfo({
                        ...contactInfo,
                        phone: e.target.value.replace(/\D/g, ""),
                      });
                      clearError("phone");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 15);
                      setContactInfo((prev) => ({
                        ...prev,
                        phone: pasteText,
                      }));
                      clearError("phone");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        phone: prev.phone.trim(),
                      }));
                    }}
                    className={`${inputBaseClass(Boolean(errors.phone))} font-mono`}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="wiz-address"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Registered Address <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs text-slate-400 font-mono">
                      {contactInfo.registeredAddress.length}/250
                    </span>
                  </div>
                  <textarea
                    id="wiz-address"
                    rows={3}
                    maxLength={250}
                    disabled={isReadOnly}
                    value={contactInfo.registeredAddress}
                    onChange={(e) => {
                      setContactInfo({
                        ...contactInfo,
                        registeredAddress: e.target.value,
                      });
                      clearError("registeredAddress");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        registeredAddress: prev.registeredAddress.trim(),
                      }));
                    }}
                    placeholder="Street, Building, Industrial Area (max 250 characters)"
                    className={`${inputBaseClass(
                      Boolean(errors.registeredAddress)
                    )} h-20 resize-none overflow-y-auto`}
                  />
                  {errors.registeredAddress && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.registeredAddress}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-city"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    City <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-city"
                    type="text"
                    disabled={isReadOnly}
                    value={contactInfo.city}
                    onChange={(e) => {
                      setContactInfo({ ...contactInfo, city: e.target.value });
                      clearError("city");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        city: prev.city.trim(),
                      }));
                    }}
                    className={inputBaseClass(Boolean(errors.city))}
                  />
                  {errors.city && (
                    <p className="text-xs text-red-600 mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    State / UT <span className="text-red-600">*</span>
                  </label>
                  <DropSearch
                    options={[...INDIAN_STATES_AND_UTS]}
                    value={contactInfo.state}
                    onChange={(val) => {
                      setContactInfo({ ...contactInfo, state: val });
                      clearError("state");
                    }}
                    placeholder="Select State / UT"
                    disabled={isReadOnly}
                    hasError={Boolean(errors.state)}
                  />
                  {errors.state && (
                    <p className="text-xs text-red-600 mt-1">{errors.state}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-pincode"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Pincode <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-pincode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={isReadOnly}
                    value={contactInfo.pincode}
                    onChange={(e) => {
                      setContactInfo({
                        ...contactInfo,
                        pincode: e.target.value.replace(/\D/g, ""),
                      });
                      clearError("pincode");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setContactInfo((prev) => ({
                        ...prev,
                        pincode: pasteText,
                      }));
                      clearError("pincode");
                    }}
                    onBlur={() => {
                      setContactInfo((prev) => ({
                        ...prev,
                        pincode: prev.pincode.trim(),
                      }));
                    }}
                    placeholder="400093"
                    className={`${inputBaseClass(
                      Boolean(errors.pincode)
                    )} font-mono`}
                  />
                  {errors.pincode && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.pincode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Bank Account Details */}
          {activeStep === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Step 3 — Bank Account Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Corporate settlement account for NEFT / RTGS vendor payouts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="wiz-account-holder"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Account Holder Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-account-holder"
                    type="text"
                    disabled={isReadOnly}
                    value={bankInfo.accountHolderName}
                    onChange={(e) => {
                      setBankInfo({
                        ...bankInfo,
                        accountHolderName: e.target.value,
                      });
                      clearError("accountHolderName");
                    }}
                    onBlur={() => {
                      setBankInfo((prev) => ({
                        ...prev,
                        accountHolderName: prev.accountHolderName.trim(),
                      }));
                    }}
                    className={inputBaseClass(
                      Boolean(errors.accountHolderName)
                    )}
                  />
                  {errors.accountHolderName && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.accountHolderName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-bank-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Bank Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-bank-name"
                    type="text"
                    disabled={isReadOnly}
                    value={bankInfo.bankName}
                    onChange={(e) => {
                      setBankInfo({ ...bankInfo, bankName: e.target.value });
                      clearError("bankName");
                    }}
                    onBlur={() => {
                      setBankInfo((prev) => ({
                        ...prev,
                        bankName: prev.bankName.trim(),
                      }));
                    }}
                    placeholder="e.g. HDFC Bank"
                    className={inputBaseClass(Boolean(errors.bankName))}
                  />
                  {errors.bankName && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.bankName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-account-number"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Account Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-account-number"
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    disabled={isReadOnly}
                    value={bankInfo.accountNumber}
                    onChange={(e) => {
                      setBankInfo({
                        ...bankInfo,
                        accountNumber: e.target.value.replace(/\D/g, ""),
                      });
                      clearError("accountNumber");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 18);
                      setBankInfo((prev) => ({
                        ...prev,
                        accountNumber: pasteText,
                      }));
                      clearError("accountNumber");
                    }}
                    onBlur={() => {
                      setBankInfo((prev) => ({
                        ...prev,
                        accountNumber: prev.accountNumber.trim(),
                      }));
                    }}
                    placeholder="9–18 digits"
                    className={`${inputBaseClass(
                      Boolean(errors.accountNumber)
                    )} font-mono`}
                  />
                  {errors.accountNumber && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.accountNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wiz-ifsc"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    IFSC Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="wiz-ifsc"
                    type="text"
                    maxLength={11}
                    disabled={isReadOnly}
                    value={bankInfo.ifscCode}
                    onChange={(e) => {
                      setBankInfo({
                        ...bankInfo,
                        ifscCode: e.target.value.replace(/\s+/g, "").toUpperCase(),
                      });
                      clearError("ifscCode");
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteText = e.clipboardData
                        .getData("text")
                        .replace(/\s+/g, "")
                        .toUpperCase()
                        .slice(0, 11);
                      setBankInfo((prev) => ({
                        ...prev,
                        ifscCode: pasteText,
                      }));
                      clearError("ifscCode");
                    }}
                    onBlur={() => {
                      setBankInfo((prev) => ({
                        ...prev,
                        ifscCode: prev.ifscCode.trim().toUpperCase(),
                      }));
                    }}
                    placeholder="HDFC0000240"
                    className={`${inputBaseClass(
                      Boolean(errors.ifscCode)
                    )} font-mono uppercase`}
                  />
                  {errors.ifscCode && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.ifscCode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: KYC Mandatory Documents (matching Image 5) */}
          {activeStep === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Mandatory Documents
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attach Indian KYC verification documents. Click &ldquo;Select file&rdquo; to upload supporting documents with validity details.
                </p>
              </div>

              <div className="space-y-3">
                {KYC_DOC_TEMPLATES.map((tpl) => {
                  const doc =
                    documents.find((d) => d.docType === tpl.docType) ??
                    buildEmptyDocuments([])[0];
                  const fileErr = errors[`${tpl.docType}_file`];
                  const hasFile = Boolean(doc.fileName.trim());
                  const isReviewer =
                    currentUser.role === "AM" ||
                    currentUser.role === "SM" ||
                    currentUser.role === "ADMIN";

                  return (
                    <div
                      key={tpl.docType}
                      className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{tpl.label}</span>
                            {tpl.required && (
                              <span className="text-red-600">*</span>
                            )}
                          </p>
                        </div>

                        {isReadOnly ? (
                          /* View Request Mode: Preview & Download available to ALL roles */
                          hasFile ? (
                            <div className="flex flex-col items-end gap-1 shrink-0 self-end sm:self-center">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDocumentInNewTab(
                                      doc,
                                      businessInfo.legalBusinessName
                                    )
                                  }
                                  aria-label={`Preview ${tpl.label}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Preview</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadDoc(doc)}
                                  aria-label={`Download ${tpl.label}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Download</span>
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  openDocumentInNewTab(
                                    doc,
                                    businessInfo.legalBusinessName
                                  )
                                }
                                className="text-xs text-[#0066CC] hover:underline cursor-pointer font-normal text-left sm:text-right break-all break-words [overflow-wrap:anywhere] whitespace-normal max-w-full min-w-0 transition-colors block"
                                title="Click to preview file in a new tab"
                              >
                                <span className="break-all break-words [overflow-wrap:anywhere] whitespace-normal block max-w-full">{doc.fileName}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Not uploaded
                            </span>
                          )
                        ) : (
                          /* Wizard Editing Mode */
                          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0 min-w-0 max-w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              {hasFile && isReviewer && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDocumentInNewTab(
                                        doc,
                                        businessInfo.legalBusinessName
                                      )
                                    }
                                    aria-label={`Preview ${tpl.label}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Preview</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDoc(doc)}
                                    aria-label={`Download ${tpl.label}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Download</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => openUploadModal(tpl)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                              >
                                <Upload className="w-3.5 h-3.5 text-slate-600" />
                                <span>
                                  {hasFile ? "1 file(s) selected" : "Select file"}
                                </span>
                              </button>
                            </div>

                            {/* File name link below button (matching Image 3) - Click to preview for all roles */}
                            {hasFile && (
                              <button
                                type="button"
                                onClick={() =>
                                  openDocumentInNewTab(
                                    doc,
                                    businessInfo.legalBusinessName
                                  )
                                }
                                className="text-xs text-[#0066CC] hover:underline cursor-pointer font-normal text-left sm:text-right break-all break-words [overflow-wrap:anywhere] whitespace-normal max-w-full min-w-0 transition-colors block"
                                title="Click to preview file in a new tab"
                              >
                                <span className="break-all break-words [overflow-wrap:anywhere] whitespace-normal block max-w-full">{doc.fileName}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {fileErr && (
                        <p className="text-xs text-red-600 mt-2 font-medium">
                          {fileErr}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wizard Footer Controls */}
          <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {activeStep > 1 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    setActiveStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))
                  }
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              )}
              {activeStep < 4 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleNextStep}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!isReadOnly && activeStep === 4 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                {existingRequest?.status !== "CHANGES_REQUESTED" && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleExplicitSaveDraft}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-500" />
                    <span>Save as Draft</span>
                  </button>
                )}
                <button
                  type="submit"
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Request</span>
                </button>
              </div>
            )}
          </div>
        </form>

      {/* Upload Document Modal (matching Image 1 & Image 3) */}
      <Modal
        open={Boolean(uploadModalTpl)}
        onClose={closeUploadModal}
        title={uploadModalTpl ? `Upload ${uploadModalTpl.label}` : "Upload Document"}
        subtitle="Maximum file size: 10 MB per file"
        maxWidthClass="max-w-lg"
      >
        {uploadModalTpl && (
          <div className="p-6 space-y-4">
            {/* Document File Selection Card */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700">
                  Select file
                </label>
                {modalFile && (
                  <button
                    type="button"
                    onClick={handleClearModalFile}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                    aria-label="Remove selected file"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>

              <div className="min-w-0 max-w-full overflow-hidden">
                <div className="border border-slate-200 rounded-lg p-1.5 flex items-center gap-3 bg-white min-w-0 max-w-full overflow-hidden">
                  <label className="px-4 py-1.5 rounded-md bg-[#0066CC] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors">
                    Choose File
                    <input
                      type="file"
                      accept={uploadModalTpl.accept}
                      onChange={handleModalFileSelect}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-xs text-slate-500 font-normal break-all break-words [overflow-wrap:anywhere] whitespace-normal min-w-0 flex-1">
                    {modalFile ? modalFile.name : "No file chosen"}
                  </span>
                </div>

                {/* File info badge below input - click to preview for all roles */}
                {modalFile && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetDoc = documents.find(
                        (d) => d.docType === uploadModalTpl.docType
                      ) ?? {
                        docType: uploadModalTpl.docType,
                        label: uploadModalTpl.label,
                        required: uploadModalTpl.required,
                        docNumber: "",
                        fileName: modalFile.name,
                        fileSize: formatFileSize(modalFile.size),
                        fileType: modalFile.type,
                        uploadedAt: new Date().toISOString(),
                      };
                      openDocumentInNewTab(
                        {
                          ...targetDoc,
                          label: uploadModalTpl.label,
                          required: uploadModalTpl.required,
                          fileName: modalFile.name,
                          fileType: modalFile.type,
                          fileData: modalFile.dataUrl,
                        },
                        businessInfo.legalBusinessName
                      );
                    }}
                    className="flex items-start gap-1.5 text-xs text-[#0066CC] hover:underline font-medium mt-2 text-left cursor-pointer transition-colors max-w-full min-w-0"
                    title="Click to preview file in a new tab"
                  >
                    <FileText className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                    <span className="break-all break-words [overflow-wrap:anywhere] whitespace-normal min-w-0 max-w-full block">
                      {modalFile.name} ({formatFileSize(modalFile.size)})
                    </span>
                  </button>
                )}
              </div>
            </div>

            {modalError && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {modalError}
              </p>
            )}

            {/* Modal Actions (properly padded and spaced from popup borders) */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={!modalFile}
                onClick={handleModalSubmit}
                className={`px-5 py-2.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                  modalFile
                    ? "bg-[#0066CC] hover:bg-blue-700 text-white"
                    : "bg-[#A0C4E8] text-white cursor-not-allowed"
                }`}
              >
                Submit
              </button>
              <button
                type="button"
                onClick={closeUploadModal}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Draft Overwrite Confirmation Modal (Requirement 3 & 4) */}
      <Modal
        open={showDraftOverrideModal}
        onClose={() => setShowDraftOverrideModal(false)}
        title="Override Existing Draft?"
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-700 leading-relaxed">
            You already have a saved draft request{" "}
            <span className="font-semibold text-slate-900">
              ({existingVendorDraft?.id})
            </span>
            . If you are okay with this action, then the previous draft data will get overridden with current data. Do you want to proceed?
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDraftOverrideModal(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => performSaveDraft(existingVendorDraft?.id)}
              className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Yes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
