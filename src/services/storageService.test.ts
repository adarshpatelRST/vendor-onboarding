import test from "node:test";
import assert from "node:assert/strict";
import { StorageLike, StorageService } from "./storageService";

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test("StorageService initializes exact seed counts", () => {
  const svc = new StorageService(createMemoryStorage());
  svc.initSeedIfNeeded();

  assert.equal(svc.getUsers().length, 7);
  assert.equal(svc.getBusinessTypes().length, 5);
  assert.equal(svc.getRequests().length, 6);
  assert.equal(svc.getAuditLogs().length, 4);
});

test("StorageService blocks INACTIVE user login and allows ACTIVE login", () => {
  const svc = new StorageService(createMemoryStorage());
  const okRes = svc.authenticate("admin@vendorflow.in", "Demo@2026");
  assert.equal(okRes.ok, true);

  svc.toggleUserStatus("usr_vendor_02", {
    id: "usr_admin_01",
    name: "Ananya Sharma",
    role: "ADMIN",
  });

  const blocked = svc.authenticate("kavita@technova.co.in", "Demo@2026");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(
      blocked.error,
      "Your account has been deactivated by the Administrator."
    );
  }
});

test("StorageService writes audit logs with oldData and newData on mapping and vendor signup", () => {
  const svc = new StorageService(createMemoryStorage());
  const beforeCount = svc.getAuditLogs().length;

  const newVendor = svc.registerVendor({
    name: "Neha Kapoor",
    email: "neha@kapoorfoods.in",
    phone: "9898989898",
    password: "Vendor@2026",
  });
  assert.equal(newVendor.role, "VENDOR");
  assert.equal(svc.getAuditLogs().length, beforeCount + 1);
  assert.equal(svc.getAuditLogs()[0].action, "VENDOR_SIGNUP");
  assert.equal(svc.getAuditLogs()[0].oldData, null);

  svc.updateUserBusinessMapping(
    "usr_am_01",
    ["Private Limited", "Partnership"],
    { id: "usr_admin_01", name: "Ananya Sharma", role: "ADMIN" }
  );

  const latest = svc.getAuditLogs()[0];
  assert.equal(latest.tableName, "UserBusinessMapping");
  assert.equal(latest.action, "MAPPING_UPDATED");
  assert.deepEqual(latest.oldData?.mappedBusinessTypes, [
    "Private Limited",
    "Public Limited",
    "LLP",
  ]);
  assert.deepEqual(latest.newData?.mappedBusinessTypes, [
    "Private Limited",
    "Partnership",
  ]);
});

test("StorageService resetDemoData restores initial seed state", () => {
  const svc = new StorageService(createMemoryStorage());
  svc.registerVendor({
    name: "Test User",
    email: "test@example.in",
    phone: "9876543210",
    password: "Vendor@2026",
  });
  assert.equal(svc.getUsers().length, 8);

  svc.resetDemoData();
  assert.equal(svc.getUsers().length, 7);
  assert.equal(svc.getAuditLogs().length, 4);
  assert.equal(svc.getSessionUser(), null);
});

