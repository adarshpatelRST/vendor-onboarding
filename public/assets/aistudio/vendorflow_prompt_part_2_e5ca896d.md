# VendorFlow Enterprise — Part 2: Vendor 4-Step Wizard, AM/SM Mapped Queues, Ownership Lock & Document Preview/Download

Now implement the complete operational workflows for `VENDOR`, `AM`, and `SM` in **"VendorFlow Enterprise"**, seamlessly wired to the existing `storageService.ts`, `DataTable.tsx` (with three-dot `...` action menu and `< [ 1 ] of N >` pagination footer), custom red inline validations (`noValidate`), and `vf_audit_logs` JSON diff logger.

---

## 1. VENDOR WORKSPACE (`VENDOR` Role — Strictly No KPIs or Charts)
- **Sidebar**: `My Onboarding Requests` (default landing screen) and `+ New Onboarding Request`.
- **My Onboarding Requests Screen**:
  - Top bar: Title `"Your Onboarding Requests"`, Search input (Request ID / Business Name / GSTIN), Status filter dropdown, Business Type filter dropdown, and primary blue `"+ New Request"` button.
  - Uses `DataTable` with columns:
    - `REQUEST ID` (monospace)
    - `BUSINESS NAME`
    - `BUSINESS TYPE`
    - `ASSIGNED REVIEWER` (shows locked AM/SM name or `"Unassigned"`)
    - `LAST UPDATED`
    - `PROCESS STAGE` (pill badge)
    - `FINAL STATUS` (status badge)
    - `ACTIONS` (`...` three-dot dropdown menu: `Edit / Resume` enabled ONLY when status is `DRAFT` or `CHANGES_REQUESTED`; `View Details` for all statuses). Note: CRU only—do NOT include a Delete action.

- **4-Step Onboarding Wizard (Create / Edit / Read-Only View)**:
  - **Revert Alert Banner**: When `status === "CHANGES_REQUESTED"`, display a prominent amber/orange callout banner at the top showing the Account Manager's latest remark so the vendor knows what to fix.
  - **Read-Only Lock**: When status is `PENDING_AM_REVIEW`, `PENDING_SM_APPROVAL`, `QUERY_TO_AM`, `APPROVED`, or `REJECTED`, render all fields as read-only alongside the Remark & Activity Timeline.
  - **Custom Inline Validations (`noValidate`, red `*` on required labels, red inline error text below invalid fields)**:
    - **Step 1 — Business & Tax Identity**:
      - `Legal Business Name*` (required, 3–100 chars)
      - `Trade Name` (optional, max 100 chars)
      - `Business Type*` (required, dropdown populated from active `vf_business_types`)
      - `Business Category*` (required, dropdown: *IT & Software*, *Logistics & Supply Chain*, *Manufacturing*, *Facility Management*, *Consulting & Services*, *Packaging & Materials*)
      - `Year Established` (optional, 4-digit year `1900–2026`)
      - `GSTIN*` (required, 15-char regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`, auto-uppercase + **Unique GSTIN Guard**: block if ANY other request in `vf_requests` across ANY vendor where `status !== "REJECTED"` already uses this GSTIN; show inline red error `"An active or approved onboarding request already exists for this GSTIN."`)
      - `PAN*` (required, 10-char regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`, auto-uppercase — allowed across multiple requests for the same vendor)
      - `MSME / Udyam Number` (optional; if entered, validate `^UDYAM-[A-Z]{2}-\d{2}-\d{7}$`, auto-uppercase)
    - **Step 2 — Contact & Registered Address**:
      - `Primary Contact Name*` (2–60 chars), `Designation*` (2–50 chars), `Official Email*` (valid email), `Mobile Number*` (10-digit `^[6-9]\d{9}$`), `Registered Address*` (10–200 chars), `City*` (2–50 chars), `State*` (Indian States & UTs dropdown), `Pincode*` (6-digit `^[1-9][0-9]{5}$`).
    - **Step 3 — Bank Account Details**:
      - `Account Holder Name*` (3–100 chars), `Bank Name*` (2–60 chars), `Account Number*` (9–18 numeric digits `^\d{9,18}$`), `IFSC Code*` (11-char `^[A-Z]{4}0[A-Z0-9]{6}$`, auto-uppercase), `Account Type*` (`Current | Savings | Overdraft`).
    - **Step 4 — KYC Document Details & File Uploads**:
      - Render the 5 Indian KYC document rows, each requiring **BOTH a Document Number/Reference input AND a File Upload** (validating `.pdf, .jpg, .jpeg, .png` for PAN & Cancelled Cheque; `.pdf` only for GST Cert, Incorporation Cert, MSME Cert; max 5 MB; plus a `"Use Sample File"` helper button per row for fast live demos, and **Preview (Eye)** + **Download** icons once attached):
        1. `Company / Proprietor PAN Card*` (PAN Number* + File*)
        2. `GST Registration Certificate*` (GSTIN* + PDF File*)
        3. `Cancelled Cheque / Bank Proof*` (Cheque / Account Ref No.* + File*)
        4. `Certificate of Incorporation / Partnership Deed` (Optional: CIN / Reg No. + PDF File; if file attached then CIN/Reg No. required)
        5. `MSME / Udyam Registration Certificate` (Optional: Udyam No. + PDF File; if file attached then Udyam No. required)
  - **Wizard Footer Buttons**:
    - `"Save as Draft"`: Validates minimal fields (`Legal Business Name` + `Business Type`), saves with status `DRAFT`, logs `vf_audit_logs` JSON diff, and shows toast.
    - `"Submit Request"`: Runs full validation across all 4 steps (jumping to the first step with errors if invalid), sets status to `PENDING_AM_REVIEW`, appends submission entry to `remarkHistory`, writes `oldData` vs `newData` JSON diff to `vf_audit_logs`, and returns to `My Onboarding Requests`.

