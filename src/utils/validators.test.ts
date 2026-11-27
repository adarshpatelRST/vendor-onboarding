import test from "node:test";
import assert from "node:assert/strict";
import { SEED_BUSINESS_TYPES, SEED_USERS } from "../data/seedData";
import {
  evaluatePasswordRules,
  isLastActiveAdminViolation,
  validateBusinessTypeForm,
  validateEmail,
  validateFullName,
  validateIndianMobile,
  validateVendorSignUpForm,
} from "./validators";

test("validateFullName enforces 2-60 chars and letters/spaces only", () => {
  assert.equal(validateFullName(""), "Full name is required.");
  assert.equal(
    validateFullName("A"),
    "Full name must be between 2 and 60 characters."
  );
  assert.equal(
    validateFullName("Rohan123"),
    "Full name may contain letters and single spaces only."
  );
  assert.equal(validateFullName("Rohan Kulkarni"), null);
});

test("validateEmail enforces format and case-insensitive uniqueness", () => {
  assert.equal(
    validateEmail("ROHAN@APEXLOGISTICS.IN", SEED_USERS),
    "This email is already registered"
  );
  assert.equal(
    validateEmail("ROHAN@APEXLOGISTICS.IN", SEED_USERS, "usr_vendor_01"),
    null
  );
  assert.equal(validateEmail("newvendor@company.in", SEED_USERS), null);
});

test("validateIndianMobile enforces 10-digit Indian mobile numbers", () => {
  assert.equal(validateIndianMobile("9820145678"), null);
  assert.equal(validateIndianMobile("5820145678"), null);
  assert.equal(validateIndianMobile("1234567890"), null);
  assert.equal(
    validateIndianMobile("982014567"),
    "Enter a valid 10-digit Indian mobile number."
  );
  assert.equal(
    validateIndianMobile("98201456789"),
    "Enter a valid 10-digit Indian mobile number."
  );
});

test("evaluatePasswordRules verifies all 5 password criteria", () => {
  const weak = evaluatePasswordRules("abc123");
  assert.equal(weak.minMaxLength, false);
  assert.equal(weak.hasUppercase, false);
  assert.equal(weak.hasSpecial, false);

  const strong = evaluatePasswordRules("Vendor@2026");
  assert.equal(strong.minMaxLength, true);
  assert.equal(strong.hasUppercase, true);
  assert.equal(strong.hasLowercase, true);
  assert.equal(strong.hasDigit, true);
  assert.equal(strong.hasSpecial, true);
});

test("validateVendorSignUpForm rejects invalid fields and passes valid submission", () => {
  const invalid = validateVendorSignUpForm(
    {
      name: "123",
      email: "rohan@apexlogistics.in",
      phone: "12345",
      password: "weak",
    },
    SEED_USERS
  );
  assert.ok(invalid.name);
  assert.equal(invalid.email, "This email is already registered");
  assert.ok(invalid.phone);
  assert.ok(invalid.password);

  const valid = validateVendorSignUpForm(
    {
      name: "Aarav Mehta",
      email: "aarav@mehtalogistics.in",
      phone: "9876543211",
      password: "Vendor@2026",
      confirmPassword: "Vendor@2026",
    },
    SEED_USERS
  );
  assert.deepEqual(valid, {});

  const mismatch = validateVendorSignUpForm(
    {
      email: "newvendor@test.in",
      password: "Vendor@2026",
      confirmPassword: "DifferentPassword@2026",
    },
    SEED_USERS
  );
  assert.equal(mismatch.confirmPassword, "Passwords do not match.");
});

test("isLastActiveAdminViolation blocks deactivating or demoting last active ADMIN", () => {
  assert.equal(
    isLastActiveAdminViolation("usr_admin_01", "ADMIN", "INACTIVE", SEED_USERS),
    true
  );
  assert.equal(
    isLastActiveAdminViolation("usr_admin_01", "SM", "ACTIVE", SEED_USERS),
    true
  );
  assert.equal(
    isLastActiveAdminViolation("usr_admin_01", "ADMIN", "ACTIVE", SEED_USERS),
    false
  );

  const withSecondAdmin = [
    ...SEED_USERS,
    {
      ...SEED_USERS[6],
      id: "usr_admin_02",
      email: "admin2@vendorflow.in",
    },
  ];
  assert.equal(
    isLastActiveAdminViolation(
      "usr_admin_01",
      "ADMIN",
      "INACTIVE",
      withSecondAdmin
    ),
    false
  );
});

test("validateBusinessTypeForm enforces unique name and uppercase code", () => {
  const dup = validateBusinessTypeForm(
    {
      name: "Private Limited",
      code: "PVT_LTD",
      description: "Duplicate type check",
    },
    SEED_BUSINESS_TYPES
  );
  assert.ok(dup.name);
  assert.ok(dup.code);

  const valid = validateBusinessTypeForm(
    {
      name: "One Person Company",
      code: "OPC_LTD",
      description: "Single founder incorporated corporate entity",
    },
    SEED_BUSINESS_TYPES
  );
  assert.deepEqual(valid, {});

  const longDesc = validateBusinessTypeForm(
    {
      name: "New Corp 2",
      code: "NEW_CORP_2",
      description: "This description is definitely way longer than fifty characters allowed for business types",
    },
    SEED_BUSINESS_TYPES
  );
  assert.equal(
    longDesc.description,
    "Description must be between 5 and 50 characters."
  );
});
