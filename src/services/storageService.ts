import {
  SEED_AUDIT_LOGS,
  SEED_BUSINESS_TYPES,
  SEED_INVOICES,
  SEED_ORDERS,
  SEED_REQUESTS,
  SEED_USERS,
} from "../data/seedData";
import {
  ActorContext,
  AuditLog,
  AuditTableName,
  BusinessType,
  InvoiceAttachment,
  InvoiceRequest,
  InvoiceStatus,
  OnboardingRequest,
  OrderLineItem,
  OrderRequest,
  OrderStatus,
  PaymentTerms,
  User,
  UserRole,
  UserStatus,
} from "../types/models";
import { dataUrlToBlob, registerDocumentBlob } from "../utils/fileBlobStore";
import {
  computeInvoiceTotals,
  computeLineItemsTotals,
} from "../utils/orderInvoiceValidators";
import { getVendorOnboardingLockState } from "../utils/requestValidators";

export const STORAGE_KEYS = {
  USERS: "vf_users",
  BUSINESS_TYPES: "vf_business_types",
  REQUESTS: "vf_requests",
  ORDERS: "vf_orders",
  INVOICES: "vf_invoices",
  AUDIT_LOGS: "vf_audit_logs",
  SESSION_USER_ID: "vf_session_user_id",
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function generateUuid(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sanitizeUserSnapshot(user: User): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    mappedBusinessTypes: [...user.mappedBusinessTypes],
    createdAt: user.createdAt,
  };
}

