import test from "node:test";
import assert from "node:assert/strict";
import { SEED_REQUESTS, SEED_USERS } from "../data/seedData";
import {
  buildEmptyDocuments,
  findGstinConflict,
  getAccessibleRequestsForReviewer,
  getVendorOnboardingLockState,
  validateAllWizardSteps,
  validateDraftMinimal,
  validateKycFileUpload,
  validateStep1Business,
  validateStep2Contact,
  validateStep3Bank,
  validateStep4Documents,
} from "./requestValidators";

test("Unique GSTIN guard blocks active/approved duplicate across any vendor and ignores REJECTED", () => {
  const conflict = findGstinConflict("27aabca1234d1z5", SEED_REQUESTS);
  assert.equal(conflict?.id, "REQ-2026-101");

  // Same request ID excluded when editing
  const selfEdit = findGstinConflict(
    "27AABCA1234D1Z5",
    SEED_REQUESTS,
    "REQ-2026-101"
  );
  assert.equal(selfEdit, null);

  // Rejected requests do not block GSTIN reuse
  const withRejected = SEED_REQUESTS.map((r) =>
    r.id === "REQ-2026-101" ? { ...r, status: "REJECTED" as const } : r
  );
  assert.equal(findGstinConflict("27AABCA1234D1Z5", withRejected), null);
});

test("Step 1 business & tax validation enforces GSTIN, PAN, Udyam, and duplicate GSTIN error", () => {
  const errors = validateStep1Business(
    {
      legalBusinessName: "New Logistics Pvt Ltd",
      tradeName: "",
      businessType: "Private Limited",
      businessCategory: "Logistics & Supply Chain",
      yearEstablished: "2020",
      gstin: "27AABCA1234D1Z5", // Duplicate of REQ-2026-101
      pan: "AABCA1234D",
      msmeNumber: "BAD-UDYAM",
    },
    SEED_REQUESTS
  );
  assert.equal(
    errors.gstin,
    "An active or approved onboarding request already exists for this GSTIN."
  );
  assert.ok(errors.msmeNumber);
});

test("Step 2 & Step 3 validate Indian pincode, mobile, account number, and IFSC", () => {
  const cErrors = validateStep2Contact({
    primaryContactName: "Rohan",
    designation: "Director",
    email: "bad-email",
    phone: "12345",
    registeredAddress: "Short",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "012345",
  });
  assert.ok(cErrors.email);
  assert.ok(cErrors.phone);
  assert.ok(cErrors.registeredAddress);
  assert.ok(cErrors.pincode);

  const bErrors = validateStep3Bank({
    accountHolderName: "Apex",
    bankName: "HDFC Bank",
    accountNumber: "1234",
    ifscCode: "HDFC1000240", // 5th char must be 0
    accountType: "Current",
  });
  assert.ok(bErrors.accountNumber);
  assert.ok(bErrors.ifscCode);
});

test("Step 4 validates required KYC rows, optional file->number dependency, and file extension/size", () => {
  assert.ok(validateKycFileUpload("GST_CERT", "gst.png", 1024));
  assert.equal(validateKycFileUpload("GST_CERT", "gst.pdf", 1024), null);
  assert.ok(
    validateKycFileUpload("PAN_CARD", "pan.pdf", 6 * 1024 * 1024)
  );

  const docs = buildEmptyDocuments([]);
  // Attach file to optional INCORP_CERT without entering CIN number
  const withIncorpFile = docs.map((d) =>
    d.docType === "INCORP_CERT" ? { ...d, fileName: "coi.pdf" } : d
  );
  const dErrors = validateStep4Documents(withIncorpFile);
  assert.ok(dErrors.PAN_CARD_number);
  assert.ok(dErrors.PAN_CARD_file);
  assert.ok(dErrors.INCORP_CERT_number);
});

test("Draft minimal validation & full wizard step jump detection work accurately", () => {
  const draftBad = validateDraftMinimal({
    legalBusinessName: "AB",
    tradeName: "",
    businessType: "",
    businessCategory: "",
    yearEstablished: "",
    gstin: "",
    pan: "",
    msmeNumber: "",
  });
  assert.ok(draftBad.legalBusinessName);
  assert.ok(draftBad.businessType);

  const allCheck = validateAllWizardSteps(
    {
      businessInfo: SEED_REQUESTS[0].businessInfo,
      contactInfo: SEED_REQUESTS[0].contactInfo,
      bankInfo: SEED_REQUESTS[0].bankInfo,
      documents: buildEmptyDocuments(SEED_REQUESTS[0].documents),
    },
    SEED_REQUESTS,
    "REQ-2026-101"
  );
  assert.equal(allCheck.firstInvalidStep, null);
});

