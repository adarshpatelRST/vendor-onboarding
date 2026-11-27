import { BusinessType, User, UserRole, UserStatus } from "../types/models";

export interface PasswordRulesStatus {
  minMaxLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export const FULL_NAME_REGEX = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const INDIAN_MOBILE_REGEX = /^\d{10}$/;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=]).{8,30}$/;
export const BUSINESS_CODE_REGEX = /^[A-Z0-9_]{2,24}$/;

export function evaluatePasswordRules(password: string): PasswordRulesStatus {
  return {
    minMaxLength: password.length >= 8 && password.length <= 30,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[@$!%*?&#^()_+\-=]/.test(password),
  };
}

export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Full name is required.";
  if (trimmed.length < 2 || trimmed.length > 60) {
    return "Full name must be between 2 and 60 characters.";
  }
  if (!FULL_NAME_REGEX.test(trimmed)) {
    return "Full name may contain letters and single spaces only.";
  }
  return null;
}

export function validateEmail(
  email: string,
  existingUsers: User[],
  excludeUserId?: string
): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email address is required.";
  if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address.";
  const duplicate = existingUsers.some(
    (u) =>
      u.id !== excludeUserId &&
      u.email.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return "This email is already registered";
  return null;
}

export function validateIndianMobile(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return "Mobile number is required.";
  if (!INDIAN_MOBILE_REGEX.test(trimmed)) {
    return "Enter a valid 10-digit Indian mobile number.";
  }
  return null;
}

export function validatePassword(
  password: string,
  required = true
): string | null {
  if (!password) {
    return required ? "Password is required." : null;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return "Password must be 8–30 chars with uppercase, lowercase, digit, and special character.";
  }
  return null;
}

export function validateSignInForm(values: {
  email: string;
  password: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = values.email.trim();
  if (!email) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) {
    errors.password = "Password is required.";
  }
  return errors;
}

export function validateVendorSignUpForm(
  values: {
    name?: string;
    email: string;
    phone?: string;
    password: string;
    confirmPassword?: string;
  },
  existingUsers: User[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name !== undefined && values.name.trim() !== "") {
    const nameErr = validateFullName(values.name);
    if (nameErr) errors.name = nameErr;
  }

  const emailErr = validateEmail(values.email, existingUsers);
  if (emailErr) errors.email = emailErr;

  if (values.phone !== undefined && values.phone.trim() !== "") {
    const phoneErr = validateIndianMobile(values.phone);
    if (phoneErr) errors.phone = phoneErr;
  }

  const passwordErr = validatePassword(values.password, true);
  if (passwordErr) errors.password = passwordErr;

  if (values.confirmPassword !== undefined) {
    const trimmedConfirm = values.confirmPassword.trim();
    const trimmedPass = values.password.trim();
    if (!trimmedConfirm) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (trimmedConfirm !== trimmedPass) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  return errors;
}

export function isLastActiveAdminViolation(
  targetUserId: string | undefined,
  nextRole: UserRole,
  nextStatus: UserStatus,
  existingUsers: User[]
): boolean {
  if (!targetUserId) return false;
  const current = existingUsers.find((u) => u.id === targetUserId);
  if (!current) return false;

  const wasActiveAdmin = current.role === "ADMIN" && current.status === "ACTIVE";
  if (!wasActiveAdmin) return false;

  const activeAdminCount = existingUsers.filter(
    (u) => u.role === "ADMIN" && u.status === "ACTIVE"
  ).length;

  const willStillBeActiveAdmin =
    nextRole === "ADMIN" && nextStatus === "ACTIVE";

  return activeAdminCount <= 1 && !willStillBeActiveAdmin;
}

export function validateUserAdminForm(
  values: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    status: UserStatus;
  },
  existingUsers: User[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  const nameErr = validateFullName(values.name);
  if (nameErr) errors.name = nameErr;

  const emailErr = validateEmail(values.email, existingUsers, values.id);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validateIndianMobile(values.phone);
  if (phoneErr) errors.phone = phoneErr;

  const requirePassword = !values.id;
  const passwordErr = validatePassword(values.password, requirePassword);
  if (passwordErr) errors.password = passwordErr;

  if (
    isLastActiveAdminViolation(
      values.id,
      values.role,
      values.status,
      existingUsers
    )
  ) {
    errors.adminProtection =
      "Cannot deactivate or change role of the last active Administrator.";
  }

  return errors;
}

export function validateBusinessTypeForm(
  values: {
    id?: string;
    name: string;
    code: string;
    description: string;
  },
  existingTypes: BusinessType[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmedName = values.name.trim();
  const trimmedCode = values.code.trim().toUpperCase();
  const trimmedDesc = values.description.trim();

  if (!trimmedName) {
    errors.name = "Business type name is required.";
  } else if (trimmedName.length < 2 || trimmedName.length > 50) {
    errors.name = "Name must be between 2 and 50 characters.";
  } else if (
    existingTypes.some(
      (bt) =>
        bt.id !== values.id &&
        bt.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    errors.name = "A business type with this name already exists.";
  }

  if (!trimmedCode) {
    errors.code = "Business type code is required.";
  } else if (!BUSINESS_CODE_REGEX.test(trimmedCode)) {
    errors.code =
      "Code must be 2–24 uppercase letters, numbers, or underscores.";
  } else if (
    existingTypes.some(
      (bt) =>
        bt.id !== values.id &&
        bt.code.trim().toUpperCase() === trimmedCode
    )
  ) {
    errors.code = "A business type with this code already exists.";
  }

  if (!trimmedDesc) {
    errors.description = "Description is required.";
  } else if (trimmedDesc.length < 5 || trimmedDesc.length > 50) {
    errors.description = "Description must be between 5 and 50 characters.";
  }

  return errors;
}