test("StorageService handles Vendor draft/submit and AM/SM ownership lock transitions with audit logs", () => {
  const svc = new StorageService(createMemoryStorage());
  const vendor = svc.registerVendor({
    name: "Neha Kapoor",
    email: "neha.onboarding@example.in",
    phone: "9898989898",
    password: "Vendor@2026",
  });
  const priya = svc.getUsers().find((u) => u.id === "usr_am_01")!;
  const vikram = svc.getUsers().find((u) => u.id === "usr_sm_01")!;

  const sampleReq = svc.getRequests()[0];
  const draft = svc.saveDraftRequest(
    {
      businessInfo: {
        ...sampleReq.businessInfo,
        legalBusinessName: "Apex Maritime Pvt Ltd",
        gstin: "27AABCA9999D1Z5",
      },
      contactInfo: sampleReq.contactInfo,
      bankInfo: sampleReq.bankInfo,
      documents: sampleReq.documents,
    },
    { id: vendor.id, name: vendor.name, role: vendor.role }
  );
  assert.equal(draft.id, "REQ-2026-107");
  assert.equal(draft.status, "DRAFT");

  // Calling saveDraftRequest again without an explicit ID reuses and updates the existing draft
  const draft2 = svc.saveDraftRequest(
    {
      businessInfo: {
        ...draft.businessInfo,
        legalBusinessName: "Apex Maritime Global Pvt Ltd",
      },
      contactInfo: draft.contactInfo,
      bankInfo: draft.bankInfo,
      documents: draft.documents,
    },
    { id: vendor.id, name: vendor.name, role: vendor.role }
  );
  assert.equal(draft2.id, "REQ-2026-107");
  assert.equal(draft2.businessInfo.legalBusinessName, "Apex Maritime Global Pvt Ltd");

  const submitted = svc.submitVendorRequest(
    {
      businessInfo: draft.businessInfo,
      contactInfo: draft.contactInfo,
      bankInfo: draft.bankInfo,
      documents: draft.documents,
    },
    { id: vendor.id, name: vendor.name, role: vendor.role },
    draft.id
  );
  assert.equal(submitted.status, "PENDING_AM_REVIEW");
  assert.equal(submitted.remarkHistory.length, 1);

  // Cannot create a second onboarding request while an active request is in progress
  assert.throws(
    () =>
      svc.submitVendorRequest(
        {
          businessInfo: {
            ...draft.businessInfo,
            gstin: "27AABCA8888D1Z5",
          },
          contactInfo: draft.contactInfo,
          bankInfo: draft.bankInfo,
          documents: draft.documents,
        },
        { id: vendor.id, name: vendor.name, role: vendor.role }
      ),
    /active onboarding request/
  );

  // AM Priya claims & forwards
  const forwarded = svc.transitionRequestByAM(
    submitted.id,
    "FORWARD",
    "Verified all GST & bank proof.",
    { id: priya.id, name: priya.name, role: priya.role }
  );
  assert.equal(forwarded.status, "PENDING_SM_APPROVAL");
  assert.equal(forwarded.assignedAmId, priya.id);

  // SM Vikram queries AM -> approves after reply
  const queried = svc.transitionRequestBySM(
    submitted.id,
    "QUERY",
    "Please verify registered warehouse lease.",
    { id: vikram.id, name: vikram.name, role: vikram.role }
  );
  assert.equal(queried.status, "QUERY_TO_AM");
  assert.equal(queried.assignedSmId, vikram.id);

  const replied = svc.transitionRequestByAM(
    submitted.id,
    "FORWARD",
    "Warehouse lease verified.",
    { id: priya.id, name: priya.name, role: priya.role }
  );
  assert.equal(replied.status, "PENDING_SM_APPROVAL");

  const approved = svc.transitionRequestBySM(
    submitted.id,
    "APPROVE",
    "Approved for onboarding.",
    { id: vikram.id, name: vikram.name, role: vikram.role }
  );
  assert.equal(approved.status, "APPROVED");
  assert.equal(svc.getAuditLogs()[0].action, "APPROVED");
  assert.equal(svc.getAuditLogs()[0].recordId, submitted.id);

  // Once onboarded, vendor cannot save draft or submit another onboarding request
  assert.throws(
    () =>
      svc.saveDraftRequest(
        {
          businessInfo: {
            ...draft.businessInfo,
            gstin: "27AABCA7777D1Z5",
          },
          contactInfo: draft.contactInfo,
          bankInfo: draft.bankInfo,
          documents: draft.documents,
        },
        { id: vendor.id, name: vendor.name, role: vendor.role }
      ),
    /already onboarded/
  );

  // SM cannot approve a second onboarding request for an already-onboarded vendor (e.g. usr_vendor_01)
  svc.transitionRequestByAM(
    "REQ-2026-101",
    "APPROVE",
    "Verified",
    { id: priya.id, name: priya.name, role: priya.role }
  );
  assert.throws(
    () =>
      svc.transitionRequestBySM(
        "REQ-2026-101",
        "APPROVE",
        "Try second onboarding",
        { id: vikram.id, name: vikram.name, role: vikram.role }
      ),
    /already onboarded/
  );
});

