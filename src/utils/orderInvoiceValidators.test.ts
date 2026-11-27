import test from "node:test";
import assert from "node:assert/strict";
import {
  SEED_INVOICES,
  SEED_ORDERS,
  SEED_REQUESTS,
  SEED_USERS,
} from "../data/seedData";
import {
  computeInvoiceTotals,
  computeLineItemsTotals,
  findInvoiceNumberConflict,
  getAccessibleInvoicesForReviewer,
  getAccessibleOrdersForReviewer,
  getApprovedOnboardingRequestsForVendor,
  validateInvoiceAttachment,
  validateInvoiceForm,
  validateOrderForm,
} from "./orderInvoiceValidators";

test("getApprovedOnboardingRequestsForVendor returns only APPROVED requests for that vendor", () => {
  const rohanApproved = getApprovedOnboardingRequestsForVendor(
    "usr_vendor_01",
    SEED_REQUESTS
  );
  assert.deepEqual(
    rohanApproved.map((r) => r.id),
    ["REQ-2026-105"]
  );

  // Kavita has DRAFT, PENDING_SM_APPROVAL, QUERY_TO_AM — none APPROVED yet
  const kavitaApproved = getApprovedOnboardingRequestsForVendor(
    "usr_vendor_02",
    SEED_REQUESTS
  );
  assert.equal(kavitaApproved.length, 0);
});

test("computeLineItemsTotals and computeInvoiceTotals compute GST and TDS accurately", () => {
  const lines = [
    {
      id: "1",
      description: "Fleet Trip",
      hsnSacCode: "996511",
      quantity: 2,
      unit: "Trips",
      unitPrice: 10000,
      gstRate: 12 as const,
    },
    {
      id: "2",
      description: "Handling",
      hsnSacCode: "996719",
      quantity: 2,
      unit: "Trips",
      unitPrice: 1000,
      gstRate: 18 as const,
    },
  ];
  const orderTotals = computeLineItemsTotals(lines);
  assert.equal(orderTotals.subtotal, 22000);
  assert.equal(orderTotals.taxAmount, 2400 + 360);
  assert.equal(orderTotals.totalAmount, 24760);

  const invTotals = computeInvoiceTotals(lines, 2);
  assert.equal(invTotals.tdsAmount, 440); // 2% of 22000
  assert.equal(invTotals.netPayableAmount, 24760 - 440);
});

test("validateOrderForm enforces approved entity, required fields, and valid line items", () => {
  const approved = getApprovedOnboardingRequestsForVendor(
    "usr_vendor_01",
    SEED_REQUESTS
  );

  const badErrors = validateOrderForm(
    {
      onboardingRequestId: "REQ-2026-101", // PENDING_AM_REVIEW, not approved
      title: "AB",
      category: "",
      expectedDeliveryDate: "",
      deliveryLocation: "",
      paymentTerms: "",
      lineItems: [
        {
          id: "1",
          description: "",
          hsnSacCode: "12",
          quantity: 0,
          unit: "Trips",
          unitPrice: 0,
          gstRate: 18,
        },
      ],
    },
    approved,
    false
  );
  assert.ok(badErrors.onboardingRequestId);
  assert.ok(badErrors.title);
  assert.ok(badErrors.category);
  assert.ok(badErrors.expectedDeliveryDate);
  assert.ok(badErrors.deliveryLocation);
  assert.ok(badErrors.line_0_description);
  assert.ok(badErrors.line_0_hsn);
  assert.ok(badErrors.line_0_quantity);
  assert.ok(badErrors.line_0_unitPrice);

  const goodErrors = validateOrderForm(
    {
      onboardingRequestId: "REQ-2026-105",
      title: "Pune Fleet Contract Q4",
      category: "Logistics & Supply Chain",
      expectedDeliveryDate: "2026-12-20",
      deliveryLocation: "Pune Hub",
      paymentTerms: "Net 30",
      lineItems: [
        {
          id: "1",
          description: "Container Truck",
          hsnSacCode: "996511",
          quantity: 5,
          unit: "Trips",
          unitPrice: 15000,
          gstRate: 12,
        },
      ],
    },
    approved,
    false
  );
  assert.deepEqual(goodErrors, {});
});

test("validateInvoiceForm validates duplicate invoice number, date range, attachment, and linked order", () => {
  const approved = getApprovedOnboardingRequestsForVendor(
    "usr_vendor_01",
    SEED_REQUESTS
  );
  const approvedOrders = SEED_ORDERS.filter((o) => o.status === "APPROVED");

  assert.ok(findInvoiceNumberConflict("kfm/2026-27/104", "usr_vendor_01", SEED_INVOICES));
  assert.equal(
    findInvoiceNumberConflict("KFM/2026-27/104", "usr_vendor_01", SEED_INVOICES, "INV-2026-101"),
    null
  );
  assert.ok(validateInvoiceAttachment("invoice.exe", 1024));
  assert.equal(validateInvoiceAttachment("invoice.pdf", 1024), null);

  const errors = validateInvoiceForm(
    {
      onboardingRequestId: "REQ-2026-105",
      orderId: "ORD-2026-102", // PENDING_AM_REVIEW, not APPROVED
      invoiceNumber: "KFM/2026-27/104", // duplicate
      invoiceDate: "2026-11-25",
      dueDate: "2026-11-20", // earlier than invoiceDate
      tdsRate: 2,
      lineItems: SEED_INVOICES[0].lineItems,
      attachmentFileName: "",
    },
    approved,
    approvedOrders,
    SEED_INVOICES,
    "usr_vendor_01",
    undefined,
    false
  );
  assert.ok(errors.orderId);
  assert.ok(errors.invoiceNumber);
  assert.ok(errors.dueDate);
  assert.ok(errors.attachment);
});

test("Reviewer scoping for Orders and Invoices respects businessType mapping and ownership lock", () => {
  const priya = SEED_USERS.find((u) => u.id === "usr_am_01")!; // Private/Public/LLP
  const rahul = SEED_USERS.find((u) => u.id === "usr_am_02")!; // Private/Partnership/Proprietorship
  const vikram = SEED_USERS.find((u) => u.id === "usr_sm_01")!; // Private/Public/LLP
  const meenakshi = SEED_USERS.find((u) => u.id === "usr_sm_02")!; // Partnership/Proprietorship

  assert.equal(getAccessibleOrdersForReviewer(priya, SEED_ORDERS).length, 0);
  assert.deepEqual(
    getAccessibleOrdersForReviewer(rahul, SEED_ORDERS).map((o) => o.id).sort(),
    ["ORD-2026-101", "ORD-2026-102"]
  );
  assert.equal(getAccessibleInvoicesForReviewer(vikram, SEED_INVOICES).length, 0);
  assert.deepEqual(
    getAccessibleInvoicesForReviewer(meenakshi, SEED_INVOICES).map((i) => i.id).sort(),
    ["INV-2026-101", "INV-2026-102"]
  );
});
