import React, { useMemo, useState } from "react";
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { User } from "../../types/models";
import { storageService } from "../../services/storageService";
import {
  evaluatePasswordRules,
  validateSignInForm,
  validateVendorSignUpForm,
} from "../../utils/validators";
import { RoleTag } from "../common/StatusBadge";

interface AuthPageProps {
  onLoginSuccess: (user: User) => void;
}

const PERSONA_IDS = [
  { id: "usr_vendor_01", displayLabel: "Vendor 1: Rohan" },
  { id: "usr_am_01", displayLabel: "AM 1: Priya" },
  { id: "usr_am_02", displayLabel: "AM 2: Rahul" },
  { id: "usr_sm_01", displayLabel: "SM 1: Vikram" },
  { id: "usr_sm_02", displayLabel: "SM 2: Meenakshi" },
  { id: "usr_admin_01", displayLabel: "Admin 1: Ananya" },
] as const;

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [usersVersion, setUsersVersion] = useState(0);

  // Sign-In state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPass, setShowSignInPass] = useState(false);
  const [signInErrors, setSignInErrors] = useState<Record<string, string>>({});
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);

  // Sign-Up state
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpPass, setShowSignUpPass] = useState(false);
  const [showSignUpConfirmPass, setShowSignUpConfirmPass] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});

  const allUsers = useMemo(() => {
    void usersVersion;
    return storageService.getUsers();
  }, [usersVersion]);

  const personaCards = useMemo(() => {
    return PERSONA_IDS.map((p) => {
      const user = allUsers.find((u) => u.id === p.id);
      return {
        ...p,
        user,
      };
    });
  }, [allUsers]);

  const passwordRules = useMemo(
    () => evaluatePasswordRules(signUpPassword),
    [signUpPassword]
  );

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBannerError(null);

    const cleanEmail = signInEmail.trim();
    const cleanPassword = signInPassword.trim();
    const errors = validateSignInForm({
      email: cleanEmail,
      password: cleanPassword,
    });
    setSignInErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const result = storageService.authenticate(cleanEmail, cleanPassword);
    if (!result.ok) {
      setAuthBannerError(result.error);
      return;
    }
    onLoginSuccess(result.user);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBannerError(null);

    const cleanEmail = signUpEmail.trim();
    const cleanPassword = signUpPassword.trim();
    const cleanConfirm = signUpConfirmPassword.trim();

    const currentUsers = storageService.getUsers();
    const errors = validateVendorSignUpForm(
      {
        email: cleanEmail,
        password: cleanPassword,
        confirmPassword: cleanConfirm,
      },
      currentUsers
    );
    setSignUpErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const createdUser = storageService.registerVendor({
      email: cleanEmail,
      password: cleanPassword,
    });
    onLoginSuccess(createdUser);
  };

  const handleQuickLogin = (userId: string) => {
    setAuthBannerError(null);
    const result = storageService.quickLoginById(userId);
    if (!result.ok) {
      setAuthBannerError(result.error);
      return;
    }
    onLoginSuccess(result.user);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[480px] space-y-4">
          {/* Top Card: Brand Header + Sign In / Vendor Sign Up */}
          <section
            aria-label={mode === "signin" ? "Sign In" : "Vendor Sign Up"}
            className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 sm:p-7 flex flex-col relative"
          >
            {/* Brand Header */}
            <div className="text-center">
              <div className="flex flex-col items-center justify-center gap-2.5 mb-2 sm:flex-row sm:gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-xs shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left sm:text-left">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                    Vendora<span className="text-blue-600">™</span>
                  </h1>
                  <p className="text-[11px] font-medium text-slate-500">
                    Powered by{" "}
                    <span className="font-semibold text-slate-700">
                      RustyStick Technologies LLP
                    </span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {mode === "signin"
                  ? "Vendor Onboarding, Orders & Invoices Governance Portal"
                  : "Create Vendor Account · Supplier Portal"}
              </p>
            </div>

            {authBannerError && (
              <div
                role="alert"
                className="my-2 px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
              >
                {authBannerError}
              </div>
            )}

            {mode === "signin" ? (
              <form onSubmit={handleSignInSubmit} noValidate className="pt-4 space-y-4">
                <div>
                  <label
                    htmlFor="signin-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    value={signInEmail}
                    onChange={(e) => {
                      setSignInEmail(e.target.value);
                      if (signInErrors.email) {
                        setSignInErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    placeholder="Enter your email"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${signInErrors.email
                        ? "border-red-500 focus:border-red-500"
                        : "border-slate-300 focus:border-blue-600"
                      }`}
                  />
                  {signInErrors.email && (
                    <p className="text-xs text-red-600 mt-1">
                      {signInErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="signin-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="signin-password"
                      type={showSignInPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={signInPassword}
                      onChange={(e) => {
                        setSignInPassword(e.target.value);
                        if (signInErrors.password) {
                          setSignInErrors((prev) => ({
                            ...prev,
                            password: "",
                          }));
                        }
                      }}
                      placeholder="Enter your password"
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${signInErrors.password
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-300 focus:border-blue-600"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPass((v) => !v)}
                      aria-label={
                        showSignInPass ? "Hide password" : "Show password"
                      }
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSignInPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {signInErrors.password && (
                    <p className="text-xs text-red-600 mt-1">
                      {signInErrors.password}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>

                  <div className="flex items-center justify-between text-xs pt-3 text-slate-500">
                    <span>Don't have an account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setAuthBannerError(null);
                        setSignInErrors({});
                        setSignUpErrors({});
                        setSignUpConfirmPassword("");
                      }}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignUpSubmit} noValidate className="pt-4 space-y-4">
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => {
                      setSignUpEmail(e.target.value);
                      if (signUpErrors.email) {
                        setSignUpErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    placeholder="Enter your email"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${signUpErrors.email
                        ? "border-red-500 focus:border-red-500"
                        : "border-slate-300 focus:border-blue-600"
                      }`}
                  />
                  {signUpErrors.email && (
                    <p className="text-xs text-red-600 mt-1">
                      {signUpErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="signup-password"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative inline-flex items-center">
                        <button
                          type="button"
                          onMouseEnter={() => setShowRulesModal(true)}
                          onMouseLeave={() => setShowRulesModal(false)}
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRulesModal((v) => !v);
                          }}
                          className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition-colors"
                          aria-label="View password rules"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        {/* Password rules hover popover modal */}
                        {showRulesModal && (
                          <div
                            onMouseEnter={() => setShowRulesModal(true)}
                            onMouseLeave={() => setShowRulesModal(false)}
                            className="absolute left-0 bottom-full mb-2 z-40 w-64 p-3 bg-white border border-slate-200 rounded-xl shadow-xl text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
                              <span className="font-semibold text-slate-900">
                                Password Rules
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Requirements
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {[
                                {
                                  ok: passwordRules.minMaxLength,
                                  text: "8–30 characters",
                                },
                                {
                                  ok: passwordRules.hasUppercase,
                                  text: "1 uppercase letter (A–Z)",
                                },
                                {
                                  ok: passwordRules.hasLowercase,
                                  text: "1 lowercase letter (a–z)",
                                },
                                {
                                  ok: passwordRules.hasDigit,
                                  text: "1 digit (0–9)",
                                },
                                {
                                  ok: passwordRules.hasSpecial,
                                  text: "1 special char (@$!%*?&#...)",
                                },
                              ].map((rule, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-1.5 text-[11px] ${rule.ok
                                      ? "text-emerald-700 font-medium"
                                      : "text-slate-500"
                                    }`}
                                >
                                  {rule.ok ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : (
                                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                  <span>{rule.text}</span>
                                </div>
                              ))}
                            </div>
                            <div className="absolute left-3 top-full w-2 h-2 -mt-1 bg-white border-r border-b border-slate-200 rotate-45" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showSignUpPass ? "text" : "password"}
                      value={signUpPassword}
                      onChange={(e) => {
                        setSignUpPassword(e.target.value);
                        if (signUpErrors.password) {
                          setSignUpErrors((prev) => ({
                            ...prev,
                            password: "",
                          }));
                        }
                      }}
                      placeholder="Create a strong password"
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${signUpErrors.password
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-300 focus:border-blue-600"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPass((v) => !v)}
                      aria-label={
                        showSignUpPass ? "Hide password" : "Show password"
                      }
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSignUpPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {signUpErrors.password && (
                    <p className="text-xs text-red-600 mt-1">
                      {signUpErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showSignUpConfirmPass ? "text" : "password"}
                      value={signUpConfirmPassword}
                      onChange={(e) => {
                        setSignUpConfirmPassword(e.target.value);
                        if (signUpErrors.confirmPassword) {
                          setSignUpErrors((prev) => ({
                            ...prev,
                            confirmPassword: "",
                          }));
                        }
                      }}
                      placeholder="Confirm your password"
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${signUpErrors.confirmPassword
                          ? "border-red-500 focus:border-red-500"
                          : "border-slate-300 focus:border-blue-600"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpConfirmPass((v) => !v)}
                      aria-label={
                        showSignUpConfirmPass
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSignUpConfirmPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {signUpErrors.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">
                      {signUpErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Create Vendor Account
                  </button>

                  <div className="flex items-center justify-between text-xs pt-3 text-slate-500">
                    <span>Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setAuthBannerError(null);
                        setSignInErrors({});
                        setSignUpErrors({});
                        setSignUpConfirmPassword("");
                      }}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          {/* Bottom Card: 1-Click Fast Persona Login */}
          <section
            aria-label="1-Click Fast Persona Login"
            className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <h2 className="text-xs font-bold tracking-wider uppercase text-slate-600">
                  1-Click Fast Persona Login
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Click any persona to enter
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {personaCards.map(({ id, displayLabel, user }) => {
                if (!user) return null;
                const isInactive = user.status === "INACTIVE";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleQuickLogin(user.id)}
                    title={`Quick Login: ${user.name} (${user.email})`}
                    className={`flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer bg-white ${isInactive
                        ? "border-red-200 bg-red-50/30 opacity-60 cursor-not-allowed"
                        : "border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 hover:shadow-xs active:scale-[0.99]"
                      }`}
                  >
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {displayLabel}
                    </span>
                    <RoleTag role={user.role} compact />
                  </button>
                );
              })}
            </div>
          </section>

          <p className="text-center text-[11px] text-slate-400 pt-1">
            Vendora™ · Powered by RustyStick Technologies LLP
          </p>
        </div>
      </main>
    </div>
  );
}
