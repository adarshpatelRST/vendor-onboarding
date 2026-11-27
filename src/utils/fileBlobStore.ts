import { RequestDocument } from "../types/models";

const blobCache = new Map<string, Blob>();
const DB_NAME = "vf_files_db";
const STORE_NAME = "blobs";

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveBlobToStorage(key: string, blob: Blob): Promise<void> {
  if (!key || !blob) return;
  blobCache.set(key, blob);
  const db = await getDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, key);
  } catch (err) {
    console.warn("[fileBlobStore] Failed to write blob to indexedDB:", err);
  }
}

export async function getBlobFromStorage(key: string): Promise<Blob | undefined> {
  if (!key) return undefined;
  if (blobCache.has(key)) {
    return blobCache.get(key);
  }
  const db = await getDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const result = req.result as Blob | undefined;
        if (result) {
          blobCache.set(key, result);
        }
        resolve(result);
      };
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function preloadAllBlobs(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor) {
          if (cursor.key && cursor.value) {
            blobCache.set(cursor.key as string, cursor.value as Blob);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function registerDocumentBlob(
  docKey: string,
  blob: Blob
): void {
  blobCache.set(docKey, blob);
  saveBlobToStorage(docKey, blob).catch(() => {});
}

export function getCachedBlob(docKey: string): Blob | undefined {
  return blobCache.get(docKey);
}

export function clearDocumentBlob(docKey: string): void {
  blobCache.delete(docKey);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function generateMockPdfBlob(
  title: string,
  entityName: string,
  refNum: string
): Blob {
  const safeTitle = (title || "KYC Statutory Document").replace(/[()\\]/g, "");
  const safeEntity = (entityName || "Apex Supply Chain Pvt Ltd").replace(/[()\\]/g, "");
  const safeRef = (refNum || "VERIFIED-STATUTORY-2026").replace(/[()\\]/g, "");

  const streamLines = [
    "BT",
    "/F1 18 Tf",
    "50 740 Td",
    `(${safeTitle}) Tj`,
    "/F1 12 Tf",
    "0 -40 Td",
    `(Legal Entity: ${safeEntity}) Tj`,
    "0 -25 Td",
    `(Statutory Document Number: ${safeRef}) Tj`,
    "0 -25 Td",
    "(Verification Authority: Vendora Governance - Powered by RustyStick Technologies LLP) Tj",
    "0 -25 Td",
    "(Format: Official Indian Statutory KYC Record) Tj",
    "0 -25 Td",
    "(Digital Verification Status: VERIFIED & AUTHENTICATED) Tj",
    "ET",
  ];
  const streamBody = streamLines.join("\n") + "\n";
  const streamLen = new TextEncoder().encode(streamBody).length;

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 =
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n";
  const obj4 =
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const obj5 = `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamBody}endstream\nendobj\n`;

  const enc = new TextEncoder();
  const bHeader = enc.encode(header).length;
  const b1 = enc.encode(obj1).length;
  const b2 = enc.encode(obj2).length;
  const b3 = enc.encode(obj3).length;
  const b4 = enc.encode(obj4).length;
  const b5 = enc.encode(obj5).length;

  const o1 = bHeader;
  const o2 = o1 + b1;
  const o3 = o2 + b2;
  const o4 = o3 + b3;
  const o5 = o4 + b4;
  const startXref = o5 + b5;

  const pad = (n: number) => String(n).padStart(10, "0");

  const xref =
    "xref\n" +
    "0 6\n" +
    "0000000000 65535 f \n" +
    `${pad(o1)} 00000 n \n` +
    `${pad(o2)} 00000 n \n` +
    `${pad(o3)} 00000 n \n` +
    `${pad(o4)} 00000 n \n` +
    `${pad(o5)} 00000 n \n`;

  const trailer =
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const pdfFull = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
  return new Blob([pdfFull], { type: "application/pdf" });
}

function generateMockImageBlob(
  title: string,
  entityName: string,
  refNum: string
): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#f8fafc"/>
    <rect x="20" y="20" width="760" height="560" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="20" y="20" width="760" height="80" rx="16" fill="#1e40af"/>
    <text x="50" y="70" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">Vendora™ — ${title}</text>
    <rect x="50" y="140" width="700" height="400" rx="12" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
    <text x="80" y="190" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#64748b">STATUTORY KYC ATTACHMENT</text>
    <text x="80" y="230" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#0f172a">${title}</text>
    <text x="80" y="270" font-family="system-ui, sans-serif" font-size="15" fill="#334155">Legal Entity: <tspan font-weight="bold">${entityName || "Apex Supply Chain"}</tspan></text>
    <text x="80" y="305" font-family="system-ui, sans-serif" font-size="15" fill="#334155">Document / Account Ref: <tspan font-family="monospace" font-weight="bold">${refNum || "VERIFIED-REF"}</tspan></text>
    <rect x="80" y="340" width="300" height="36" rx="6" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
    <text x="100" y="364" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#166534">✓ AUTHENTICATED KYC RECORD</text>
    <text x="80" y="440" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">Digitally signed and archived via Vendora™ · Powered by RustyStick Technologies LLP</text>
  </svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

export async function openDocumentInNewTab(
  doc: RequestDocument,
  legalBusinessName = "Apex Supply Chain Pvt Ltd"
): Promise<void> {
  let blob: Blob | undefined =
    blobCache.get(doc.fileName) ||
    blobCache.get(doc.docType) ||
    blobCache.get(`${doc.docType}_${doc.fileName}`);

  if (!blob) {
    blob =
      (await getBlobFromStorage(doc.fileName)) ||
      (await getBlobFromStorage(doc.docType)) ||
      (await getBlobFromStorage(`${doc.docType}_${doc.fileName}`));
  }

  if (!blob && doc.fileData) {
    try {
      blob = dataUrlToBlob(doc.fileData);
      registerDocumentBlob(doc.fileName, blob);
      registerDocumentBlob(doc.docType, blob);
    } catch {
      // Fall through to sample generator
    }
  }

  if (!blob) {
    const isImage =
      doc.fileType.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.fileName);
    if (isImage) {
      blob = generateMockImageBlob(doc.label, legalBusinessName, doc.docNumber);
    } else {
      blob = generateMockPdfBlob(doc.label, legalBusinessName, doc.docNumber);
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
}
