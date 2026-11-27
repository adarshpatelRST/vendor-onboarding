# VendorFlow Enterprise — Part 1: Core Architecture, Seed Engine, Auth, Unified Table & Admin Governance

Build a clean, enterprise-grade, STRICTLY LIGHT-MODE React + TypeScript + Tailwind CSS + Lucide Icons web application called **"VendorFlow Enterprise — Vendor Onboarding & Supplier Portal"**.

## CRITICAL GLOBAL DESIGN & ARCHITECTURE RULES
1. **STRICT LIGHT MODE ONLY**: Crisp white cards (`#FFFFFF`), subtle light-slate page background (`#F8FAFC`), clean slate borders (`#E2E8F0`), primary royal blue buttons (`#2563EB`), and high-contrast slate text (`#0F172A` / `#475569`). NEVER use dark mode on any sidebar, header, modal, card, table, or chart.
2. **TYPOGRAPHY**: Load and apply `Plus Jakarta Sans` for headings, `Public Sans` / `Inter` for UI body text, and `JetBrains Mono` for IDs (`REQ-2026-101`), GSTIN, PAN, IFSC, account numbers, and JSON diffs.
3. **GENERIC ENTERPRISE BRANDING**: Use **"VendorFlow Enterprise"** across the app. Do NOT use any retail-specific brand names.
4. **CUSTOM INLINE VALIDATIONS ONLY**: Every form MUST include `noValidate` so native browser validation tooltips NEVER appear. Mark every required field label with a red asterisk (`*` in `text-red-600`). Render crisp red inline validation error messages (`text-xs text-red-600 mt-1`) directly beneath invalid inputs and highlight invalid input borders in red (`border-red-500`).
5. **100% CLIENT-SIDE LOCALSTORAGE PERSISTENCE (`storageService.ts`)**: Automatically initialize `localStorage` with rich seeded Indian corporate data on first visit, and automatically write an audit log entry (`vf_audit_logs`) with `oldData` and `newData` JSON snapshots on every create, update, or status transition across the entire app.

---

## 1. EXACT `localStorage` SCHEMA & SEED DATA

### A. `vf_users`
Schema:
```ts
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  role: "VENDOR" | "AM" | "SM" | "ADMIN";
  status: "ACTIVE" | "INACTIVE";
  mappedBusinessTypes: string[]; // Used for AM & SM business-type routing
  createdAt: string;
}
```
Pre-seed 7 users (all with password `Demo@2026`):
1. `usr_vendor_01`: **Rohan Kulkarni** (`rohan@apexlogistics.in`, Role: `VENDOR`, Phone: `9820145678`, Status: `ACTIVE`, mappedBusinessTypes: `[]`)
2. `usr_vendor_02`: **Kavita Joshi** (`kavita@technova.co.in`, Role: `VENDOR`, Phone: `9811233445`, Status: `ACTIVE`, mappedBusinessTypes: `[]`)
3. `usr_am_01`: **Priya Nair** (`priya.am@vendorflow.in`, Role: `AM`, Phone: `9920011223`, Status: `ACTIVE`, mappedBusinessTypes: `["Private Limited", "Public Limited", "LLP"]`)
4. `usr_am_02`: **Rahul Verma** (`rahul.am@vendorflow.in`, Role: `AM`, Phone: `9930044556`, Status: `ACTIVE`, mappedBusinessTypes: `["Private Limited", "Partnership", "Proprietorship"]`)
5. `usr_sm_01`: **Vikram Aditya** (`vikram.sm@vendorflow.in`, Role: `SM`, Phone: `9845077889`, Status: `ACTIVE`, mappedBusinessTypes: `["Private Limited", "Public Limited", "LLP"]`)
6. `usr_sm_02`: **Meenakshi Iyer** (`meenakshi.sm@vendorflow.in`, Role: `SM`, Phone: `9876543210`, Status: `ACTIVE`, mappedBusinessTypes: `["Partnership", "Proprietorship"]`)
7. `usr_admin_01`: **Ananya Sharma** (`admin@vendorflow.in`, Role: `ADMIN`, Phone: `9000012345`, Status: `ACTIVE`, mappedBusinessTypes: `[]`)

### B. `vf_business_types`
Schema:
```ts
interface BusinessType {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}
```
Pre-seed 5 active types:
1. `bt_01`: `Private Limited` (`PVT_LTD` — Private Limited Company registered under Companies Act)
2. `bt_02`: `Public Limited` (`PUB_LTD` — Public Limited Corporate Entity)
3. `bt_03`: `LLP` (`LLP` — Limited Liability Partnership)
4. `bt_04`: `Partnership` (`PARTNERSHIP` — Registered Partnership Firm)
5. `bt_05`: `Proprietorship` (`PROPRIETORSHIP` — Sole Proprietorship Enterprise)

