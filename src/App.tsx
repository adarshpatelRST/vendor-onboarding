/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalyticsDashboard } from "./components/admin/AnalyticsDashboard";
import { AuditLogsPage } from "./components/admin/AuditLogsPage";
import { BusinessTypesManagement } from "./components/admin/BusinessTypesManagement";
import { UserBusinessMapping } from "./components/admin/UserBusinessMapping";
import { UserManagement } from "./components/admin/UserManagement";
import { AuthPage } from "./components/auth/AuthPage";
import { ToastBanner, ToastMessage } from "./components/common/Toast";
import {
  AdminNavSection,
  AppShell,
  ReviewerNavSection,
  VendorNavSection,
} from "./components/layout/AppShell";
import { ManagerQueuePage } from "./components/reviewer/ManagerQueuePage";
import { OrdersInvoicesQueuePage } from "./components/reviewer/OrdersInvoicesQueuePage";
import { RequestReviewWorkspace } from "./components/reviewer/RequestReviewWorkspace";
import { VendorInvoicesPage } from "./components/vendor/VendorInvoicesPage";
import { VendorOnboardingWizard } from "./components/vendor/VendorOnboardingWizard";
import { VendorOrdersPage } from "./components/vendor/VendorOrdersPage";
import { VendorRequestsList } from "./components/vendor/VendorRequestsList";
import { storageService } from "./services/storageService";
import { OnboardingRequest, User } from "./types/models";
import { preloadAllBlobs } from "./utils/fileBlobStore";
import { getVendorOnboardingLockState } from "./utils/requestValidators";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    storageService.initSeedIfNeeded();
    return storageService.getSessionUser();
  });
  const [adminSection, setAdminSection] =
    useState<AdminNavSection>("analytics");
  const [adminReviewRequestId, setAdminReviewRequestId] =
    useState<string | null>(null);

  // Vendor workspace navigation state
  const [vendorView, setVendorView] = useState<{
    mode: "list" | "wizard" | "orders" | "invoices";
    requestId: string | null;
    readOnly: boolean;
    sessionId?: number;
  }>({ mode: "list", requestId: null, readOnly: false });

  const [initialOrderEntityId, setInitialOrderEntityId] = useState<
    string | null
  >(null);
  const [initialInvoiceContext, setInitialInvoiceContext] = useState<{
    onboardingRequestId?: string;
    orderId?: string;
  } | null>(null);

  // AM / SM workspace navigation state
  const [reviewerSection, setReviewerSection] =
    useState<ReviewerNavSection>("queue");
  const [reviewerView, setReviewerView] = useState<{
    requestId: string | null;
    focusDocuments: boolean;
  }>({ requestId: null, focusDocuments: false });

  const [dataVersion, setDataVersion] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({
        id: `${Date.now()}`,
        type,
        message,
      });
    },
    []
  );

  useEffect(() => {
    preloadAllBlobs();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [
    currentUser?.id,
    adminSection,
    adminReviewRequestId,
    vendorView.mode,
    vendorView.requestId,
    reviewerView.requestId,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const users = useMemo(() => {
    void dataVersion;
    return storageService.getUsers();
  }, [dataVersion]);

  const businessTypes = useMemo(() => {
    void dataVersion;
    return storageService.getBusinessTypes();
  }, [dataVersion]);

  const requests = useMemo(() => {
    void dataVersion;
    return storageService.getRequests();
  }, [dataVersion]);

  const orders = useMemo(() => {
    void dataVersion;
    return storageService.getOrders();
  }, [dataVersion]);

  const invoices = useMemo(() => {
    void dataVersion;
    return storageService.getInvoices();
  }, [dataVersion]);

  const auditLogs = useMemo(() => {
    void dataVersion;
    return storageService.getAuditLogs();
  }, [dataVersion]);

  const vendorLockState = useMemo(() => {
    if (!currentUser || currentUser.role !== "VENDOR") {
      return { isOnboarded: false, canCreateNewOnboarding: false };
    }
    return getVendorOnboardingLockState(currentUser.id, requests, currentUser);
  }, [currentUser, requests]);

  const isVendorOnboarded = vendorLockState.isOnboarded;
  const canCreateNewOnboarding = vendorLockState.canCreateNewOnboarding;

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setAdminSection("analytics");
    setAdminReviewRequestId(null);
    setVendorView({ mode: "list", requestId: null, readOnly: false });
    setInitialOrderEntityId(null);
    setInitialInvoiceContext(null);
    setReviewerSection("queue");
    setReviewerView({ requestId: null, focusDocuments: false });
    setDataVersion((v) => v + 1);
  };

  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
  };

  const handleResetDemoData = () => {
    storageService.resetDemoData();
    setCurrentUser(null);
    setDataVersion((v) => v + 1);
    showToast("Demo data has been restored to initial seed state.", "success");
  };

  const handleDataChanged = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setDataVersion((v) => v + 1);
    const refreshed = storageService.getSessionUser();
    setCurrentUser(refreshed);
    showToast(message, type);
  };

  const handleVendorSidebarSelect = (section: VendorNavSection) => {
    if (section === "requests") {
      setVendorView({ mode: "list", requestId: null, readOnly: false });
    } else if (section === "new_request") {
      setVendorView({ mode: "wizard", requestId: null, readOnly: false });
    } else if (section === "orders") {
      setVendorView({ mode: "orders", requestId: null, readOnly: false });
    } else {
      setVendorView({ mode: "invoices", requestId: null, readOnly: false });
    }
  };

  const activeAdminReviewRequest: OnboardingRequest | null = useMemo(() => {
    if (!adminReviewRequestId) return null;
    return requests.find((r) => r.id === adminReviewRequestId) ?? null;
  }, [requests, adminReviewRequestId]);

  const activeVendorRequest: OnboardingRequest | null = useMemo(() => {
    if (!vendorView.requestId) return null;
    return requests.find((r) => r.id === vendorView.requestId) ?? null;
  }, [requests, vendorView.requestId]);

  const activeReviewRequest: OnboardingRequest | null = useMemo(() => {
    if (!reviewerView.requestId) return null;
    return requests.find((r) => r.id === reviewerView.requestId) ?? null;
  }, [requests, reviewerView.requestId]);

  return (
    <>
      {!currentUser ? (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <AppShell
          user={currentUser}
          isVendorOnboarded={isVendorOnboarded}
          canCreateNewOnboarding={canCreateNewOnboarding}
          onResetDemoData={
            currentUser.role === "ADMIN" ? handleResetDemoData : undefined
          }
          activeAdminSection={
            currentUser.role === "ADMIN" ? adminSection : undefined
          }
          onSelectAdminSection={
            currentUser.role === "ADMIN"
              ? (sec) => {
                setAdminSection(sec);
                setAdminReviewRequestId(null);
              }
              : undefined
          }
          activeVendorSection={
            currentUser.role === "VENDOR"
              ? vendorView.mode === "wizard" && vendorView.requestId === null
                ? "new_request"
                : vendorView.mode === "orders"
                  ? "orders"
                  : vendorView.mode === "invoices"
                    ? "invoices"
                    : "requests"
              : undefined
          }
          onSelectVendorSection={
            currentUser.role === "VENDOR"
              ? handleVendorSidebarSelect
              : undefined
          }
          activeReviewerSection={
            currentUser.role === "AM" || currentUser.role === "SM"
              ? reviewerSection
              : undefined
          }
          onSelectReviewerSection={
            currentUser.role === "AM" || currentUser.role === "SM"
              ? (sec) => {
                setReviewerSection(sec);
                setReviewerView({ requestId: null, focusDocuments: false });
              }
              : undefined
          }
          onLogout={handleLogout}
        >
          {currentUser.role === "ADMIN" && (
            <>
              {adminSection === "analytics" && (
                activeAdminReviewRequest ? (
                  <RequestReviewWorkspace
                    currentUser={currentUser}
                    request={activeAdminReviewRequest}
                    allRequests={requests}
                    users={users}
                    focusDocuments={false}
                    onBack={() => setAdminReviewRequestId(null)}
                    onTransitionComplete={(msg) => {
                      setDataVersion((v) => v + 1);
                      setAdminReviewRequestId(null);
                      showToast(msg);
                    }}
                    onShowToast={showToast}
                  />
                ) : (
                  <AnalyticsDashboard
                    currentUser={currentUser}
                    requests={requests}
                    businessTypes={businessTypes}
                    users={users}
                    onOpenReview={(req) => setAdminReviewRequestId(req.id)}
                    onDataChanged={handleDataChanged}
                  />
                )
              )}
              {(adminSection === "orders" || adminSection === "invoices") && (
                <OrdersInvoicesQueuePage
                  mode={adminSection}
                  currentUser={currentUser}
                  orders={orders}
                  invoices={invoices}
                  businessTypes={businessTypes}
                  users={users}
                  onDataChanged={handleDataChanged}
                />
              )}
              {adminSection === "users" && (
                <UserManagement
                  currentUser={currentUser}
                  users={users}
                  requests={requests}
                  onDataChanged={handleDataChanged}
                />
              )}
              {adminSection === "mapping" && (
                <UserBusinessMapping
                  currentUser={currentUser}
                  users={users}
                  businessTypes={businessTypes}
                  onDataChanged={handleDataChanged}
                />
              )}
              {adminSection === "business_types" && (
                <BusinessTypesManagement
                  currentUser={currentUser}
                  businessTypes={businessTypes}
                  onDataChanged={handleDataChanged}
                />
              )}
              {adminSection === "audit_logs" && (
                <AuditLogsPage auditLogs={auditLogs} />
              )}
            </>
          )}

          {currentUser.role === "VENDOR" && (
            <>
              {vendorView.mode === "list" && (
                <VendorRequestsList
                  currentUser={currentUser}
                  requests={requests}
                  businessTypes={businessTypes}
                  users={users}
                  onCreateNew={() =>
                    setVendorView({
                      mode: "wizard",
                      requestId: null,
                      readOnly: false,
                      sessionId: Date.now(),
                    })
                  }
                  onEditRequest={(req) =>
                    setVendorView({
                      mode: "wizard",
                      requestId: req.id,
                      readOnly: false,
                      sessionId: Date.now(),
                    })
                  }
                  onViewRequest={(req) =>
                    setVendorView({
                      mode: "wizard",
                      requestId: req.id,
                      readOnly: true,
                      sessionId: Date.now(),
                    })
                  }
                  onRaiseOrder={(req) => {
                    setInitialOrderEntityId(req.id);
                    setVendorView({
                      mode: "orders",
                      requestId: null,
                      readOnly: false,
                    });
                  }}
                  onRaiseInvoice={(req) => {
                    setInitialInvoiceContext({ onboardingRequestId: req.id });
                    setVendorView({
                      mode: "invoices",
                      requestId: null,
                      readOnly: false,
                    });
                  }}
                />
              )}
              {vendorView.mode === "wizard" && (
                <VendorOnboardingWizard
                  key={vendorView.sessionId ? `wizard-${vendorView.sessionId}` : (vendorView.requestId ?? "new")}
                  currentUser={currentUser}
                  existingRequest={activeVendorRequest}
                  forceReadOnly={vendorView.readOnly}
                  allRequests={requests}
                  businessTypes={businessTypes}
                  onBack={() =>
                    setVendorView({
                      mode: "list",
                      requestId: null,
                      readOnly: false,
                    })
                  }
                  onSavedDraft={(saved) => {
                    setDataVersion((v) => v + 1);
                    setVendorView({
                      mode: "list",
                      requestId: null,
                      readOnly: false,
                    });
                    showToast(`Request ${saved.id} saved as draft.`);
                  }}
                  onSubmitted={(submitted) => {
                    setDataVersion((v) => v + 1);
                    setVendorView({
                      mode: "list",
                      requestId: null,
                      readOnly: false,
                    });
                    showToast(
                      `Submitted ${submitted.id} for Account Manager review.`
                    );
                  }}
                  onShowToast={showToast}
                />
              )}
              {vendorView.mode === "orders" && (
                <VendorOrdersPage
                  currentUser={currentUser}
                  requests={requests}
                  orders={orders}
                  users={users}
                  initialCreateEntityId={initialOrderEntityId}
                  onClearInitialCreate={() => setInitialOrderEntityId(null)}
                  onNavigateToOnboarding={() =>
                    setVendorView({
                      mode: "list",
                      requestId: null,
                      readOnly: false,
                    })
                  }
                  onRaiseInvoiceFromOrder={(ord) => {
                    setInitialInvoiceContext({
                      onboardingRequestId: ord.onboardingRequestId,
                      orderId: ord.id,
                    });
                    setVendorView({
                      mode: "invoices",
                      requestId: null,
                      readOnly: false,
                    });
                  }}
                  onDataChanged={handleDataChanged}
                />
              )}
              {vendorView.mode === "invoices" && (
                <VendorInvoicesPage
                  currentUser={currentUser}
                  requests={requests}
                  orders={orders}
                  invoices={invoices}
                  users={users}
                  initialCreateContext={initialInvoiceContext}
                  onClearInitialCreate={() => setInitialInvoiceContext(null)}
                  onNavigateToOnboarding={() =>
                    setVendorView({
                      mode: "list",
                      requestId: null,
                      readOnly: false,
                    })
                  }
                  onDataChanged={handleDataChanged}
                />
              )}
            </>
          )}

          {(currentUser.role === "AM" || currentUser.role === "SM") && (
            <>
              {reviewerSection === "queue" ? (
                activeReviewRequest ? (
                  <RequestReviewWorkspace
                    currentUser={currentUser}
                    request={activeReviewRequest}
                    allRequests={requests}
                    users={users}
                    focusDocuments={reviewerView.focusDocuments}
                    onBack={() =>
                      setReviewerView({ requestId: null, focusDocuments: false })
                    }
                    onTransitionComplete={(msg) => {
                      setDataVersion((v) => v + 1);
                      setReviewerView({ requestId: null, focusDocuments: false });
                      showToast(msg);
                    }}
                    onShowToast={showToast}
                  />
                ) : (
                  <ManagerQueuePage
                    currentUser={currentUser}
                    requests={requests}
                    businessTypes={businessTypes}
                    onOpenReview={(req, focusDocuments = false) =>
                      setReviewerView({ requestId: req.id, focusDocuments })
                    }
                  />
                )
              ) : (
                <OrdersInvoicesQueuePage
                  mode={reviewerSection}
                  currentUser={currentUser}
                  orders={orders}
                  invoices={invoices}
                  businessTypes={businessTypes}
                  users={users}
                  onDataChanged={handleDataChanged}
                />
              )}
            </>
          )}
        </AppShell>
      )}

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
