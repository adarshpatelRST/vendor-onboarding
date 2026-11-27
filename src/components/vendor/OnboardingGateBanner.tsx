import { ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { OnboardingRequest } from "../../types/models";
import { RequestStatusTag } from "../common/StatusBadge";

interface OnboardingGateBannerProps {
  featureName: "Order Requests" | "Invoice Requests";
  vendorRequests: OnboardingRequest[];
  onGoToOnboarding: () => void;
}

export function OnboardingGateBanner({
  featureName,
  vendorRequests,
  onGoToOnboarding,
}: OnboardingGateBannerProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto text-center space-y-5 shadow-xs">
      <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900">
          {featureName} Locked — Onboarding Approval Required
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          You can raise {featureName.toLowerCase()} only after at least one of
          your vendor entity onboarding dossiers receives final{" "}
          <span className="font-semibold text-emerald-700">Approved</span>{" "}
          status from the Senior Manager.
        </p>
      </div>

      {vendorRequests.length > 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left space-y-2.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Your Current Onboarding Dossiers ({vendorRequests.length})
          </p>
          <div className="divide-y divide-slate-200">
            {vendorRequests.map((req) => (
              <div
                key={req.id}
                className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-slate-900 mr-2">
                    {req.id}
                  </span>
                  <span className="text-slate-700">
                    {req.businessInfo.legalBusinessName}
                  </span>
                </div>
                <RequestStatusTag status={req.status} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 flex items-center justify-center gap-2 text-xs text-blue-800">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            You have not created an onboarding request yet. Start your KYC
            dossier to unlock Orders &amp; Invoices.
          </span>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onGoToOnboarding}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <span>Go to Onboarding Requests</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