### C. `vf_requests`
Schema:
```ts
interface OnboardingRequest {
  id: string; // e.g. "REQ-2026-101"
  vendorUserId: string;
  status:
    | "DRAFT"
    | "PENDING_AM_REVIEW"
    | "CHANGES_REQUESTED"
    | "PENDING_SM_APPROVAL"
    | "QUERY_TO_AM"
    | "APPROVED"
    | "REJECTED";
  assignedAmId: string | null; // Null until first AM claims via Approve/Revert
  assignedSmId: string | null; // Null until first SM claims via Query/Approve/Reject
  businessInfo: {
    legalBusinessName: string;
    tradeName: string;
    businessType: string;
    businessCategory: string;
    yearEstablished: string;
    gstin: string;
    pan: string;
    msmeNumber: string;
  };
  contactInfo: {
    primaryContactName: string;
    designation: string;
    email: string;
    phone: string;
    registeredAddress: string;
    city: string;
    state: string;
    pincode: string;
  };
  bankInfo: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountType: "Current" | "Savings" | "Overdraft";
  };
  documents: Array<{
    docType: "PAN_CARD" | "GST_CERT" | "CANCELLED_CHEQUE" | "INCORP_CERT" | "MSME_CERT";
    label: string;
    required: boolean;
    docNumber: string;
    fileName: string;
    fileType: string;
    fileSize: string;
    uploadedAt: string;
  }>;
  remarkHistory: Array<{
    id: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    message: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```