test("StorageService blocks Order & Invoice creation until vendor onboarding is APPROVED", () => {
  const svc = new StorageService(createMemoryStorage());
  const kavita = svc.getUsers().find((u) => u.id === "usr_vendor_02")!;
  const rohan = svc.getUsers().find((u) => u.id === "usr_vendor_01")!;
  const rahul = svc.getUsers().find((u) => u.id === "usr_am_02")!;
  const meenakshi = svc.getUsers().find((u) => u.id === "usr_sm_02")!;

  // Kavita's REQ-2026-103 is PENDING_SM_APPROVAL -> blocked
  assert.throws(
    () =>
      svc.submitOrderRequest(
        {
          onboardingRequestId: "REQ-2026-103",
          title: "Cloud Infrastructure Expansion",
          category: "IT & Software",
          expectedDeliveryDate: "2026-12-20",
          deliveryLocation: "Bengaluru",
          paymentTerms: "Net 30",
          notes: "",
          lineItems: [
            {
              id: "li_1",
              description: "GPU Cluster",
              hsnSacCode: "998315",
              quantity: 1,
              unit: "Months",
              unitPrice: 50000,
              gstRate: 18,
            },
          ],
        },
        { id: kavita.id, name: kavita.name, role: kavita.role }
      ),
    /must be APPROVED/
  );

  // Rohan cannot raise an order using Kavita's entity
  assert.throws(
    () =>
      svc.saveDraftOrder(
        {
          onboardingRequestId: "REQ-2026-103",
          title: "Unauthorized Order",
          category: "Logistics & Supply Chain",
          expectedDeliveryDate: "2026-12-20",
          deliveryLocation: "Mumbai",
          paymentTerms: "Net 30",
          notes: "",
          lineItems: [],
        },
        { id: rohan.id, name: rohan.name, role: rohan.role }
      ),
    /own onboarded entities/
  );

  // Rohan raises Order against APPROVED REQ-2026-105 -> AM verifies -> SM approves -> Invoice raised & paid
  const orderDraft = svc.saveDraftOrder(
    {
      onboardingRequestId: "REQ-2026-105",
      title: "Pune Warehouse Shuttle Q4",
      category: "Logistics & Supply Chain",
      expectedDeliveryDate: "2026-12-25",
      deliveryLocation: "Pune",
      paymentTerms: "Net 30",
      notes: "Dedicated shuttle",
      lineItems: [
        {
          id: "li_o1",
          description: "20ft Closed Truck",
          hsnSacCode: "996511",
          quantity: 4,
          unit: "Trips",
          unitPrice: 12000,
          gstRate: 12,
        },
      ],
    },
    { id: rohan.id, name: rohan.name, role: rohan.role }
  );
  assert.equal(orderDraft.id, "ORD-2026-103");
  assert.equal(orderDraft.status, "DRAFT");
  assert.equal(orderDraft.totalAmount, 53760);

  const orderSubmitted = svc.submitOrderRequest(
    {
      onboardingRequestId: "REQ-2026-105",
      title: orderDraft.title,
      category: orderDraft.category,
      expectedDeliveryDate: orderDraft.expectedDeliveryDate,
      deliveryLocation: orderDraft.deliveryLocation,
      paymentTerms: orderDraft.paymentTerms,
      notes: orderDraft.notes,
      lineItems: orderDraft.lineItems,
    },
    { id: rohan.id, name: rohan.name, role: rohan.role },
    orderDraft.id
  );
  assert.equal(orderSubmitted.status, "PENDING_AM_REVIEW");

  // Cannot link unapproved order to an invoice yet
  assert.throws(
    () =>
      svc.submitInvoiceRequest(
        {
          onboardingRequestId: "REQ-2026-105",
          orderId: orderSubmitted.id,
          invoiceNumber: "KFM/2026-27/200",
          invoiceDate: "2026-11-26",
          dueDate: "2026-12-26",
          tdsRate: 2,
          lineItems: orderSubmitted.lineItems,
          attachment: {
            fileName: "inv_200.pdf",
            fileType: "application/pdf",
            fileSize: "300 KB",
            uploadedAt: "2026-11-26T10:00:00.000Z",
          },
          notes: "",
        },
        { id: rohan.id, name: rohan.name, role: rohan.role }
      ),
    /APPROVED orders/
  );

  const orderAmVerified = svc.transitionOrderByAM(
    orderSubmitted.id,
    "APPROVE",
    "Rates verified.",
    { id: rahul.id, name: rahul.name, role: rahul.role }
  );
  assert.equal(orderAmVerified.status, "PENDING_SM_APPROVAL");

  const orderApproved = svc.transitionOrderBySM(
    orderSubmitted.id,
    "APPROVE",
    "Approved.",
    { id: meenakshi.id, name: meenakshi.name, role: meenakshi.role }
  );
  assert.equal(orderApproved.status, "APPROVED");

  const invoiceSubmitted = svc.submitInvoiceRequest(
    {
      onboardingRequestId: "REQ-2026-105",
      orderId: orderApproved.id,
      invoiceNumber: "KFM/2026-27/201",
      invoiceDate: "2026-11-27",
      dueDate: "2026-12-27",
      tdsRate: 2,
      lineItems: orderApproved.lineItems,
      attachment: {
        fileName: "inv_201.pdf",
        fileType: "application/pdf",
        fileSize: "320 KB",
        uploadedAt: "2026-11-27T10:00:00.000Z",
      },
      notes: "Completed 4 trips",
    },
    { id: rohan.id, name: rohan.name, role: rohan.role }
  );
  assert.equal(invoiceSubmitted.id, "INV-2026-103");
  assert.equal(invoiceSubmitted.status, "PENDING_AM_REVIEW");
  assert.equal(invoiceSubmitted.tdsAmount, 960);
  assert.equal(invoiceSubmitted.netPayableAmount, 52800);

  const invAmVerified = svc.transitionInvoiceByAM(
    invoiceSubmitted.id,
    "APPROVE",
    "POD checked.",
    { id: rahul.id, name: rahul.name, role: rahul.role }
  );
  assert.equal(invAmVerified.status, "PENDING_SM_APPROVAL");

  const invApproved = svc.transitionInvoiceBySM(
    invoiceSubmitted.id,
    "APPROVE",
    "Payout approved.",
    { id: meenakshi.id, name: meenakshi.name, role: meenakshi.role }
  );
  assert.equal(invApproved.status, "APPROVED");

  const invPaid = svc.transitionInvoiceBySM(
    invoiceSubmitted.id,
    "MARK_PAID",
    "UTR123456789 settled.",
    { id: meenakshi.id, name: meenakshi.name, role: meenakshi.role }
  );
  assert.equal(invPaid.status, "PAID");
  assert.equal(svc.getAuditLogs()[0].tableName, "Invoice");
  assert.equal(svc.getAuditLogs()[0].action, "INVOICE_MARKED_PAID");
});

