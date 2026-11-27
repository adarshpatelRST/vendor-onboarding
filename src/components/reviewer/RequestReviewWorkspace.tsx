import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileEdit,
  HelpCircle,
  Info,
  Lock,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { KYC_DOC_TEMPLATES } from "../../constants/india";
import { storageService } from "../../services/storageService";
import {
  OnboardingRequest,
  RequestDocument,
  User,
} from "../../types/models";
import { downloadKycDocument } from "../common/DocumentPreviewModal";
import { Modal } from "../common/Modal";
import {
  openDocumentInNewTab,
  preloadAllBlobs,
} from "../../utils/fileBlobStore";

interface RequestReviewWorkspaceProps {
  currentUser: User;
  request: OnboardingRequest;
  allRequests?: OnboardingRequest[];
  users: User[];
  focusDocuments?: boolean;
  onBack: () => void;
  onTransitionComplete: (message: string) => void;
  onShowToast: (message: string, type?: "success" | "error") => void;
}

export function RequestReviewWorkspace({
  currentUser,
  request,
  allRequests = [],
  users,
  focusDocuments = false,
  onBack,
  onTransitionComplete,
  onShowToast,
}: RequestReviewWorkspaceProps) {
  const [modalType, setModalType] = useState<
    "REJECT" | "QUERY" | "APPROVE" | "ADMIN_MOD" | null
  >(null);
  const [modalRemark, setModalRemark] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const docsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    preloadAllBlobs();
  }, []);

  useEffect(() => {
    if (focusDocuments && docsRef.current) {
      docsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusDocuments]);

  const isAM = currentUser.role === "AM";
  const isSM = currentUser.role === "SM";
  const isAdmin = currentUser.role === "ADMIN";

  const vendorUser = users.find((u) => u.id === request.vendorUserId) ?? null;

  const alreadyApprovedForVendor = allRequests.find(
    (r) =>
      r.id !== request.id &&
      r.vendorUserId === request.vendorUserId &&
      r.status === "APPROVED"
  );

  const isAllowedModification = Boolean(request.isModificationRequest);

  const canAMAct =
    isAM &&
    (request.status === "PENDING_AM_REVIEW" ||
      request.status === "QUERY_TO_AM");
  const canSMAct = isSM && request.status === "PENDING_SM_APPROVAL";

  const handleApproveAction = () => {
    if (isAM) {
      setModalType("APPROVE");
      setModalRemark("");
      setModalError(null);
    } else if (isSM) {
      try {
        const updated = storageService.transitionRequestBySM(
          request.id,
          "APPROVE",
          "",
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        onTransitionComplete(`${updated.id} approved and vendor onboarded.`);
      } catch (err) {
        onShowToast(
          err instanceof Error ? err.message : "Unable to approve request.",
          "error"
        );
      }
    }
  };

  const handleModalSubmit = () => {
    if (
      modalType !== "APPROVE" &&
      modalType !== "ADMIN_MOD" &&
      !modalRemark.trim()
    ) {
      setModalError(
        modalType === "REJECT"
          ? "Please provide an explanation for rejection."
          : "Please specify query details or required clarifications."
      );
      return;
    }

    if (modalType === "ADMIN_MOD" && isAdmin && vendorUser) {
      const nextEnabled = !vendorUser.allowModificationOnboarding;
      try {
        storageService.setVendorModificationAccess(
          vendorUser.id,
          nextEnabled,
          modalRemark.trim(),
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        setModalType(null);
        onTransitionComplete(
          nextEnabled
            ? `Enabled new modification onboarding request for ${vendorUser.name}.`
            : `Revoked modification onboarding access for ${vendorUser.name}.`
        );
      } catch (err) {
        onShowToast(
          err instanceof Error ? err.message : "Failed to update modification access.",
          "error"
        );
      }
      return;
    }

    if (isAM) {
      if (modalType === "APPROVE") {
        const updated = storageService.transitionRequestByAM(
          request.id,
          "APPROVE",
          modalRemark.trim(),
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        setModalType(null);
        onTransitionComplete(`${updated.id} approved and escalated to Senior Manager.`);
      } else if (modalType === "REJECT") {
        const updated = storageService.transitionRequestByAM(
          request.id,
          "REJECT",
          modalRemark.trim(),
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        setModalType(null);
        onTransitionComplete(`${updated.id} has been rejected.`);
      } else if (modalType === "QUERY") {
        const updated = storageService.transitionRequestByAM(
          request.id,
          "QUERY",
          modalRemark.trim(),
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        setModalType(null);
        onTransitionComplete(`Query sent to vendor for ${updated.id}.`);
      }
    } else if (isSM) {
      if (modalType === "REJECT") {
        const updated = storageService.transitionRequestBySM(
          request.id,
          "REJECT",
          modalRemark.trim(),
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        setModalType(null);
        onTransitionComplete(`${updated.id} has been rejected.`);
      } else if (modalType === "QUERY") {
        const updated = storageService.transitionRequestBySM(
          request.id,
          "QUERY",
          modalRemark.trim(),
          { id: currentUser.id, name: currentUser.name, role: currentUser.role }
        );
        setModalType(null);
        onTransitionComplete(`Query sent to Account Manager for ${updated.id}.`);
      }
    }
  };

  const handleDownload = (doc: RequestDocument) => {
    downloadKycDocument(doc, request.businessInfo.legalBusinessName, {
      gstin: request.businessInfo.gstin,
      pan: request.businessInfo.pan,
      bankName: request.bankInfo.bankName,
      ifscCode: request.bankInfo.ifscCode,
    });
    onShowToast(`Downloaded ${doc.fileName}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Strip */}
      <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>
            {currentUser.role === "ADMIN"
              ? "Back to Analytics"
              : "Back to Queue"}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-bold text-slate-900 shrink-0">
            {request.id}
          </span>
          <span className="text-slate-400 font-normal">—</span>
          <h1 className="text-lg font-bold text-slate-900 break-words">
            {request.businessInfo.legalBusinessName}
          </h1>
        </div>
      </div>

      {/* Main Details Section */}
      <div className="space-y-5">
        {/* Business & Tax Identity */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
            Business &amp; Tax Identity
          </h2>
          <dl className="divide-y divide-slate-100 sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 pt-2 sm:pt-4 text-xs">
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Legal Business Name</dt>
              <dd className="font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left break-words">
                {request.businessInfo.legalBusinessName}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Trade Name</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.businessInfo.tradeName || "—"}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Business Type</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.businessInfo.businessType}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Business Category</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.businessInfo.businessCategory}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Year Established</dt>
              <dd className="font-mono text-slate-800 sm:mt-0.5 text-right sm:text-left">
                {request.businessInfo.yearEstablished || "—"}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">GSTIN</dt>
              <dd className="font-mono font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left">
                {request.businessInfo.gstin}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">PAN</dt>
              <dd className="font-mono font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left">
                {request.businessInfo.pan}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">MSME / Udyam Number</dt>
              <dd className="font-mono text-slate-800 sm:mt-0.5 text-right sm:text-left">
                {request.businessInfo.msmeNumber || "Not provided"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Contact & Registered Address */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
            Contact &amp; Registered Address
          </h2>
          <dl className="divide-y divide-slate-100 sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 pt-2 sm:pt-4 text-xs">
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Primary Contact</dt>
              <dd className="font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left break-words">
                {request.contactInfo.primaryContactName}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Designation</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.contactInfo.designation}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Official Email</dt>
              <dd className="font-mono text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.contactInfo.email}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Mobile Number</dt>
              <dd className="font-mono text-slate-800 sm:mt-0.5 text-right sm:text-left">
                {request.contactInfo.phone}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block sm:col-span-2 py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Registered Address</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.contactInfo.registeredAddress},{" "}
                {request.contactInfo.city}, {request.contactInfo.state} —{" "}
                <span className="font-mono">{request.contactInfo.pincode}</span>
              </dd>
            </div>
          </dl>
        </section>

        {/* Bank Account Details */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
            Bank Account Details
          </h2>
          <dl className="divide-y divide-slate-100 sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 pt-2 sm:pt-4 text-xs">
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Account Holder Name</dt>
              <dd className="font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left break-words">
                {request.bankInfo.accountHolderName}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Bank Name</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left break-words">
                {request.bankInfo.bankName}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Account Type</dt>
              <dd className="font-medium text-slate-800 sm:mt-0.5 text-right sm:text-left">
                {request.bankInfo.accountType}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">Account Number</dt>
              <dd className="font-mono font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left">
                {request.bankInfo.accountNumber}
              </dd>
            </div>
            <div className="flex items-start justify-between sm:block py-2 sm:py-0">
              <dt className="text-slate-500 font-medium sm:font-normal shrink-0">IFSC Code</dt>
              <dd className="font-mono font-semibold text-slate-900 sm:mt-0.5 text-right sm:text-left">
                {request.bankInfo.ifscCode}
              </dd>
            </div>
          </dl>
        </section>

        {/* Mandatory Documents (Card list matching Vendor Step 4) */}
        <section
          ref={docsRef}
          aria-label="Mandatory Documents"
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
        >
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Mandatory Documents
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Indian KYC verification documents attached by the vendor.
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums font-mono">
              {request.documents.filter((d) => d.fileName.trim()).length} of {KYC_DOC_TEMPLATES.length} uploaded
            </span>
          </div>

          <div className="space-y-3">
            {KYC_DOC_TEMPLATES.map((tpl) => {
              const doc = request.documents.find((d) => d.docType === tpl.docType);
              const hasFile = Boolean(doc && doc.fileName.trim());

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
                      {doc?.docNumber && (
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          Ref: {doc.docNumber}
                        </p>
                      )}
                    </div>

                    {hasFile && doc ? (
                      <div className="flex flex-col items-start sm:items-end gap-1 shrink-0 min-w-0 max-w-full w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDocumentInNewTab(
                                doc,
                                request.businessInfo.legalBusinessName
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
                            onClick={() => handleDownload(doc)}
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
                              request.businessInfo.legalBusinessName
                            )
                          }
                          className="text-xs text-[#0066CC] hover:underline cursor-pointer font-normal text-left sm:text-right break-all break-words [overflow-wrap:anywhere] whitespace-normal w-full max-w-full block transition-colors"
                          title="Click to preview file in a new tab"
                        >
                          <span className="break-all break-words [overflow-wrap:anywhere] whitespace-normal block max-w-full">
                            {doc.fileName}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Not uploaded
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Admin-Only Modification Access Control for Approved Requests */}
        {isAdmin && request.status === "APPROVED" && vendorUser && (
          <section className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-indigo-950 text-sm">
                Approved Onboarding Modification Control (Admin Only)
              </p>
              <p className="text-indigo-900 leading-relaxed">
                {vendorUser.allowModificationOnboarding
                  ? `${vendorUser.name} currently has permission to raise one new onboarding request to modify this approved dossier.`
                  : "Vendors are locked to a single onboarding once approved. Enable modification access only if changes are required in this approved dossier."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setModalType("ADMIN_MOD");
                setModalRemark("");
                setModalError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shrink-0 cursor-pointer transition-colors ${
                vendorUser.allowModificationOnboarding
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#2563EB] hover:bg-blue-700"
              }`}
            >
              {vendorUser.allowModificationOnboarding ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Revoke Modification Access</span>
                </>
              ) : (
                <>
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Enable Modification Request</span>
                </>
              )}
            </button>
          </section>
        )}

        {/* Bottom Review Action Buttons (Matching Image 11) */}
        {(canAMAct || canSMAct) && (
          <div className="pt-6 border-t border-slate-200 space-y-4">
            {alreadyApprovedForVendor && isAllowedModification && (
              <div
                role="status"
                className="p-3.5 rounded-xl border border-blue-200 bg-blue-50 flex items-start gap-2.5 text-xs text-blue-900"
              >
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Admin-Authorized Modification Request (Replaces{" "}
                    {request.replacesRequestId ?? alreadyApprovedForVendor.id})
                  </p>
                  <p className="mt-0.5">
                    Approving this request will supersede{" "}
                    <span className="font-mono font-semibold">
                      {alreadyApprovedForVendor.id}
                    </span>{" "}
                    and make this dossier the vendor&apos;s active approved
                    onboarding record.
                  </p>
                </div>
              </div>
            )}

            {alreadyApprovedForVendor && !isAllowedModification && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 flex items-start gap-2.5 text-xs text-amber-900"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Vendor Already Onboarded ({alreadyApprovedForVendor.id})
                  </p>
                  <p className="mt-0.5">
                    This vendor already has an approved onboarding record. Only
                    Admin-enabled modification requests can update an approved
                    onboarding, so final approval is disabled.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                type="button"
                disabled={
                  isSM &&
                  Boolean(alreadyApprovedForVendor) &&
                  !isAllowedModification
                }
                onClick={handleApproveAction}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#0066CC] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve</span>
              </button>

            <button
              type="button"
              onClick={() => {
                setModalType("REJECT");
                setModalRemark("");
                setModalError(null);
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-sm font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModalType("QUERY");
                setModalRemark("");
                setModalError(null);
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <span>Query</span>
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Rejection Modal (Matching Image 12) */}
      <Modal
        open={modalType === "REJECT"}
        onClose={() => setModalType(null)}
        title={
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span>Document Rejection</span>
          </div>
        }
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Details explanation <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={modalRemark}
              onChange={(e) => {
                setModalRemark(e.target.value);
                if (modalError) setModalError(null);
              }}
              placeholder="Provide detailed explanation for rejection..."
              className={`w-full px-3.5 py-2.5 rounded-lg border text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 overflow-y-auto resize-none ${
                modalError
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
              }`}
            />
            <div className="flex items-center justify-between mt-1 text-[11px]">
              {modalError ? (
                <span className="text-red-600 font-medium">{modalError}</span>
              ) : (
                <span />
              )}
              <span className="text-slate-400 font-mono">
                {modalRemark.length}/300 characters allowed
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleModalSubmit}
              className="px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </Modal>

      {/* Document Verification Query Modal (Matching Image 13) */}
      <Modal
        open={modalType === "QUERY"}
        onClose={() => setModalType(null)}
        title={
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-500" />
            <span>Document Verification Query</span>
          </div>
        }
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Query Details <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={modalRemark}
              onChange={(e) => {
                setModalRemark(e.target.value);
                if (modalError) setModalError(null);
              }}
              placeholder="Specify query details or required clarifications for the partner..."
              className={`w-full px-3.5 py-2.5 rounded-lg border text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 overflow-y-auto resize-none ${
                modalError
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-300 focus:border-blue-600"
              }`}
            />
            <div className="flex items-center justify-between mt-1 text-[11px]">
              {modalError ? (
                <span className="text-red-600 font-medium">{modalError}</span>
              ) : (
                <span />
              )}
              <span className="text-slate-400 font-mono">
                {modalRemark.length}/300 characters allowed
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleModalSubmit}
              className="px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </Modal>
      {/* Document Approval Review Modal (Optional Remark for AM) */}
      <Modal
        open={modalType === "APPROVE"}
        onClose={() => setModalType(null)}
        title={
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Approve Request</span>
          </div>
        }
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Review Remark <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={300}
              value={modalRemark}
              onChange={(e) => {
                setModalRemark(e.target.value);
                if (modalError) setModalError(null);
              }}
              placeholder="Add optional approval remarks or recommendation for Senior Manager..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 overflow-y-auto resize-none"
            />
            <div className="flex items-center justify-between mt-1 text-[11px]">
              <span className="text-slate-400">Optional remark</span>
              <span className="text-slate-400 font-mono">
                {modalRemark.length}/300 characters allowed
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleModalSubmit}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              Approve &amp; Escalate
            </button>
          </div>
        </div>
      </Modal>
      {/* Admin Modification Access Modal */}
      <Modal
        open={modalType === "ADMIN_MOD"}
        onClose={() => setModalType(null)}
        title={
          vendorUser?.allowModificationOnboarding
            ? "Revoke Modification Access"
            : "Enable Onboarding Modification Request"
        }
        maxWidthClass="max-w-md"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {vendorUser?.allowModificationOnboarding
              ? "Revoking access prevents this vendor from creating a new modification onboarding request."
              : "Allow this onboarded vendor to raise one new onboarding request to modify details in their approved dossier."}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Admin Remark / Reason{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={250}
              value={modalRemark}
              onChange={(e) => setModalRemark(e.target.value)}
              placeholder="e.g. Bank account / GSTIN modification requested"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleModalSubmit}
              className={`px-5 py-2 rounded-lg text-white text-xs font-semibold cursor-pointer ${
                vendorUser?.allowModificationOnboarding
                  ? "bg-amber-600 hover:bg-amber-700"
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