Pre-seed 6 realistic Indian corporate onboarding requests:
1. `REQ-2026-101`: Owner `usr_vendor_01`, `Apex Supply Chain Pvt Ltd`, `Private Limited`, GSTIN `27AABCA1234D1Z5`, PAN `AABCA1234D`, Status `PENDING_AM_REVIEW`, `assignedAmId: null`, `assignedSmId: null` (Unclaimed pool visible to both AM Priya & AM Rahul).
2. `REQ-2026-102`: Owner `usr_vendor_01`, `Apex Cold Storage LLP`, `LLP`, GSTIN `27AAKFA5678M1Z2`, PAN `AAKFA5678M`, Status `CHANGES_REQUESTED`, `assignedAmId: "usr_am_01"`, `assignedSmId: null` (Reverted by AM Priya Nair with remark: `"Cancelled cheque image is unclear and IFSC code does not match branch. Please re-upload clear cheque."`).
3. `REQ-2026-103`: Owner `usr_vendor_02`, `TechNova Cloud Solutions Pvt Ltd`, `Private Limited`, GSTIN `29AABCT9876K1Z8`, PAN `AABCT9876K`, Status `PENDING_SM_APPROVAL`, `assignedAmId: "usr_am_01"`, `assignedSmId: null` (Verified by AM Priya Nair; unclaimed in SM Vikram's queue).
4. `REQ-2026-104`: Owner `usr_vendor_02`, `TechNova Hardware Enterprises`, `Proprietorship`, GSTIN `07AFKPJ4321R1Z9`, PAN `AFKPJ4321R`, Status `QUERY_TO_AM`, `assignedAmId: "usr_am_02"`, `assignedSmId: "usr_sm_02"` (Queried by SM Meenakshi Iyer to AM Rahul Verma: `"Please confirm GST registration address matches billing warehouse address."`).
5. `REQ-2026-105`: Owner `usr_vendor_01`, `Kulkarni Freight & Movers`, `Partnership`, GSTIN `27AAKFK7788P1Z1`, PAN `AAKFK7788P`, Status `APPROVED`, `assignedAmId: "usr_am_02"`, `assignedSmId: "usr_sm_01"`.
6. `REQ-2026-106`: Owner `usr_vendor_02`, `TechNova Managed Services Ltd`, `Public Limited`, GSTIN `29AABCT5544L1Z3`, PAN `AABCT5544L`, Status `DRAFT`, `assignedAmId: null`, `assignedSmId: null`.

### D. `vf_audit_logs`
Schema:
```ts
interface AuditLog {
  id: string; // UUID
  tableName: "Request" | "User" | "BusinessType" | "UserBusinessMapping";
  recordId: string;
  action: string;
  performedByName: string;
  performedByRole: string;
  performedAt: string;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
}
```
Pre-seed 4 realistic audit log entries matching the requests above.

---

## 2. REUSABLE UNIFIED TABLE & PAGINATION COMPONENT (`DataTable.tsx`)
Build a standardized enterprise table component used across ALL list screens in the app:
- **Sortable Column Headers** with subtle up/down sort indicators.
- **Three-Dot (`...`) Action Dropdown Menu** on the far right of every row showing contextual actions (closes on outside click).
- **Exact Pagination Footer**:
  - Left side: `Showing {start}-{end} of {total} results`
  - Right side: `[ < ]` Previous button + bordered numeric page input `[ 1 ]` (allows typing a page number to jump directly) + `of {totalPages}` + `[ > ]` Next button.

---

## 3. SCREENS TO BUILD IN PART 1

### Screen 1: Authentication Page (Login + 1-Click Quick Logins + Validated Vendor Sign-Up)
- **Top Card — Sign In**:
  - VendorFlow Enterprise header, Email*, Password* (with show/hide eye toggle), full-width blue `"Sign In"` button, and `"New Vendor? Create an Account"` toggle link.
  - Block login if user `status === "INACTIVE"` with inline red error: `"Your account has been deactivated by the Administrator."`
- **Vendor Sign-Up View**:
  - Fields with red `*` and custom red inline validation below each input (`noValidate`):
    - **Full Name***: Required, 2–60 chars, letters and spaces only.
    - **Email Address***: Required, valid email regex, **unique across `vf_users`** (case-insensitive check; inline red error `"This email is already registered"`).
    - **Mobile Number***: Required, 10-digit Indian mobile (`^[6-9]\d{9}$`).
    - **Password***: Required, 8–30 chars, at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=]).{8,30}$`), with live rule checklist indicators below the field.
  - Registers user with `role: "VENDOR"`, `status: "ACTIVE"`, logs audit entry in `vf_audit_logs`, and logs them in immediately.
- **Bottom Card — `"1-CLICK FAST PERSONA LOGIN"`**:
  - 2-column grid of clickable white cards for the 6 personas (*Vendor: Rohan*, *AM 1: Priya*, *AM 2: Rahul*, *SM 1: Vikram*, *SM 2: Meenakshi*, *Admin: Ananya*) showing Role badge & mapped Business Types.
- **Footer**: `"Protected by Enterprise RBAC"` on left + `"Reset Demo Data"` button on right (restores initial seed data and shows a green confirmation toast).

### Screen 2: App Shell & All 5 `ADMIN` Screens
- Top header (`VendorFlow Enterprise` logo on left; logged-in user name, role badge, and Logout button on right—do NOT put a role switcher in the header).
- **Admin Sidebar (5 Items)**:
  1. **Analytics Dashboard** *(ONLY `ADMIN` sees KPIs & Charts)*:
     - **Strictly 4 KPI Cards** in a 4-column grid: (1) *Total Requests*, (2) *Pending Review (AM + SM)*, (3) *Approved & Onboarded*, (4) *Reverted / Queried*.
     - **2 Light-Mode Charts** side-by-side: *Requests by Status* and *Requests by Business Type*.
     - **Filterable Master Requests Table** below using `DataTable` (Search Request ID/Business Name/GSTIN, Status filter, Business Type filter).
  2. **User Management (Full CRUD)**:
     - 3-column filter bar (Search Name/Email, Role filter, Status filter) + `DataTable` + `"+ Add User"` / `"Edit User"` modal (Name, Email unique check, Phone, Password rules, Role selector `VENDOR | AM | SM | ADMIN`, Active/Inactive toggle).
     - **Last Active Admin Protection**: Prevent changing role or deactivating if only 1 active `ADMIN` remains in `vf_users` (display inline red warning).
  3. **UserBusinessMapping**:
     - Dedicated module listing all `AM` and `SM` users with their mapped Business Types shown as chips, plus an `"Edit Mapping"` modal with multi-select checkboxes for all active Business Types. Saves to `vf_users` and logs `oldData` vs `newData` in `vf_audit_logs`.
  4. **Business Types (Full CRUD)**:
     - `DataTable` of `vf_business_types` (Name, Code, Description, Active badge, `...` menu) + `"+ Add Business Type"` / `"Edit"` modal with custom inline validations and Active/Inactive toggle.
  5. **Audit Logs**:
     - Filterable `DataTable` (Search Record ID/Actor, Table filter: `All | Request | User | BusinessType | UserBusinessMapping`, Action filter).
     - Clicking `"View Details"` in the `...` menu opens the **Audit Log Details Modal**: header with green shield icon, title `Audit Log Details`, monospace `ID: <uuid>`, summary strip (`PERFORMED AT`, `PERFORMED BY`, `RECORD ID / WHAT CHANGED`), side-by-side **`OLD DATA` (JSON)** and **`NEW DATA` (JSON)** panels, and a green **`CLOSE`** button.

Create clean placeholder landing routes for `VENDOR`, `AM`, and `SM` so the app compiles with zero errors and is ready for Part 2.