test("AM and SM queue scoping enforces business-type mapping and ownership lock", () => {
  const priya = SEED_USERS.find((u) => u.id === "usr_am_01")!;
  const rahul = SEED_USERS.find((u) => u.id === "usr_am_02")!;
  const vikram = SEED_USERS.find((u) => u.id === "usr_sm_01")!;
  const meenakshi = SEED_USERS.find((u) => u.id === "usr_sm_02")!;

  const priyaQueue = getAccessibleRequestsForReviewer(priya, SEED_REQUESTS).map(
    (r) => r.id
  );
  // Priya sees unclaimed REQ-2026-101 + her assigned REQ-2026-102, REQ-2026-103
  assert.deepEqual(priyaQueue.sort(), [
    "REQ-2026-101",
    "REQ-2026-102",
    "REQ-2026-103",
  ]);

  const rahulQueue = getAccessibleRequestsForReviewer(rahul, SEED_REQUESTS).map(
    (r) => r.id
  );
  // Rahul sees unclaimed REQ-2026-101 + his assigned REQ-2026-104, REQ-2026-105
  assert.deepEqual(rahulQueue.sort(), [
    "REQ-2026-101",
    "REQ-2026-104",
    "REQ-2026-105",
  ]);

  // Simulate Priya locking REQ-2026-101 -> Rahul must no longer see it
  const afterClaim = SEED_REQUESTS.map((r) =>
    r.id === "REQ-2026-101"
      ? { ...r, assignedAmId: priya.id, status: "PENDING_SM_APPROVAL" as const }
      : r
  );
  const rahulAfter = getAccessibleRequestsForReviewer(rahul, afterClaim).map(
    (r) => r.id
  );
  assert.equal(rahulAfter.includes("REQ-2026-101"), false);

  const vikramQueue = getAccessibleRequestsForReviewer(vikram, SEED_REQUESTS).map(
    (r) => r.id
  );
  // Vikram sees unclaimed Private Limited REQ-2026-103 + his assigned REQ-2026-105
  assert.deepEqual(vikramQueue.sort(), ["REQ-2026-103", "REQ-2026-105"]);

  const meenakshiQueue = getAccessibleRequestsForReviewer(
    meenakshi,
    SEED_REQUESTS
  ).map((r) => r.id);
  // Meenakshi sees her assigned REQ-2026-104
  assert.deepEqual(meenakshiQueue, ["REQ-2026-104"]);
});

test("getVendorOnboardingLockState enforces single onboarding per vendor", () => {
  const rohanLock = getVendorOnboardingLockState("usr_vendor_01", SEED_REQUESTS);
  assert.equal(rohanLock.isOnboarded, true);
  assert.equal(rohanLock.approvedRequest?.id, "REQ-2026-105");
  assert.equal(rohanLock.canCreateNewOnboarding, false);

  const kavitaLock = getVendorOnboardingLockState("usr_vendor_02", SEED_REQUESTS);
  assert.equal(kavitaLock.isOnboarded, false);
  assert.ok(kavitaLock.activeRequest);
  assert.equal(kavitaLock.canCreateNewOnboarding, false);

  // Fresh vendor or vendor whose previous application was REJECTED can create a new onboarding request
  const freshLock = getVendorOnboardingLockState("usr_vendor_new", SEED_REQUESTS);
  assert.equal(freshLock.isOnboarded, false);
  assert.equal(freshLock.canCreateNewOnboarding, true);

  const rejectedOnly = [
    { ...SEED_REQUESTS[0], vendorUserId: "usr_vendor_rejected", status: "REJECTED" as const },
  ];
  const rejectedLock = getVendorOnboardingLockState("usr_vendor_rejected", rejectedOnly);
  assert.equal(rejectedLock.isOnboarded, false);
  assert.equal(rejectedLock.canCreateNewOnboarding, true);

  // Admin-enabled modification unlocks new onboarding request for an already-onboarded vendor
  const modUnlocked = getVendorOnboardingLockState("usr_vendor_01", SEED_REQUESTS, {
    allowModificationOnboarding: true,
  });
  assert.equal(modUnlocked.isOnboarded, true);
  assert.equal(modUnlocked.modificationEnabledByAdmin, true);
  assert.equal(modUnlocked.canCreateNewOnboarding, true);

  // Same-vendor approved GSTIN is allowed when allowApprovedForVendorUserId matches
  const approvedReq = SEED_REQUESTS.find((r) => r.id === "REQ-2026-105")!;
  assert.ok(findGstinConflict(approvedReq.businessInfo.gstin, SEED_REQUESTS));
  assert.equal(
    findGstinConflict(
      approvedReq.businessInfo.gstin,
      SEED_REQUESTS,
      undefined,
      "usr_vendor_01"
    ),
    null
  );
  // Still blocks another vendor's GSTIN
  assert.ok(
    findGstinConflict(
      SEED_REQUESTS[0].businessInfo.gstin,
      SEED_REQUESTS,
      undefined,
      "usr_vendor_01"
    )
  );
});