export class StorageService {
  private storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? getDefaultStorage();
  }

  private readJson<T>(key: string, fallback: T): T {
    const raw = this.storage.getItem(key);
    if (!raw) return clone(fallback);
    try {
      return JSON.parse(raw) as T;
    } catch {
      return clone(fallback);
    }
  }

  private writeJson<T>(key: string, data: T): void {
    try {
      this.storage.setItem(key, JSON.stringify(data));
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.message.includes("quota"))
      ) {
        console.warn(`[StorageService] Storage quota exceeded on ${key}. Running emergency cleanup...`);
        if (key === STORAGE_KEYS.REQUESTS && Array.isArray(data)) {
          const stripped = (data as unknown[]).map((req: unknown) => {
            const r = req as { documents?: Array<{ fileData?: string }> };
            if (Array.isArray(r.documents)) {
              return {
                ...r,
                documents: r.documents.map(({ fileData: _unused, ...docRest }) => docRest),
              };
            }
            return r;
          });
          try {
            this.storage.setItem(key, JSON.stringify(stripped));
            return;
          } catch {
            // Trim old audit logs if quota is still exhausted
            try {
              this.storage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
              this.storage.setItem(key, JSON.stringify(stripped));
              return;
            } catch {
              // fallback
            }
          }
        }
      }
      throw err;
    }
  }

  private pruneBloatedRequests(): void {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.REQUESTS);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let changed = false;
        const cleaned = parsed.map((req) => {
          if (Array.isArray(req.documents)) {
            const docs = req.documents.map((doc: Record<string, unknown>) => {
              if (doc && typeof doc.fileData === "string") {
                changed = true;
                const { fileData: _unused, ...docRest } = doc;
                return docRest;
              }
              return doc;
            });
            return { ...req, documents: docs };
          }
          return req;
        });
        if (changed) {
          this.storage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(cleaned));
        }
      }
    } catch {
      // ignore
    }
  }

  initSeedIfNeeded(): void {
    this.pruneBloatedRequests();
    if (!this.storage.getItem(STORAGE_KEYS.USERS)) {
      this.writeJson(STORAGE_KEYS.USERS, clone(SEED_USERS));
    }
    if (!this.storage.getItem(STORAGE_KEYS.BUSINESS_TYPES)) {
      this.writeJson(STORAGE_KEYS.BUSINESS_TYPES, clone(SEED_BUSINESS_TYPES));
    }
    if (!this.storage.getItem(STORAGE_KEYS.REQUESTS)) {
      this.writeJson(STORAGE_KEYS.REQUESTS, clone(SEED_REQUESTS));
    }
    if (!this.storage.getItem(STORAGE_KEYS.ORDERS)) {
      this.writeJson(STORAGE_KEYS.ORDERS, clone(SEED_ORDERS));
    }
    if (!this.storage.getItem(STORAGE_KEYS.INVOICES)) {
      this.writeJson(STORAGE_KEYS.INVOICES, clone(SEED_INVOICES));
    }
    if (!this.storage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      this.writeJson(STORAGE_KEYS.AUDIT_LOGS, clone(SEED_AUDIT_LOGS));
    }
  }

  resetDemoData(): void {
    this.writeJson(STORAGE_KEYS.USERS, clone(SEED_USERS));
    this.writeJson(STORAGE_KEYS.BUSINESS_TYPES, clone(SEED_BUSINESS_TYPES));
    this.writeJson(STORAGE_KEYS.REQUESTS, clone(SEED_REQUESTS));
    this.writeJson(STORAGE_KEYS.ORDERS, clone(SEED_ORDERS));
    this.writeJson(STORAGE_KEYS.INVOICES, clone(SEED_INVOICES));
    this.writeJson(STORAGE_KEYS.AUDIT_LOGS, clone(SEED_AUDIT_LOGS));
    this.storage.removeItem(STORAGE_KEYS.SESSION_USER_ID);
  }

  // --- Audit Log Writer ---
  appendAuditLog(params: {
    tableName: AuditTableName;
    recordId: string;
    action: string;
    actor: ActorContext;
    oldData: Record<string, unknown> | null;
    newData: Record<string, unknown> | null;
  }): AuditLog {
    this.initSeedIfNeeded();
    const logs = this.getAuditLogs();
    const entry: AuditLog = {
      id: generateUuid(),
      tableName: params.tableName,
      recordId: params.recordId,
      action: params.action,
      performedByName: params.actor.name,
      performedByRole: params.actor.role,
      performedAt: new Date().toISOString(),
      oldData: params.oldData ? clone(params.oldData) : null,
      newData: params.newData ? clone(params.newData) : null,
    };
    const next = [entry, ...logs];
    this.writeJson(STORAGE_KEYS.AUDIT_LOGS, next);
    return entry;
  }

  // --- Readers ---
  getUsers(): User[] {
    this.initSeedIfNeeded();
    return this.readJson<User[]>(STORAGE_KEYS.USERS, SEED_USERS);
  }

  getBusinessTypes(): BusinessType[] {
    this.initSeedIfNeeded();
    return this.readJson<BusinessType[]>(
      STORAGE_KEYS.BUSINESS_TYPES,
      SEED_BUSINESS_TYPES
    );
  }

  getRequests(): OnboardingRequest[] {
    this.initSeedIfNeeded();
    return this.readJson<OnboardingRequest[]>(
      STORAGE_KEYS.REQUESTS,
      SEED_REQUESTS
    );
  }

  getOrders(): OrderRequest[] {
    this.initSeedIfNeeded();
    return this.readJson<OrderRequest[]>(STORAGE_KEYS.ORDERS, SEED_ORDERS);
  }

  getInvoices(): InvoiceRequest[] {
    this.initSeedIfNeeded();
    return this.readJson<InvoiceRequest[]>(
      STORAGE_KEYS.INVOICES,
      SEED_INVOICES
    );
  }

  getAuditLogs(): AuditLog[] {
    this.initSeedIfNeeded();
    return this.readJson<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS);
  }

  // --- Session & Auth ---
  getSessionUser(): User | null {
    this.initSeedIfNeeded();
    const userId = this.storage.getItem(STORAGE_KEYS.SESSION_USER_ID);
    if (!userId) return null;
    const user = this.getUsers().find((u) => u.id === userId);
    if (!user || user.status === "INACTIVE") {
      this.storage.removeItem(STORAGE_KEYS.SESSION_USER_ID);
      return null;
    }
    return user;
  }

  setSessionUser(userId: string): void {
    this.storage.setItem(STORAGE_KEYS.SESSION_USER_ID, userId);
  }

  logout(): void {
    this.storage.removeItem(STORAGE_KEYS.SESSION_USER_ID);
  }

  authenticate(
    email: string,
    password: string
  ): { ok: true; user: User } | { ok: false; error: string } {
    this.initSeedIfNeeded();
    const normalized = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const user = this.getUsers().find(
      (u) => u.email.trim().toLowerCase() === normalized
    );
    if (!user || user.password.trim() !== cleanPassword) {
      return { ok: false, error: "Invalid email or password." };
    }
    if (user.status === "INACTIVE") {
      return {
        ok: false,
        error: "Your account has been deactivated by the Administrator.",
      };
    }
    this.setSessionUser(user.id);
    return { ok: true, user };
  }

  quickLoginById(
    userId: string
  ): { ok: true; user: User } | { ok: false; error: string } {
    this.initSeedIfNeeded();
    const user = this.getUsers().find((u) => u.id === userId);
    if (!user) {
      return { ok: false, error: "User persona not found." };
    }
    if (user.status === "INACTIVE") {
      return {
        ok: false,
        error: "Your account has been deactivated by the Administrator.",
      };
    }
    this.setSessionUser(user.id);
    return { ok: true, user };
  }

  registerVendor(input: {
    name?: string;
    email: string;
    phone?: string;
    password: string;
  }): User {
    this.initSeedIfNeeded();
    const users = this.getUsers();
    const derivedName =
      input.name && input.name.trim()
        ? input.name.trim()
        : input.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const newUser: User = {
      id: `usr_vendor_${Date.now()}`,
      name: derivedName || "Vendor",
      email: input.email.trim().toLowerCase(),
      password: input.password,
      phone: input.phone && input.phone.trim() ? input.phone.trim() : "9800000000",
      role: "VENDOR",
      status: "ACTIVE",
      mappedBusinessTypes: [],
      createdAt: new Date().toISOString(),
    };
    this.writeJson(STORAGE_KEYS.USERS, [...users, newUser]);
    this.appendAuditLog({
      tableName: "User",
      recordId: newUser.id,
      action: "VENDOR_SIGNUP",
      actor: { id: newUser.id, name: newUser.name, role: "VENDOR" },
      oldData: null,
      newData: sanitizeUserSnapshot(newUser),
    });
    this.setSessionUser(newUser.id);
    return newUser;
  }

  // --- Admin User CRUD ---
  createUser(
    input: {
      name: string;
      email: string;
      phone: string;
      password: string;
      role: UserRole;
      status: UserStatus;
      mappedBusinessTypes?: string[];
    },
    actor: ActorContext
  ): User {
    const users = this.getUsers();
    const newUser: User = {
      id: `usr_${input.role.toLowerCase()}_${Date.now()}`,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      phone: input.phone.trim(),
      role: input.role,
      status: input.status,
      mappedBusinessTypes:
        input.role === "AM" || input.role === "SM"
          ? [...(input.mappedBusinessTypes ?? [])]
          : [],
      createdAt: new Date().toISOString(),
    };
    this.writeJson(STORAGE_KEYS.USERS, [...users, newUser]);
    this.appendAuditLog({
      tableName: "User",
      recordId: newUser.id,
      action: "USER_CREATED",
      actor,
      oldData: null,
      newData: sanitizeUserSnapshot(newUser),
    });
    return newUser;
  }

  updateUser(
    userId: string,
    updates: {
      name: string;
      email: string;
      phone: string;
      password?: string;
      role: UserRole;
      status: UserStatus;
    },
    actor: ActorContext
  ): User {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error("User not found.");
    const existing = users[index];
    const updated: User = {
      ...existing,
      name: updates.name.trim(),
      email: updates.email.trim().toLowerCase(),
      phone: updates.phone.trim(),
      password: updates.password ? updates.password : existing.password,
      role: updates.role,
      status: updates.status,
      mappedBusinessTypes:
        updates.role === "AM" || updates.role === "SM"
          ? existing.mappedBusinessTypes
          : [],
    };
    const nextUsers = [...users];
    nextUsers[index] = updated;
    this.writeJson(STORAGE_KEYS.USERS, nextUsers);
    this.appendAuditLog({
      tableName: "User",
      recordId: updated.id,
      action:
        existing.status !== updated.status
          ? updated.status === "ACTIVE"
            ? "USER_ACTIVATED"
            : "USER_DEACTIVATED"
          : "USER_UPDATED",
      actor,
      oldData: sanitizeUserSnapshot(existing),
      newData: sanitizeUserSnapshot(updated),
    });
    return updated;
  }

  toggleUserStatus(userId: string, actor: ActorContext): User {
    const users = this.getUsers();
    const existing = users.find((u) => u.id === userId);
    if (!existing) throw new Error("User not found.");
    const nextStatus: UserStatus =
      existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    return this.updateUser(
      userId,
      {
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        role: existing.role,
        status: nextStatus,
      },
      actor
    );
  }

  // --- UserBusinessMapping ---
  updateUserBusinessMapping(
    userId: string,
    mappedBusinessTypes: string[],
    actor: ActorContext
  ): User {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error("User not found.");
    const existing = users[index];
    const oldMapping = [...existing.mappedBusinessTypes];
    const nextMapping = [...mappedBusinessTypes];
    const updated: User = {
      ...existing,
      mappedBusinessTypes: nextMapping,
    };
    const nextUsers = [...users];
    nextUsers[index] = updated;
    this.writeJson(STORAGE_KEYS.USERS, nextUsers);
    this.appendAuditLog({
      tableName: "UserBusinessMapping",
      recordId: updated.id,
      action: "MAPPING_UPDATED",
      actor,
      oldData: {
        userId: existing.id,
        userName: existing.name,
        role: existing.role,
        mappedBusinessTypes: oldMapping,
      },
      newData: {
        userId: updated.id,
        userName: updated.name,
        role: updated.role,
        mappedBusinessTypes: nextMapping,
      },
    });
    return updated;
  }

  // --- Business Types CRUD ---
  createBusinessType(
    input: {
      name: string;
      code: string;
      description: string;
      isActive: boolean;
    },
    actor: ActorContext
  ): BusinessType {
    const list = this.getBusinessTypes();
    const created: BusinessType = {
      id: `bt_${Date.now()}`,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description.trim(),
      isActive: input.isActive,
      createdAt: new Date().toISOString(),
    };
    this.writeJson(STORAGE_KEYS.BUSINESS_TYPES, [...list, created]);
    this.appendAuditLog({
      tableName: "BusinessType",
      recordId: created.id,
      action: "BUSINESS_TYPE_CREATED",
      actor,
      oldData: null,
      newData: { ...created },
    });
    return created;
  }

  updateBusinessType(
    id: string,
    input: {
      name: string;
      code: string;
      description: string;
      isActive: boolean;
    },
    actor: ActorContext
  ): BusinessType {
    const list = this.getBusinessTypes();
    const index = list.findIndex((bt) => bt.id === id);
    if (index === -1) throw new Error("Business type not found.");
    const existing = list[index];
    const updated: BusinessType = {
      ...existing,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description.trim(),
      isActive: input.isActive,
    };
    const next = [...list];
    next[index] = updated;
    this.writeJson(STORAGE_KEYS.BUSINESS_TYPES, next);

    // If renamed, propagate rename to mappedBusinessTypes on AM/SM users
    if (existing.name !== updated.name) {
      const users = this.getUsers().map((u) => ({
        ...u,
        mappedBusinessTypes: u.mappedBusinessTypes.map((btName) =>
          btName === existing.name ? updated.name : btName
        ),
      }));
      this.writeJson(STORAGE_KEYS.USERS, users);
    }

    this.appendAuditLog({
      tableName: "BusinessType",
      recordId: updated.id,
      action:
        existing.isActive !== updated.isActive
          ? updated.isActive
            ? "BUSINESS_TYPE_ACTIVATED"
            : "BUSINESS_TYPE_DEACTIVATED"
          : "BUSINESS_TYPE_UPDATED",
      actor,
      oldData: { ...existing },
      newData: { ...updated },
    });
    return updated;
  }

  toggleBusinessTypeActive(id: string, actor: ActorContext): BusinessType {
    const existing = this.getBusinessTypes().find((bt) => bt.id === id);
    if (!existing) throw new Error("Business type not found.");
    return this.updateBusinessType(
      id,
      {
        name: existing.name,
        code: existing.code,
        description: existing.description,
        isActive: !existing.isActive,
      },
      actor
    );
  }

  // --- Admin Modification Permission for Approved Vendors ---
  setVendorModificationAccess(
    vendorUserId: string,
    enabled: boolean,
    reason: string,
    actor: ActorContext
  ): User {
    this.initSeedIfNeeded();
    if (actor.role !== "ADMIN") {
      throw new Error(
        "Only System Admin can enable or revoke onboarding modification requests."
      );
    }
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === vendorUserId);
    if (index === -1) throw new Error("Vendor user not found.");
    const existing = users[index];
    if (existing.role !== "VENDOR") {
      throw new Error("Modification access can only be configured for Vendor users.");
    }
    if (enabled) {
      const hasApproved = this.getRequests().some(
        (r) => r.vendorUserId === vendorUserId && r.status === "APPROVED"
      );
      if (!hasApproved) {
        throw new Error(
          "Vendor must have an APPROVED onboarding request before enabling modification."
        );
      }
    }

    const updated: User = {
      ...existing,
      allowModificationOnboarding: enabled,
    };
    const nextUsers = [...users];
    nextUsers[index] = updated;
    this.writeJson(STORAGE_KEYS.USERS, nextUsers);
    this.appendAuditLog({
      tableName: "User",
      recordId: updated.id,
      action: enabled
        ? "MODIFICATION_REQUEST_ENABLED"
        : "MODIFICATION_REQUEST_REVOKED",
      actor,
      oldData: {
        allowModificationOnboarding: Boolean(existing.allowModificationOnboarding),
      },
      newData: {
        allowModificationOnboarding: enabled,
        reason: reason.trim() || (enabled ? "Modification requested for approved onboarding" : "Revoked by Admin"),
      },
    });
    return updated;
  }

  private consumeVendorModificationAccess(vendorUserId: string): void {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === vendorUserId);
    if (idx === -1) return;
    if (!users[idx].allowModificationOnboarding) return;
    const nextUsers = [...users];
    nextUsers[idx] = { ...users[idx], allowModificationOnboarding: false };
    this.writeJson(STORAGE_KEYS.USERS, nextUsers);
  }

  // --- Vendor Onboarding Requests & Workflow Transitions ---
  private generateNextRequestId(requests: OnboardingRequest[]): string {
    const nums = requests
      .map((r) => {
        const match = r.id.match(/REQ-\d{4}-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !Number.isNaN(n));
    const maxNum = nums.length > 0 ? Math.max(...nums) : 100;
    return `REQ-2026-${maxNum + 1}`;
  }

  saveDraftRequest(
    payload: {
      businessInfo: OnboardingRequest["businessInfo"];
      contactInfo: OnboardingRequest["contactInfo"];
      bankInfo: OnboardingRequest["bankInfo"];
      documents: OnboardingRequest["documents"];
    },
    actor: ActorContext,
    existingRequestId?: string
  ): OnboardingRequest {
    this.initSeedIfNeeded();
    const requests = this.getRequests();
    const actorUser = this.getUsers().find((u) => u.id === actor.id) ?? null;
    const lockState = getVendorOnboardingLockState(actor.id, requests, actorUser);

    const now = new Date().toISOString();
    const cleanedDocs = payload.documents
      .filter((d) => d.docNumber.trim() || d.fileName.trim())
      .map((d) => {
        if (d.fileData) {
          try {
            const b = dataUrlToBlob(d.fileData);
            registerDocumentBlob(d.docType, b);
            if (d.fileName) {
              registerDocumentBlob(d.fileName, b);
              registerDocumentBlob(`${d.docType}_${d.fileName}`, b);
            }
          } catch {
            // ignore non-base64 or test environment limitations
          }
        }
        const { fileData: _unused, ...docRest } = d;
        return {
          ...docRest,
          docNumber: d.docNumber.trim().toUpperCase(),
        };
      });

    const normalizedBusiness = {
      ...payload.businessInfo,
      legalBusinessName: payload.businessInfo.legalBusinessName.trim(),
      tradeName: payload.businessInfo.tradeName.trim(),
      gstin: payload.businessInfo.gstin.trim().toUpperCase(),
      pan: payload.businessInfo.pan.trim().toUpperCase(),
      msmeNumber: payload.businessInfo.msmeNumber.trim().toUpperCase(),
    };
    const normalizedBank = {
      ...payload.bankInfo,
      accountHolderName: payload.bankInfo.accountHolderName.trim(),
      bankName: payload.bankInfo.bankName.trim(),
      accountNumber: payload.bankInfo.accountNumber.trim(),
      ifscCode: payload.bankInfo.ifscCode.trim().toUpperCase(),
    };

    // Enforce single draft / active request per vendor
    const targetRequestId =
      existingRequestId ||
      requests.find((r) => r.vendorUserId === actor.id && r.status === "DRAFT")?.id;

    if (targetRequestId) {
      const idx = requests.findIndex((r) => r.id === targetRequestId);
      if (idx === -1) throw new Error("Request not found.");
      const existing = requests[idx];
      if (existing.vendorUserId !== actor.id) {
        throw new Error("Unauthorized onboarding request modification.");
      }
      if (
        lockState.isOnboarded &&
        !existing.isModificationRequest &&
        !lockState.modificationEnabledByAdmin
      ) {
        throw new Error(
          `Vendor is already onboarded (${lockState.approvedRequest?.id}). Only Admin can enable a new onboarding request for modifications.`
        );
      }
      const updated: OnboardingRequest = {
        ...existing,
        status: "DRAFT",
        businessInfo: normalizedBusiness,
        contactInfo: { ...payload.contactInfo },
        bankInfo: normalizedBank,
        documents: cleanedDocs,
        updatedAt: now,
      };
      const next = [...requests];
      next[idx] = updated;
      this.writeJson(STORAGE_KEYS.REQUESTS, next);
      this.appendAuditLog({
        tableName: "Request",
        recordId: updated.id,
        action: "DRAFT_UPDATED",
        actor,
        oldData: clone(existing) as unknown as Record<string, unknown>,
        newData: clone(updated) as unknown as Record<string, unknown>,
      });
      return updated;
    }

    if (lockState.isOnboarded) {
      if (!lockState.modificationEnabledByAdmin) {
        throw new Error(
          `Vendor is already onboarded (${lockState.approvedRequest?.id}). Only Admin can enable a new onboarding request for modifications.`
        );
      }
      if (lockState.activeModificationRequest) {
        throw new Error(
          `You already have a modification request (${lockState.activeModificationRequest.id}) in progress.`
        );
      }
    } else if (lockState.activeRequest) {
      throw new Error(
        `You already have an active onboarding request (${lockState.activeRequest.id}). A vendor can only be onboarded once.`
      );
    }

    const isModification = lockState.isOnboarded && lockState.modificationEnabledByAdmin;
    const created: OnboardingRequest = {
      id: this.generateNextRequestId(requests),
      vendorUserId: actor.id,
      status: "DRAFT",
      isModificationRequest: isModification,
      replacesRequestId: isModification ? lockState.approvedRequest?.id ?? null : null,
      assignedAmId: null,
      assignedSmId: null,
      businessInfo: normalizedBusiness,
      contactInfo: { ...payload.contactInfo },
      bankInfo: normalizedBank,
      documents: cleanedDocs,
      remarkHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.REQUESTS, [created, ...requests]);
    this.appendAuditLog({
      tableName: "Request",
      recordId: created.id,
      action: isModification ? "MODIFICATION_DRAFT_SAVED" : "DRAFT_SAVED",
      actor,
      oldData: null,
      newData: clone(created) as unknown as Record<string, unknown>,
    });
    return created;
  }

  submitVendorRequest(
    payload: {
      businessInfo: OnboardingRequest["businessInfo"];
      contactInfo: OnboardingRequest["contactInfo"];
      bankInfo: OnboardingRequest["bankInfo"];
      documents: OnboardingRequest["documents"];
    },
    actor: ActorContext,
    existingRequestId?: string
  ): OnboardingRequest {
    this.initSeedIfNeeded();
    const requests = this.getRequests();
    const actorUser = this.getUsers().find((u) => u.id === actor.id) ?? null;
    const lockState = getVendorOnboardingLockState(actor.id, requests, actorUser);

    if (!existingRequestId) {
      if (lockState.isOnboarded) {
        if (!lockState.modificationEnabledByAdmin) {
          throw new Error(
            `Vendor is already onboarded (${lockState.approvedRequest?.id}). Only Admin can enable a new onboarding request for modifications.`
          );
        }
        if (lockState.activeModificationRequest) {
          throw new Error(
            `You already have a modification request (${lockState.activeModificationRequest.id}) in progress.`
          );
        }
      } else if (lockState.activeRequest) {
        throw new Error(
          `You already have an active onboarding request (${lockState.activeRequest.id}). A vendor can only be onboarded once.`
        );
      }
    }
    const now = new Date().toISOString();
    const cleanedDocs = payload.documents
      .filter((d) => d.docNumber.trim() || d.fileName.trim())
      .map((d) => {
        if (d.fileData) {
          try {
            const b = dataUrlToBlob(d.fileData);
            registerDocumentBlob(d.docType, b);
            if (d.fileName) {
              registerDocumentBlob(d.fileName, b);
              registerDocumentBlob(`${d.docType}_${d.fileName}`, b);
            }
          } catch {
            // ignore non-base64 or test environment limitations
          }
        }
        const { fileData: _unused, ...docRest } = d;
        return {
          ...docRest,
          docNumber: d.docNumber.trim().toUpperCase(),
        };
      });

    const normalizedBusiness = {
      ...payload.businessInfo,
      legalBusinessName: payload.businessInfo.legalBusinessName.trim(),
      tradeName: payload.businessInfo.tradeName.trim(),
      gstin: payload.businessInfo.gstin.trim().toUpperCase(),
      pan: payload.businessInfo.pan.trim().toUpperCase(),
      msmeNumber: payload.businessInfo.msmeNumber.trim().toUpperCase(),
    };
    const normalizedBank = {
      ...payload.bankInfo,
      accountHolderName: payload.bankInfo.accountHolderName.trim(),
      bankName: payload.bankInfo.bankName.trim(),
      accountNumber: payload.bankInfo.accountNumber.trim(),
      ifscCode: payload.bankInfo.ifscCode.trim().toUpperCase(),
    };

    if (existingRequestId) {
      const idx = requests.findIndex((r) => r.id === existingRequestId);
      if (idx === -1) throw new Error("Request not found.");
      const existing = requests[idx];
      if (existing.vendorUserId !== actor.id) {
        throw new Error("Unauthorized onboarding request submission.");
      }
      const isMod = Boolean(existing.isModificationRequest);
      if (
        lockState.isOnboarded &&
        !isMod &&
        !lockState.modificationEnabledByAdmin
      ) {
        throw new Error(
          `Vendor is already onboarded (${lockState.approvedRequest?.id}). Only Admin can enable a new onboarding request for modifications.`
        );
      }
      const effectiveMod = isMod || (lockState.isOnboarded && lockState.modificationEnabledByAdmin);
      const wasChangesRequested = existing.status === "CHANGES_REQUESTED";
      const actionLabel = wasChangesRequested ? "RESUBMITTED" : "SUBMITTED";
      const remarkEntry = {
        id: `rem_${Date.now()}`,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: actionLabel,
        message: wasChangesRequested
          ? "Vendor addressed AM feedback and resubmitted onboarding dossier."
          : effectiveMod
            ? `Submitted modification onboarding request for approved dossier ${existing.replacesRequestId ?? lockState.approvedRequest?.id ?? ""}.`
            : "Submitted onboarding dossier for AM compliance review.",
        timestamp: now,
      };
      const updated: OnboardingRequest = {
        ...existing,
        status: "PENDING_AM_REVIEW",
        isModificationRequest: effectiveMod || undefined,
        replacesRequestId: effectiveMod
          ? existing.replacesRequestId ?? lockState.approvedRequest?.id ?? null
          : existing.replacesRequestId,
        businessInfo: normalizedBusiness,
        contactInfo: { ...payload.contactInfo },
        bankInfo: normalizedBank,
        documents: cleanedDocs,
        remarkHistory: [...existing.remarkHistory, remarkEntry],
        updatedAt: now,
      };
      const next = [...requests];
      next[idx] = updated;
      this.writeJson(STORAGE_KEYS.REQUESTS, next);
      if (effectiveMod) {
        this.consumeVendorModificationAccess(actor.id);
      }
      this.appendAuditLog({
        tableName: "Request",
        recordId: updated.id,
        action: actionLabel,
        actor,
        oldData: {
          status: existing.status,
          businessInfo: existing.businessInfo,
          bankInfo: existing.bankInfo,
          documentsCount: existing.documents.length,
        },
        newData: {
          status: updated.status,
          isModificationRequest: updated.isModificationRequest,
          businessInfo: updated.businessInfo,
          bankInfo: updated.bankInfo,
          documentsCount: updated.documents.length,
        },
      });
      return updated;
    }

    const isModification = lockState.isOnboarded && lockState.modificationEnabledByAdmin;
    const newId = this.generateNextRequestId(requests);
    const created: OnboardingRequest = {
      id: newId,
      vendorUserId: actor.id,
      status: "PENDING_AM_REVIEW",
      isModificationRequest: isModification || undefined,
      replacesRequestId: isModification ? lockState.approvedRequest?.id ?? null : null,
      assignedAmId: null,
      assignedSmId: null,
      businessInfo: normalizedBusiness,
      contactInfo: { ...payload.contactInfo },
      bankInfo: normalizedBank,
      documents: cleanedDocs,
      remarkHistory: [
        {
          id: `rem_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: "SUBMITTED",
          message: isModification
            ? `Submitted modification onboarding request for approved dossier ${lockState.approvedRequest?.id ?? ""}.`
            : "Submitted onboarding dossier for AM compliance review.",
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.REQUESTS, [created, ...requests]);
    if (isModification) {
      this.consumeVendorModificationAccess(actor.id);
    }
    this.appendAuditLog({
      tableName: "Request",
      recordId: created.id,
      action: isModification ? "MODIFICATION_SUBMITTED" : "SUBMITTED",
      actor,
      oldData: null,
      newData: {
        status: created.status,
        isModificationRequest: created.isModificationRequest,
        replacesRequestId: created.replacesRequestId,
        legalBusinessName: created.businessInfo.legalBusinessName,
        businessType: created.businessInfo.businessType,
        gstin: created.businessInfo.gstin,
      },
    });
    return created;
  }

  transitionRequestByAM(
    requestId: string,
    decision: "REVERT" | "FORWARD" | "APPROVE" | "REJECT" | "QUERY",
    remark: string,
    actor: ActorContext
  ): OnboardingRequest {
    this.initSeedIfNeeded();
    const requests = this.getRequests();
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error("Request not found.");
    const existing = requests[idx];
    const now = new Date().toISOString();

    const wasQuery = existing.status === "QUERY_TO_AM";
    let nextStatus: OnboardingRequest["status"];
    let actionLabel: string;
    let defaultMsg = "";

    if (decision === "APPROVE" || decision === "FORWARD") {
      nextStatus = "PENDING_SM_APPROVAL";
      actionLabel = wasQuery ? "AM_REPLIED" : "AM_VERIFIED";
      defaultMsg = "KYC, tax, and bank verification completed. Escalated to SM.";
    } else if (decision === "REJECT") {
      nextStatus = "REJECTED";
      actionLabel = "REJECTED";
      defaultMsg = "Rejected by Account Manager.";
    } else {
      nextStatus = "CHANGES_REQUESTED";
      actionLabel = "CHANGES_REQUESTED";
      defaultMsg = "Clarification query raised by Account Manager.";
    }

    const finalMessage = remark.trim() || defaultMsg;

    const updated: OnboardingRequest = {
      ...existing,
      status: nextStatus,
      assignedAmId: actor.id,
      remarkHistory: [
        ...existing.remarkHistory,
        {
          id: `rem_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: actionLabel,
          message: finalMessage,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    const next = [...requests];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.REQUESTS, next);
    this.appendAuditLog({
      tableName: "Request",
      recordId: updated.id,
      action: actionLabel,
      actor,
      oldData: {
        status: existing.status,
        assignedAmId: existing.assignedAmId,
      },
      newData: {
        status: updated.status,
        assignedAmId: updated.assignedAmId,
        remark: finalMessage,
      },
    });
    return updated;
  }

  transitionRequestBySM(
    requestId: string,
    decision: "QUERY" | "REJECT" | "APPROVE",
    remark: string,
    actor: ActorContext
  ): OnboardingRequest {
    this.initSeedIfNeeded();
    const requests = this.getRequests();
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error("Request not found.");
    const existing = requests[idx];
    const existingApproved =
      decision === "APPROVE"
        ? requests.find(
          (r) =>
            r.id !== existing.id &&
            r.vendorUserId === existing.vendorUserId &&
            r.status === "APPROVED"
        ) ?? null
        : null;

    if (
      decision === "APPROVE" &&
      existingApproved &&
      !existing.isModificationRequest
    ) {
      throw new Error(
        `This vendor is already onboarded (${existingApproved.id}). Only Admin-enabled modification requests can update an approved onboarding.`
      );
    }
    const now = new Date().toISOString();

    const nextStatus =
      decision === "QUERY"
        ? "QUERY_TO_AM"
        : decision === "REJECT"
          ? "REJECTED"
          : "APPROVED";
    const actionLabel =
      decision === "QUERY"
        ? "QUERY_TO_AM"
        : decision === "REJECT"
          ? "REJECTED"
          : "APPROVED";
    const finalMessage =
      remark.trim() ||
      (decision === "APPROVE"
        ? existingApproved
          ? `Approved modification request (superseding ${existingApproved.id}).`
          : "Approved for enterprise vendor master onboarding."
        : "");

    const updated: OnboardingRequest = {
      ...existing,
      status: nextStatus,
      assignedSmId: actor.id,
      remarkHistory: [
        ...existing.remarkHistory,
        {
          id: `rem_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: actionLabel,
          message: finalMessage,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    const next = [...requests];
    next[idx] = updated;

    if (decision === "APPROVE" && existingApproved && existing.isModificationRequest) {
      const oldIdx = next.findIndex((r) => r.id === existingApproved.id);
      if (oldIdx !== -1) {
        const superseded: OnboardingRequest = {
          ...existingApproved,
          status: "SUPERSEDED",
          remarkHistory: [
            ...existingApproved.remarkHistory,
            {
              id: `rem_sup_${Date.now()}`,
              actorId: actor.id,
              actorName: actor.name,
              actorRole: actor.role,
              action: "SUPERSEDED",
              message: `Superseded by approved modification request ${updated.id}.`,
              timestamp: now,
            },
          ],
          updatedAt: now,
        };
        next[oldIdx] = superseded;
        this.appendAuditLog({
          tableName: "Request",
          recordId: superseded.id,
          action: "SUPERSEDED",
          actor,
          oldData: { status: existingApproved.status },
          newData: { status: "SUPERSEDED", supersededBy: updated.id },
        });
      }
    }

    this.writeJson(STORAGE_KEYS.REQUESTS, next);
    this.appendAuditLog({
      tableName: "Request",
      recordId: updated.id,
      action: actionLabel,
      actor,
      oldData: {
        status: existing.status,
        assignedAmId: existing.assignedAmId,
        assignedSmId: existing.assignedSmId,
      },
      newData: {
        status: updated.status,
        assignedAmId: updated.assignedAmId,
        assignedSmId: updated.assignedSmId,
        remark: finalMessage,
      },
    });
    return updated;
  }

  // --- Post-Onboarding Orders & Invoices ---
  private requireApprovedOnboardingEntity(
    onboardingRequestId: string,
    vendorUserId: string
  ): OnboardingRequest {
    const req = this.getRequests().find((r) => r.id === onboardingRequestId);
    if (!req) {
      throw new Error("Referenced vendor onboarding request not found.");
    }
    if (req.vendorUserId !== vendorUserId) {
      throw new Error("You can only raise orders or invoices for your own onboarded entities.");
    }
    if (req.status !== "APPROVED") {
      throw new Error(
        "Vendor onboarding must be APPROVED before raising order or invoice requests."
      );
    }
    return req;
  }

  private generateNextPrefixedId(
    records: Array<{ id: string }>,
    prefix: "ORD" | "INV"
  ): string {
    const pattern = new RegExp(`${prefix}-\\d{4}-(\\d+)`);
    const nums = records
      .map((r) => {
        const match = r.id.match(pattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !Number.isNaN(n));
    const maxNum = nums.length > 0 ? Math.max(...nums) : 100;
    return `${prefix}-2026-${maxNum + 1}`;
  }

  private sanitizeLineItems(lineItems: OrderLineItem[]): OrderLineItem[] {
    return lineItems.map((item, idx) => ({
      id: item.id || `li_${Date.now()}_${idx}`,
      description: item.description.trim(),
      hsnSacCode: item.hsnSacCode.trim(),
      quantity: Number(item.quantity) || 0,
      unit: item.unit.trim() || "Units",
      unitPrice: Number(item.unitPrice) || 0,
      gstRate: item.gstRate,
    }));
  }

  saveDraftOrder(
    payload: {
      onboardingRequestId: string;
      title: string;
      category: string;
      expectedDeliveryDate: string;
      deliveryLocation: string;
      paymentTerms: PaymentTerms;
      notes: string;
      lineItems: OrderLineItem[];
    },
    actor: ActorContext,
    existingOrderId?: string
  ): OrderRequest {
    this.initSeedIfNeeded();
    const entity = this.requireApprovedOnboardingEntity(
      payload.onboardingRequestId,
      actor.id
    );
    const orders = this.getOrders();
    const now = new Date().toISOString();
    const cleanLines = this.sanitizeLineItems(payload.lineItems);
    const totals = computeLineItemsTotals(cleanLines);

    if (existingOrderId) {
      const idx = orders.findIndex((o) => o.id === existingOrderId);
      if (idx === -1) throw new Error("Order request not found.");
      const existing = orders[idx];
      if (existing.vendorUserId !== actor.id) {
        throw new Error("Unauthorized order modification.");
      }
      if (
        existing.status !== "DRAFT" &&
        existing.status !== "CHANGES_REQUESTED"
      ) {
        throw new Error("Only draft or reverted orders can be saved as draft.");
      }

      const updated: OrderRequest = {
        ...existing,
        onboardingRequestId: entity.id,
        vendorEntityName: entity.businessInfo.legalBusinessName,
        businessType: entity.businessInfo.businessType,
        gstin: entity.businessInfo.gstin,
        status: "DRAFT",
        title: payload.title.trim(),
        category: payload.category.trim(),
        expectedDeliveryDate: payload.expectedDeliveryDate,
        deliveryLocation: payload.deliveryLocation.trim(),
        paymentTerms: payload.paymentTerms,
        notes: payload.notes.trim(),
        lineItems: cleanLines,
        ...totals,
        updatedAt: now,
      };
      const next = [...orders];
      next[idx] = updated;
      this.writeJson(STORAGE_KEYS.ORDERS, next);
      this.appendAuditLog({
        tableName: "Order",
        recordId: updated.id,
        action: "ORDER_DRAFT_UPDATED",
        actor,
        oldData: { status: existing.status, totalAmount: existing.totalAmount, title: existing.title },
        newData: { status: updated.status, totalAmount: updated.totalAmount, title: updated.title },
      });
      return updated;
    }

    const created: OrderRequest = {
      id: this.generateNextPrefixedId(orders, "ORD"),
      vendorUserId: actor.id,
      onboardingRequestId: entity.id,
      vendorEntityName: entity.businessInfo.legalBusinessName,
      businessType: entity.businessInfo.businessType,
      gstin: entity.businessInfo.gstin,
      status: "DRAFT",
      title: payload.title.trim(),
      category: payload.category.trim(),
      expectedDeliveryDate: payload.expectedDeliveryDate,
      deliveryLocation: payload.deliveryLocation.trim(),
      paymentTerms: payload.paymentTerms,
      notes: payload.notes.trim(),
      lineItems: cleanLines,
      ...totals,
      assignedAmId: null,
      assignedSmId: null,
      remarkHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.ORDERS, [created, ...orders]);
    this.appendAuditLog({
      tableName: "Order",
      recordId: created.id,
      action: "ORDER_DRAFT_SAVED",
      actor,
      oldData: null,
      newData: {
        status: created.status,
        onboardingRequestId: created.onboardingRequestId,
        totalAmount: created.totalAmount,
        title: created.title,
      },
    });
    return created;
  }

  submitOrderRequest(
    payload: {
      onboardingRequestId: string;
      title: string;
      category: string;
      expectedDeliveryDate: string;
      deliveryLocation: string;
      paymentTerms: PaymentTerms;
      notes: string;
      lineItems: OrderLineItem[];
    },
    actor: ActorContext,
    existingOrderId?: string
  ): OrderRequest {
    this.initSeedIfNeeded();
    const entity = this.requireApprovedOnboardingEntity(
      payload.onboardingRequestId,
      actor.id
    );
    const orders = this.getOrders();
    const now = new Date().toISOString();
    const cleanLines = this.sanitizeLineItems(payload.lineItems);
    const totals = computeLineItemsTotals(cleanLines);

    if (existingOrderId) {
      const idx = orders.findIndex((o) => o.id === existingOrderId);
      if (idx === -1) throw new Error("Order request not found.");
      const existing = orders[idx];
      if (existing.vendorUserId !== actor.id) {
        throw new Error("Unauthorized order submission.");
      }
      if (
        existing.status !== "DRAFT" &&
        existing.status !== "CHANGES_REQUESTED"
      ) {
        throw new Error("Order has already been submitted.");
      }
      const wasChanges = existing.status === "CHANGES_REQUESTED";
      const actionLabel = wasChanges ? "RESUBMITTED" : "SUBMITTED";
      const updated: OrderRequest = {
        ...existing,
        onboardingRequestId: entity.id,
        vendorEntityName: entity.businessInfo.legalBusinessName,
        businessType: entity.businessInfo.businessType,
        gstin: entity.businessInfo.gstin,
        status: "PENDING_AM_REVIEW",
        title: payload.title.trim(),
        category: payload.category.trim(),
        expectedDeliveryDate: payload.expectedDeliveryDate,
        deliveryLocation: payload.deliveryLocation.trim(),
        paymentTerms: payload.paymentTerms,
        notes: payload.notes.trim(),
        lineItems: cleanLines,
        ...totals,
        remarkHistory: [
          ...existing.remarkHistory,
          {
            id: `rem_ord_${Date.now()}`,
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            action: actionLabel,
            message: wasChanges
              ? "Vendor updated order request and resubmitted for AM review."
              : `Submitted order request against onboarded entity ${entity.id}.`,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
      const next = [...orders];
      next[idx] = updated;
      this.writeJson(STORAGE_KEYS.ORDERS, next);
      this.appendAuditLog({
        tableName: "Order",
        recordId: updated.id,
        action: `ORDER_${actionLabel}`,
        actor,
        oldData: { status: existing.status, totalAmount: existing.totalAmount },
        newData: {
          status: updated.status,
          totalAmount: updated.totalAmount,
          title: updated.title,
        },
      });
      return updated;
    }

    const created: OrderRequest = {
      id: this.generateNextPrefixedId(orders, "ORD"),
      vendorUserId: actor.id,
      onboardingRequestId: entity.id,
      vendorEntityName: entity.businessInfo.legalBusinessName,
      businessType: entity.businessInfo.businessType,
      gstin: entity.businessInfo.gstin,
      status: "PENDING_AM_REVIEW",
      title: payload.title.trim(),
      category: payload.category.trim(),
      expectedDeliveryDate: payload.expectedDeliveryDate,
      deliveryLocation: payload.deliveryLocation.trim(),
      paymentTerms: payload.paymentTerms,
      notes: payload.notes.trim(),
      lineItems: cleanLines,
      ...totals,
      assignedAmId: null,
      assignedSmId: null,
      remarkHistory: [
        {
          id: `rem_ord_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: "SUBMITTED",
          message: `Submitted order request against onboarded entity ${entity.id}.`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.ORDERS, [created, ...orders]);
    this.appendAuditLog({
      tableName: "Order",
      recordId: created.id,
      action: "ORDER_SUBMITTED",
      actor,
      oldData: null,
      newData: {
        status: created.status,
        onboardingRequestId: created.onboardingRequestId,
        totalAmount: created.totalAmount,
        title: created.title,
      },
    });
    return created;
  }

  transitionOrderByAM(
    orderId: string,
    decision: "APPROVE" | "CHANGES" | "REJECT",
    remark: string,
    actor: ActorContext
  ): OrderRequest {
    this.initSeedIfNeeded();
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error("Order request not found.");
    const existing = orders[idx];
    const now = new Date().toISOString();

    let nextStatus: OrderStatus;
    let actionLabel: string;
    let defaultMsg: string;

    if (decision === "APPROVE") {
      nextStatus = "PENDING_SM_APPROVAL";
      actionLabel = "AM_VERIFIED";
      defaultMsg = "Order scope and rates verified. Forwarded to SM for approval.";
    } else if (decision === "REJECT") {
      nextStatus = "REJECTED";
      actionLabel = "REJECTED";
      defaultMsg = "Order request rejected by Account Manager.";
    } else {
      nextStatus = "CHANGES_REQUESTED";
      actionLabel = "CHANGES_REQUESTED";
      defaultMsg = "Clarification or revision requested by Account Manager.";
    }

    const finalMsg = remark.trim() || defaultMsg;
    const updated: OrderRequest = {
      ...existing,
      status: nextStatus,
      assignedAmId: actor.id,
      remarkHistory: [
        ...existing.remarkHistory,
        {
          id: `rem_ord_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: actionLabel,
          message: finalMsg,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    const next = [...orders];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.ORDERS, next);
    this.appendAuditLog({
      tableName: "Order",
      recordId: updated.id,
      action: `ORDER_${actionLabel}`,
      actor,
      oldData: { status: existing.status, assignedAmId: existing.assignedAmId },
      newData: {
        status: updated.status,
        assignedAmId: updated.assignedAmId,
        remark: finalMsg,
      },
    });
    return updated;
  }

  transitionOrderBySM(
    orderId: string,
    decision: "APPROVE" | "REJECT",
    remark: string,
    actor: ActorContext
  ): OrderRequest {
    this.initSeedIfNeeded();
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error("Order request not found.");
    const existing = orders[idx];
    const now = new Date().toISOString();

    const nextStatus: OrderStatus =
      decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const actionLabel = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const finalMsg =
      remark.trim() ||
      (decision === "APPROVE"
        ? "Purchase order approved and activated for invoicing."
        : "Order request rejected by Senior Manager.");

    const updated: OrderRequest = {
      ...existing,
      status: nextStatus,
      assignedSmId: actor.id,
      remarkHistory: [
        ...existing.remarkHistory,
        {
          id: `rem_ord_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: actionLabel,
          message: finalMsg,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    const next = [...orders];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.ORDERS, next);
    this.appendAuditLog({
      tableName: "Order",
      recordId: updated.id,
      action: `ORDER_${actionLabel}`,
      actor,
      oldData: { status: existing.status, assignedSmId: existing.assignedSmId },
      newData: {
        status: updated.status,
        assignedSmId: updated.assignedSmId,
        remark: finalMsg,
      },
    });
    return updated;
  }

  private sanitizeInvoiceAttachment(
    attachment: InvoiceAttachment | null
  ): InvoiceAttachment | null {
    if (!attachment || !attachment.fileName.trim()) return null;
    if (attachment.fileData) {
      try {
        const b = dataUrlToBlob(attachment.fileData);
        registerDocumentBlob(attachment.fileName, b);
        registerDocumentBlob(`INVOICE_${attachment.fileName}`, b);
      } catch {
        // ignore in test env
      }
    }
    const { fileData: _unused, ...rest } = attachment;
    return rest;
  }

  private validateLinkedOrderForInvoice(
    orderId: string | null,
    onboardingRequestId: string,
    vendorUserId: string
  ): void {
    if (!orderId) return;
    const order = this.getOrders().find((o) => o.id === orderId);
    if (!order) {
      throw new Error("Referenced order request not found.");
    }
    if (
      order.vendorUserId !== vendorUserId ||
      order.onboardingRequestId !== onboardingRequestId
    ) {
      throw new Error("Linked order does not belong to the selected onboarded entity.");
    }
    if (order.status !== "APPROVED") {
      throw new Error("Invoices can only be linked to APPROVED orders.");
    }
  }

  saveDraftInvoice(
    payload: {
      onboardingRequestId: string;
      orderId: string | null;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string;
      tdsRate: number;
      lineItems: OrderLineItem[];
      attachment: InvoiceAttachment | null;
      notes: string;
    },
    actor: ActorContext,
    existingInvoiceId?: string
  ): InvoiceRequest {
    this.initSeedIfNeeded();
    const entity = this.requireApprovedOnboardingEntity(
      payload.onboardingRequestId,
      actor.id
    );
    this.validateLinkedOrderForInvoice(
      payload.orderId,
      entity.id,
      actor.id
    );

    const invoices = this.getInvoices();
    const now = new Date().toISOString();
    const cleanLines = this.sanitizeLineItems(payload.lineItems);
    const totals = computeInvoiceTotals(cleanLines, payload.tdsRate);
    const cleanAttachment = this.sanitizeInvoiceAttachment(payload.attachment);

    if (existingInvoiceId) {
      const idx = invoices.findIndex((i) => i.id === existingInvoiceId);
      if (idx === -1) throw new Error("Invoice request not found.");
      const existing = invoices[idx];
      if (existing.vendorUserId !== actor.id) {
        throw new Error("Unauthorized invoice modification.");
      }
      if (
        existing.status !== "DRAFT" &&
        existing.status !== "CHANGES_REQUESTED"
      ) {
        throw new Error("Only draft or reverted invoices can be saved as draft.");
      }

      const updated: InvoiceRequest = {
        ...existing,
        onboardingRequestId: entity.id,
        orderId: payload.orderId,
        vendorEntityName: entity.businessInfo.legalBusinessName,
        businessType: entity.businessInfo.businessType,
        gstin: entity.businessInfo.gstin,
        status: "DRAFT",
        invoiceNumber: payload.invoiceNumber.trim().toUpperCase(),
        invoiceDate: payload.invoiceDate,
        dueDate: payload.dueDate,
        lineItems: cleanLines,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        tdsRate: Number(payload.tdsRate) || 0,
        tdsAmount: totals.tdsAmount,
        netPayableAmount: totals.netPayableAmount,
        attachment: cleanAttachment,
        notes: payload.notes.trim(),
        updatedAt: now,
      };
      const next = [...invoices];
      next[idx] = updated;
      this.writeJson(STORAGE_KEYS.INVOICES, next);
      this.appendAuditLog({
        tableName: "Invoice",
        recordId: updated.id,
        action: "INVOICE_DRAFT_UPDATED",
        actor,
        oldData: {
          status: existing.status,
          invoiceNumber: existing.invoiceNumber,
          netPayableAmount: existing.netPayableAmount,
        },
        newData: {
          status: updated.status,
          invoiceNumber: updated.invoiceNumber,
          netPayableAmount: updated.netPayableAmount,
        },
      });
      return updated;
    }

    const created: InvoiceRequest = {
      id: this.generateNextPrefixedId(invoices, "INV"),
      vendorUserId: actor.id,
      onboardingRequestId: entity.id,
      orderId: payload.orderId,
      vendorEntityName: entity.businessInfo.legalBusinessName,
      businessType: entity.businessInfo.businessType,
      gstin: entity.businessInfo.gstin,
      status: "DRAFT",
      invoiceNumber: payload.invoiceNumber.trim().toUpperCase(),
      invoiceDate: payload.invoiceDate,
      dueDate: payload.dueDate,
      lineItems: cleanLines,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      tdsRate: Number(payload.tdsRate) || 0,
      tdsAmount: totals.tdsAmount,
      netPayableAmount: totals.netPayableAmount,
      attachment: cleanAttachment,
      notes: payload.notes.trim(),
      assignedAmId: null,
      assignedSmId: null,
      remarkHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.INVOICES, [created, ...invoices]);
    this.appendAuditLog({
      tableName: "Invoice",
      recordId: created.id,
      action: "INVOICE_DRAFT_SAVED",
      actor,
      oldData: null,
      newData: {
        status: created.status,
        invoiceNumber: created.invoiceNumber,
        netPayableAmount: created.netPayableAmount,
      },
    });
    return created;
  }

  submitInvoiceRequest(
    payload: {
      onboardingRequestId: string;
      orderId: string | null;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string;
      tdsRate: number;
      lineItems: OrderLineItem[];
      attachment: InvoiceAttachment | null;
      notes: string;
    },
    actor: ActorContext,
    existingInvoiceId?: string
  ): InvoiceRequest {
    this.initSeedIfNeeded();
    const entity = this.requireApprovedOnboardingEntity(
      payload.onboardingRequestId,
      actor.id
    );
    this.validateLinkedOrderForInvoice(
      payload.orderId,
      entity.id,
      actor.id
    );

    const invoices = this.getInvoices();
    const now = new Date().toISOString();
    const cleanLines = this.sanitizeLineItems(payload.lineItems);
    const totals = computeInvoiceTotals(cleanLines, payload.tdsRate);
    const cleanAttachment = this.sanitizeInvoiceAttachment(payload.attachment);
    const normalizedInvNo = payload.invoiceNumber.trim().toUpperCase();

    if (existingInvoiceId) {
      const idx = invoices.findIndex((i) => i.id === existingInvoiceId);
      if (idx === -1) throw new Error("Invoice request not found.");
      const existing = invoices[idx];
      if (existing.vendorUserId !== actor.id) {
        throw new Error("Unauthorized invoice submission.");
      }
      if (
        existing.status !== "DRAFT" &&
        existing.status !== "CHANGES_REQUESTED"
      ) {
        throw new Error("Invoice has already been submitted.");
      }
      const wasChanges = existing.status === "CHANGES_REQUESTED";
      const actionLabel = wasChanges ? "RESUBMITTED" : "SUBMITTED";
      const updated: InvoiceRequest = {
        ...existing,
        onboardingRequestId: entity.id,
        orderId: payload.orderId,
        vendorEntityName: entity.businessInfo.legalBusinessName,
        businessType: entity.businessInfo.businessType,
        gstin: entity.businessInfo.gstin,
        status: "PENDING_AM_REVIEW",
        invoiceNumber: normalizedInvNo,
        invoiceDate: payload.invoiceDate,
        dueDate: payload.dueDate,
        lineItems: cleanLines,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        tdsRate: Number(payload.tdsRate) || 0,
        tdsAmount: totals.tdsAmount,
        netPayableAmount: totals.netPayableAmount,
        attachment: cleanAttachment,
        notes: payload.notes.trim(),
        remarkHistory: [
          ...existing.remarkHistory,
          {
            id: `rem_inv_${Date.now()}`,
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            action: actionLabel,
            message: wasChanges
              ? `Vendor revised invoice ${normalizedInvNo} and resubmitted for AM verification.`
              : `Submitted invoice ${normalizedInvNo}${payload.orderId ? ` against ${payload.orderId}` : ""}.`,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
      const next = [...invoices];
      next[idx] = updated;
      this.writeJson(STORAGE_KEYS.INVOICES, next);
      this.appendAuditLog({
        tableName: "Invoice",
        recordId: updated.id,
        action: `INVOICE_${actionLabel}`,
        actor,
        oldData: {
          status: existing.status,
          netPayableAmount: existing.netPayableAmount,
        },
        newData: {
          status: updated.status,
          invoiceNumber: updated.invoiceNumber,
          netPayableAmount: updated.netPayableAmount,
        },
      });
      return updated;
    }

    const created: InvoiceRequest = {
      id: this.generateNextPrefixedId(invoices, "INV"),
      vendorUserId: actor.id,
      onboardingRequestId: entity.id,
      orderId: payload.orderId,
      vendorEntityName: entity.businessInfo.legalBusinessName,
      businessType: entity.businessInfo.businessType,
      gstin: entity.businessInfo.gstin,
      status: "PENDING_AM_REVIEW",
      invoiceNumber: normalizedInvNo,
      invoiceDate: payload.invoiceDate,
      dueDate: payload.dueDate,
      lineItems: cleanLines,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      tdsRate: Number(payload.tdsRate) || 0,
      tdsAmount: totals.tdsAmount,
      netPayableAmount: totals.netPayableAmount,
      attachment: cleanAttachment,
      notes: payload.notes.trim(),
      assignedAmId: null,
      assignedSmId: null,
      remarkHistory: [
        {
          id: `rem_inv_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: "SUBMITTED",
          message: `Submitted invoice ${normalizedInvNo}${payload.orderId ? ` against ${payload.orderId}` : ""}.`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.writeJson(STORAGE_KEYS.INVOICES, [created, ...invoices]);
    this.appendAuditLog({
      tableName: "Invoice",
      recordId: created.id,
      action: "INVOICE_SUBMITTED",
      actor,
      oldData: null,
      newData: {
        status: created.status,
        invoiceNumber: created.invoiceNumber,
        orderId: created.orderId,
        netPayableAmount: created.netPayableAmount,
      },
    });
    return created;
  }

  transitionInvoiceByAM(
    invoiceId: string,
    decision: "APPROVE" | "CHANGES" | "REJECT",
    remark: string,
    actor: ActorContext
  ): InvoiceRequest {
    this.initSeedIfNeeded();
    const invoices = this.getInvoices();
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) throw new Error("Invoice request not found.");
    const existing = invoices[idx];
    const now = new Date().toISOString();

    let nextStatus: InvoiceStatus;
    let actionLabel: string;
    let defaultMsg: string;

    if (decision === "APPROVE") {
      nextStatus = "PENDING_SM_APPROVAL";
      actionLabel = "AM_VERIFIED";
      defaultMsg = "Tax invoice, GSTIN, and supporting deliverables verified. Escalated to SM.";
    } else if (decision === "REJECT") {
      nextStatus = "REJECTED";
      actionLabel = "REJECTED";
      defaultMsg = "Invoice request rejected by Account Manager.";
    } else {
      nextStatus = "CHANGES_REQUESTED";
      actionLabel = "CHANGES_REQUESTED";
      defaultMsg = "Invoice correction requested by Account Manager.";
    }

    const finalMsg = remark.trim() || defaultMsg;
    const updated: InvoiceRequest = {
      ...existing,
      status: nextStatus,
      assignedAmId: actor.id,
      remarkHistory: [
        ...existing.remarkHistory,
        {
          id: `rem_inv_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: actionLabel,
          message: finalMsg,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    const next = [...invoices];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.INVOICES, next);
    this.appendAuditLog({
      tableName: "Invoice",
      recordId: updated.id,
      action: `INVOICE_${actionLabel}`,
      actor,
      oldData: { status: existing.status, assignedAmId: existing.assignedAmId },
      newData: {
        status: updated.status,
        assignedAmId: updated.assignedAmId,
        remark: finalMsg,
      },
    });
    return updated;
  }

  transitionInvoiceBySM(
    invoiceId: string,
    decision: "APPROVE" | "REJECT" | "MARK_PAID",
    remark: string,
    actor: ActorContext
  ): InvoiceRequest {
    this.initSeedIfNeeded();
    const invoices = this.getInvoices();
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) throw new Error("Invoice request not found.");
    const existing = invoices[idx];
    const now = new Date().toISOString();

    const nextStatus: InvoiceStatus =
      decision === "MARK_PAID"
        ? "PAID"
        : decision === "APPROVE"
          ? "APPROVED"
          : "REJECTED";
    const actionLabel =
      decision === "MARK_PAID"
        ? "MARKED_PAID"
        : decision === "APPROVE"
          ? "APPROVED"
          : "REJECTED";
    const finalMsg =
      remark.trim() ||
      (decision === "MARK_PAID"
        ? "Invoice payout settled to vendor's verified bank account."
        : decision === "APPROVE"
          ? "Invoice approved for settlement payout."
          : "Invoice request rejected by Senior Manager.");

    const updated: InvoiceRequest = {
      ...existing,
      status: nextStatus,
      assignedSmId: actor.role === "SM" ? actor.id : existing.assignedSmId,
      remarkHistory: [
        ...existing.remarkHistory,
        {
          id: `rem_inv_${Date.now()}`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: actionLabel,
          message: finalMsg,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    const next = [...invoices];
    next[idx] = updated;
    this.writeJson(STORAGE_KEYS.INVOICES, next);
    this.appendAuditLog({
      tableName: "Invoice",
      recordId: updated.id,
      action: `INVOICE_${actionLabel}`,
      actor,
      oldData: { status: existing.status, assignedSmId: existing.assignedSmId },
      newData: {
        status: updated.status,
        assignedSmId: updated.assignedSmId,
        remark: finalMsg,
      },
    });
    return updated;
  }
}

export const storageService = new StorageService();