test("Only Admin can enable new onboarding request for modification of an Approved request, superseding old request on approval", () => {
  const svc = new StorageService(createMemoryStorage());
  const rohan = svc.getUsers().find((u) => u.id === "usr_vendor_01")!;
  const priya = svc.getUsers().find((u) => u.id === "usr_am_01")!;
  const rahul = svc.getUsers().find((u) => u.id === "usr_am_02")!;
  const meenakshi = svc.getUsers().find((u) => u.id === "usr_sm_02")!;
  const admin = svc.getUsers().find((u) => u.id === "usr_admin_01")!;

  const approved105 = svc.getRequests().find((r) => r.id === "REQ-2026-105")!;

  // Non-admin roles cannot enable modification access
  assert.throws(
    () =>
      svc.setVendorModificationAccess(
        rohan.id,
        true,
        "Try by AM",
        { id: priya.id, name: priya.name, role: priya.role }
      ),
    /Only System Admin/
  );
  assert.throws(
    () =>
      svc.setVendorModificationAccess(
        rohan.id,
        true,
        "Try by Vendor",
        { id: rohan.id, name: rohan.name, role: rohan.role }
      ),
    /Only System Admin/
  );

  // Vendor without modification access cannot raise a new onboarding request
  assert.throws(
    () =>
      svc.submitVendorRequest(
        {
          businessInfo: approved105.businessInfo,
          contactInfo: approved105.contactInfo,
          bankInfo: { ...approved105.bankInfo, accountNumber: "999988887777" },
          documents: approved105.documents,
        },
        { id: rohan.id, name: rohan.name, role: rohan.role }
      ),
    /Only Admin can enable/
  );

  // Admin enables modification access for Rohan
  const enabledUser = svc.setVendorModificationAccess(
    rohan.id,
    true,
    "Bank account update required",
    { id: admin.id, name: admin.name, role: admin.role }
  );
  assert.equal(enabledUser.allowModificationOnboarding, true);
  assert.equal(svc.getAuditLogs()[0].action, "MODIFICATION_REQUEST_ENABLED");

  // Rohan saves a draft modification request and submits it (consuming the single-use grant)
  const modDraft = svc.saveDraftRequest(
    {
      businessInfo: approved105.businessInfo,
      contactInfo: approved105.contactInfo,
      bankInfo: { ...approved105.bankInfo, accountNumber: "999988887777" },
      documents: approved105.documents,
    },
    { id: rohan.id, name: rohan.name, role: rohan.role }
  );
  assert.equal(modDraft.isModificationRequest, true);
  assert.equal(modDraft.replacesRequestId, "REQ-2026-105");

  const modSubmitted = svc.submitVendorRequest(
    {
      businessInfo: modDraft.businessInfo,
      contactInfo: modDraft.contactInfo,
      bankInfo: modDraft.bankInfo,
      documents: modDraft.documents,
    },
    { id: rohan.id, name: rohan.name, role: rohan.role },
    modDraft.id
  );
  assert.equal(modSubmitted.status, "PENDING_AM_REVIEW");
  assert.equal(modSubmitted.isModificationRequest, true);

  // Single-use Admin grant is consumed upon submission
  const refreshedRohan = svc.getUsers().find((u) => u.id === rohan.id)!;
  assert.equal(refreshedRohan.allowModificationOnboarding, false);

  // Vendor cannot submit another new modification request without Admin enabling again
  assert.throws(
    () =>
      svc.submitVendorRequest(
        {
          businessInfo: approved105.businessInfo,
          contactInfo: approved105.contactInfo,
          bankInfo: approved105.bankInfo,
          documents: approved105.documents,
        },
        { id: rohan.id, name: rohan.name, role: rohan.role }
      ),
    /Only Admin can enable/
  );

  // AM verifies and SM approves modification request -> REQ-2026-105 becomes SUPERSEDED
  svc.transitionRequestByAM(
    modSubmitted.id,
    "APPROVE",
    "Verified updated bank account.",
    { id: rahul.id, name: rahul.name, role: rahul.role }
  );
  const modApproved = svc.transitionRequestBySM(
    modSubmitted.id,
    "APPROVE",
    "Approved bank modification.",
    { id: meenakshi.id, name: meenakshi.name, role: meenakshi.role }
  );
  assert.equal(modApproved.status, "APPROVED");

  const old105 = svc.getRequests().find((r) => r.id === "REQ-2026-105")!;
  assert.equal(old105.status, "SUPERSEDED");
});