---

## 2. ACCOUNT MANAGER (`AM`) & SENIOR MANAGER (`SM`) WORKSPACES (Strictly No KPIs or Charts)
- **Strict Business-Type Mapping + First-Action Ownership Lock**:
  - **For `AM`**: Filter `vf_requests` to display ONLY requests where:
    1. `request.assignedAmId === currentUser.id` (requests already claimed/locked by this AM), OR
    2. `request.assignedAmId === null` AND `currentUser.mappedBusinessTypes.includes(request.businessInfo.businessType)` AND `request.status === "PENDING_AM_REVIEW"`.
  - **For `SM`**: Filter `vf_requests` to display ONLY requests where:
    1. `request.assignedSmId === currentUser.id` (requests already claimed/locked by this SM), OR
    2. `request.assignedSmId === null` AND `currentUser.mappedBusinessTypes.includes(request.businessInfo.businessType)` AND `request.status === "PENDING_SM_APPROVAL"`.
  - **Unmapped Empty State**: If `currentUser.mappedBusinessTypes.length === 0` and they have 0 assigned requests, display a clean empty state card: `"No Business Types mapped to your account yet. Contact System Admin to assign Business Types."`
- **Queue Table Screen**:
  - Filter bar: Search (Request ID / Business Name / GSTIN), Queue Scope (`All Accessible`, `Assigned to Me`, `Unclaimed Pool`), Status dropdown, Business Type dropdown.
  - `DataTable` showing `REQUEST ID`, `BUSINESS NAME`, `BUSINESS TYPE`, `OWNERSHIP` (`"Unclaimed"` blue pill badge vs `"Assigned to You"` slate badge), `LAST UPDATED`, `STATUS`, and `...` Action Menu (`Review Request`, `View Documents`).
- **2-Column Request Review & Approval Workspace**:
  - **Left Column (68%)**: Structured white cards for Business & Tax Info, Contact & Address, Bank Details, and **KYC Verification Table** showing Document Name, Entered Document Reference/Number, Attached File Name, **Preview (Eye Icon)** button, and **Download (Download Icon)** button.
  - **Right Column (32%)**:
    - **Remark & Activity Timeline**: Chronological history of all submissions, AM remarks, and SM queries.
    - **AM Decision Box** (active when `status === "PENDING_AM_REVIEW"` or `"QUERY_TO_AM"`):
      - Remark textarea (shows red inline validation error if required remark is left blank).
      - When `PENDING_AM_REVIEW`:
        1. **"Revert to Vendor"** (requires remark $\rightarrow$ sets `CHANGES_REQUESTED`, locks `assignedAmId = currentUser.id`).
        2. **"Verify & Forward to SM"** (sets `PENDING_SM_APPROVAL`, locks `assignedAmId = currentUser.id`).
      - When `QUERY_TO_AM`:
        1. **"Revert to Vendor"** (requires remark $\rightarrow$ sets `CHANGES_REQUESTED`).
        2. **"Reply & Forward to SM"** (requires remark $\rightarrow$ sets `PENDING_SM_APPROVAL`).
    - **SM Decision Box** (active when `status === "PENDING_SM_APPROVAL"`):
      - Remark textarea.
      - **"Query Account Manager"** (requires remark $\rightarrow$ sets `QUERY_TO_AM`, locks `assignedSmId = currentUser.id`).
      - **"Reject Request"** (requires remark $\rightarrow$ sets `REJECTED`, locks `assignedSmId = currentUser.id`).
      - **"Final Approve & Onboard"** (sets `APPROVED`, locks `assignedSmId = currentUser.id`).
    - Every transition updates `updatedAt`, appends to `remarkHistory`, and writes an entry with `oldData` and `newData` JSON snapshots to `vf_audit_logs`.

---

## 3. DOCUMENT PREVIEW MODAL & DOWNLOAD SIMULATION
- **Preview Modal (Eye Icon)**: Opens a clean Light Mode modal showing a formatted mock Indian KYC certificate/cheque card populated with the vendor's Legal Name, entered Document Number (PAN / GSTIN / Cheque Ref / CIN / Udyam), File Name, File Size, and Upload Timestamp.
- **Download Action (Download Icon)**: Triggers a real browser file download (formatted summary document blob named with the uploaded `fileName`) and displays a green toast notification (`"Downloaded {fileName}"`).